import { Viewer } from './viewer.js';
import {
  VoxelWorld, dirtBackgroundURL, grassIconURL, serverIconURL,
  tileDataURL, TILE
} from './world.js';
import { GameAudio } from './audio.js';
import { drawLogo, pickSplash } from './logo.js';
import { SPLASHES, TIPS, SERVERS, t } from './i18n.js';
import { Game } from './game.js';

const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const delay = ms => new Promise(r => setTimeout(r, ms));

const LS = {
  options: 'mcplayground.options.v1',
  worlds: 'mcplayground.worlds.v1',
  lang: 'mcplayground.lang.v1',
  servers: 'mcplayground.servers.v1'
};

const DEFAULT_OPTIONS = {
  fov: 75,
  renderDistance: 10,
  sensitivity: 100,
  musicVolume: 0.4,
  sfxVolume: 0.7,
  clouds: true,
  musicEnabled: true,
  contrast: false,
  reduceMotion: false,
  bigText: false
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const val = JSON.parse(raw);
    return val ?? fallback;
  } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { console.warn('storage failed', e); return false; }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function randomSeed() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

const state = {
  lang: (() => {
    const stored = localStorage.getItem(LS.lang);
    if (stored === 'pt' || stored === 'en') return stored;
    return (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'pt';
  })(),
  options: { ...DEFAULT_OPTIONS, ...readJSON(LS.options, {}) },
  worlds: readJSON(LS.worlds, null),
  customServers: readJSON(LS.servers, []),
  servers: [],
  selectedWorldId: null,
  selectedServerId: 'playground',
  currentScreen: 'mainmenu',
  currentWorldMeta: null,
  inGame: false,
  loading: false,
  paused: false,
  optionsReturn: 'mainmenu',
  languageReturn: 'mainmenu',
  accessReturn: 'mainmenu',
  currentSplash: '',
  deleteArmed: null,
  pinging: false
};

state.options.fov = clamp(Number(state.options.fov) || 75, 50, 110);
state.options.renderDistance = clamp(Number(state.options.renderDistance) || 10, 4, 14);
state.options.sensitivity = clamp(Number(state.options.sensitivity) || 100, 30, 200);

const tUI = (key, vars) => t(state.lang, key, vars);
const langTag = () => state.lang === 'pt' ? 'pt-BR' : 'en-US';

if (!Array.isArray(state.worlds) || !state.worlds.length) {
  state.worlds = state.lang === 'en'
    ? [
      { id: 'w_playground', name: 'PlayGround World', seed: 'playground', mode: 'creative', cheats: true, lastPlayed: Date.now(), edits: {} },
      { id: 'w_island', name: 'Lost Island', seed: 'lost-island', mode: 'survival', cheats: false, lastPlayed: Date.now() - 172800000, edits: {} }
    ]
    : [
      { id: 'w_playground', name: 'Mundo do PlayGround', seed: 'playground', mode: 'creative', cheats: true, lastPlayed: Date.now(), edits: {} },
      { id: 'w_ilha', name: 'Ilha Perdida', seed: 'ilha-perdida', mode: 'survival', cheats: false, lastPlayed: Date.now() - 172800000, edits: {} }
    ];
}
state.worlds.forEach(w => {
  w.edits = w.edits && typeof w.edits === 'object' ? w.edits : {};
  w.lastPlayed = Number(w.lastPlayed) || 0;
});
state.worlds.sort((a, b) => b.lastPlayed - a.lastPlayed);
state.selectedWorldId = state.worlds[0]?.id ?? null;

state.servers = [
  ...SERVERS.map(s => ({ ...s, motd: { ...s.motd }, custom: false })),
  ...state.customServers.map(s => ({ ...s, online: false, custom: true, motd: s.motd || { pt: 'Servidor personalizado', en: 'Custom server' } }))
];
if (!state.servers.find(s => s.id === state.selectedServerId)) state.selectedServerId = state.servers[0]?.id ?? null;

const bootEl = $('#boot');
const canvas = $('#scene');
const hud = $('#hud');
const screens = new Map($$('[data-screen]').map(el => [el.dataset.screen, el]));

let viewer = null;
let panoWorld = null;
let game = null;
let iconUrl = null;
let saveTimer = null;

const audio = new GameAudio();
audio.setVolumes({
  musicVolume: state.options.musicVolume,
  sfxVolume: state.options.sfxVolume,
  musicEnabled: state.options.musicEnabled
});

/* ============================================================
   Boot
   ============================================================ */
async function init() {
  document.documentElement.style.setProperty('--dirt', `url("${dirtBackgroundURL()}")`);
  iconUrl = grassIconURL();

  viewer = new Viewer(canvas);
  viewer.setCloudsVisible(state.options.clouds);
  applyAccessibility();
  bindUI();
  buildScreens();

  await Promise.all([
    document.fonts.ready.catch(() => {}),
    drawLogo($('#logo')).catch(() => {})
  ]);
  setSplash();
  applyLanguage();

  panoWorld = new VoxelWorld({ size: 112, height: 48, seed: 'playground-panorama' });
  panoWorld.generate();
  panoWorld.buildAll();
  viewer.setWorld(panoWorld);
  viewer.setMode('menu');
  viewer.setRenderDistance(state.options.renderDistance);
  viewer.setCloudsVisible(state.options.clouds);

  syncOptionsUI();
  renderWorlds();
  renderServers();
  renderLanguage();
  refreshMusicButton();

  showScreen('mainmenu');
  hud.hidden = true;
  startLoop();
  await delay(180);
  bootEl.classList.add('gone');
  setTimeout(() => bootEl.remove(), 600);
}

function startLoop() {
  let last = performance.now();
  const frame = now => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (game) game.update(dt);
    if (viewer) viewer.render(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* ============================================================
   Screens
   ============================================================ */
function showScreen(name) {
  for (const [key, el] of screens) el.hidden = key !== name;
  state.currentScreen = name || 'game';
  document.body.dataset.screen = state.currentScreen;
  if (name !== 'mainmenu') viewer?.setPointer(0, 0);
}

function buildScreens() {
  $('#sp-play').addEventListener('click', () => {
    const meta = selectedWorld();
    if (meta) startWorld(meta);
  });
  $('#sp-delete').addEventListener('click', handleDeleteWorld);
  $('#world-search').addEventListener('input', renderWorlds);
  $('#create-confirm').addEventListener('click', confirmCreateWorld);
  $('#create-mode').addEventListener('click', () => {
    state.createMode = state.createMode === 'creative' ? 'survival' : 'creative';
    updateCreateToggles();
  });
  $('#create-cheats').addEventListener('click', () => {
    state.createCheats = !state.createCheats;
    updateCreateToggles();
  });
  $('#mp-join').addEventListener('click', joinSelectedServer);
  $('#mp-refresh').addEventListener('click', () => refreshServers(true));
  $('#server-add-confirm').addEventListener('click', addServer);
  ['server-name', 'server-ip'].forEach(id => {
    $('#' + id)?.addEventListener('keydown', e => { if (e.key === 'Enter') addServer(); });
  });

  $('#opt-fov').addEventListener('input', e => {
    state.options.fov = Number(e.target.value);
    $('#opt-fov-val').textContent = state.options.fov;
    if (game) {
      game.options.fov = state.options.fov;
      game.currentFov = state.options.fov;
    }
    saveOptions();
  });
  $('#opt-render').addEventListener('input', e => {
    state.options.renderDistance = Number(e.target.value);
    $('#opt-render-val').textContent = state.options.renderDistance;
    if (game) viewer.setRenderDistance(state.options.renderDistance);
    saveOptions();
  });
  $('#opt-music').addEventListener('input', e => {
    state.options.musicVolume = Number(e.target.value) / 100;
    $('#opt-music-val').textContent = e.target.value;
    audio.setVolumes({ musicVolume: state.options.musicVolume, sfxVolume: state.options.sfxVolume, musicEnabled: state.options.musicEnabled });
    saveOptions();
  });
  $('#opt-sfx').addEventListener('input', e => {
    state.options.sfxVolume = Number(e.target.value) / 100;
    $('#opt-sfx-val').textContent = e.target.value;
    audio.setVolumes({ musicVolume: state.options.musicVolume, sfxVolume: state.options.sfxVolume, musicEnabled: state.options.musicEnabled });
    saveOptions();
    audio.click();
  });
  $('#opt-sens').addEventListener('input', e => {
    state.options.sensitivity = Number(e.target.value);
    $('#opt-sens-val').textContent = state.options.sensitivity;
    saveOptions();
  });
  $('#opt-clouds').addEventListener('click', () => {
    state.options.clouds = !state.options.clouds;
    viewer.setCloudsVisible(state.options.clouds);
    syncOptionsUI();
    saveOptions();
  });
  $('#opt-fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', syncOptionsUI);

  $$('[data-access]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.access;
      const prop = key === 'contrast' ? 'contrast' : key === 'reduce' ? 'reduceMotion' : 'bigText';
      state.options[prop] = !state.options[prop];
      applyAccessibility();
      syncOptionsUI();
      saveOptions();
    });
  });
}

function setSplash() {
  const el = $('#splash');
  const value = pickSplash(SPLASHES[state.lang], state.currentSplash);
  state.currentSplash = value;
  if (el) el.textContent = value;
}

function refreshMusicButton() {
  const btn = $('#music-btn');
  if (!btn) return;
  btn.classList.toggle('music-off', !state.options.musicEnabled);
  const label = btn.querySelector('[data-role="music-label"]');
  if (label) label.textContent = tUI('menu.music');
  btn.setAttribute('aria-pressed', String(state.options.musicEnabled));
  btn.title = tUI('menu.music');
}

function toggleMusic() {
  state.options.musicEnabled = !state.options.musicEnabled;
  audio.setVolumes({
    musicVolume: state.options.musicVolume,
    sfxVolume: state.options.sfxVolume,
    musicEnabled: state.options.musicEnabled
  });
  saveOptions();
  refreshMusicButton();
  toast(tUI(state.options.musicEnabled ? 'toast.musicOn' : 'toast.musicOff'), 'plain');
}

/* ============================================================
   Language / options / accessibility
   ============================================================ */
function applyLanguage() {
  document.documentElement.lang = langTag();
  document.title = state.lang === 'pt' ? 'Minecraft Java Edition — Menu' : 'Minecraft Java Edition — Menu';
  $$('[data-i18n]').forEach(el => {
    el.textContent = tUI(el.dataset.i18n);
  });
  $$('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = tUI(el.dataset.i18nPlaceholder);
  });
  setSplash();
  refreshMusicButton();
  syncOptionsUI();
  renderWorlds();
  renderServers();
  renderLanguage();
  updateCreateToggles();
  updateDeleteButton();
  if (game) {
    game.lang = state.lang;
    if (game.hintVisible) {
      game.dom.hint.querySelector('.hint-play').textContent = tUI('game.clickToPlay');
      game.dom.hintControls.textContent = game.isTouch ? tUI('game.controlsTouch') : tUI('game.controls');
      game.dom.hintName.textContent = state.currentWorldMeta?.name || '';
    }
    game.dom.label.classList.remove('show');
  }
}

function applyAccessibility() {
  document.body.classList.toggle('high-contrast', !!state.options.contrast);
  document.body.classList.toggle('reduce-motion', !!state.options.reduceMotion);
  document.body.classList.toggle('big-text', !!state.options.bigText);
}

function syncOptionsUI() {
  const o = state.options;
  const setRange = (id, val) => {
    const el = $('#' + id);
    if (el) el.value = String(val);
    const out = $('#' + id + '-val');
    if (out) out.textContent = String(val);
  };
  setRange('opt-fov', o.fov);
  setRange('opt-render', o.renderDistance);
  setRange('opt-sens', o.sensitivity);
  setRange('opt-music', Math.round(o.musicVolume * 100));
  setRange('opt-sfx', Math.round(o.sfxVolume * 100));

  const clouds = $('#opt-clouds');
  if (clouds) { clouds.dataset.on = String(!!o.clouds); clouds.textContent = tUI(o.clouds ? 'opt.on' : 'opt.off'); }
  const fs = $('#opt-fullscreen');
  if (fs) { const on = !!document.fullscreenElement; fs.dataset.on = String(on); fs.textContent = tUI(on ? 'opt.on' : 'opt.off'); }

  const accessMap = { contrast: o.contrast, reduce: o.reduceMotion, big: o.bigText };
  $$('[data-access]').forEach(btn => {
    const on = accessMap[btn.dataset.access];
    btn.dataset.on = String(!!on);
    btn.textContent = tUI(on ? 'opt.on' : 'opt.off');
  });
  updateCreateToggles();
}

function saveOptions() {
  writeJSON(LS.options, state.options);
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    toast(tUI('toast.fullscreenFail'), 'error');
  }
  syncOptionsUI();
}

/* ============================================================
   Worlds
   ============================================================ */
function fmtDate(ts) {
  if (!ts) return tUI('sp.never');
  try {
    return new Date(ts).toLocaleDateString(langTag(), { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function selectedWorld() {
  return state.worlds.find(w => w.id === state.selectedWorldId) || null;
}

function renderWorlds() {
  const list = $('#world-list');
  const empty = $('#world-empty');
  if (!list) return;
  const query = ($('#world-search')?.value || '').trim().toLowerCase();
  const filtered = state.worlds
    .slice()
    .sort((a, b) => b.lastPlayed - a.lastPlayed)
    .filter(w => !query || w.name.toLowerCase().includes(query));

  if (state.selectedWorldId && !state.worlds.find(w => w.id === state.selectedWorldId)) {
    state.selectedWorldId = state.worlds[0]?.id ?? null;
  }

  list.innerHTML = '';
  for (const w of filtered) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'world-row' + (w.id === state.selectedWorldId ? ' selected' : '');
    row.dataset.id = w.id;

    const icon = document.createElement('div');
    icon.className = 'world-icon';
    icon.style.backgroundImage = `url("${iconUrl}")`;

    const main = document.createElement('div');
    main.className = 'world-main';
    const name = document.createElement('div');
    name.className = 'world-name';
    name.textContent = w.name;
    const meta = document.createElement('div');
    meta.className = 'world-meta';
    const blocks = Object.keys(w.edits || {}).length;
    meta.textContent = `${tUI('mode.' + (w.mode || 'creative'))} • ${fmtDate(w.lastPlayed)}${blocks ? ` • ${blocks} ⛏` : ''}`;
    main.append(name, meta);

    const chevron = document.createElement('div');
    chevron.className = 'world-chevron';
    chevron.textContent = '❯';

    row.append(icon, main, chevron);
    row.addEventListener('click', () => selectWorld(w.id));
    row.addEventListener('dblclick', () => startWorld(w));
    list.appendChild(row);
  }

  if (empty) empty.hidden = filtered.length !== 0;
  const play = $('#sp-play');
  if (play) play.disabled = !selectedWorld();
  updateDeleteButton();
  renderWorldSummary();
}

function selectWorld(id) {
  if (state.selectedWorldId !== id) {
    state.deleteArmed = null;
    state.selectedWorldId = id;
    updateDeleteButton();
  }
  renderWorlds();
}

function renderWorldSummary() {
  const w = selectedWorld();
  const icon = $('#summary-icon');
  const name = $('#summary-name');
  const mode = $('#summary-mode');
  if (!icon || !name || !mode) return;
  if (!w) {
    icon.style.backgroundImage = '';
    name.textContent = '—';
    mode.textContent = '';
    $('#summary-seed').textContent = '—';
    $('#summary-last').textContent = '—';
    $('#summary-blocks').textContent = '—';
    return;
  }
  icon.style.backgroundImage = `url("${iconUrl}")`;
  name.textContent = w.name;
  mode.textContent = `${tUI('mode.' + (w.mode || 'creative'))}${w.cheats ? ' • ' + tUI('opt.on') : ''}`;
  $('#summary-seed').textContent = w.seed || '—';
  $('#summary-last').textContent = fmtDate(w.lastPlayed);
  $('#summary-blocks').textContent = String(Object.keys(w.edits || {}).length);
}

function updateDeleteButton() {
  const btn = $('#sp-delete');
  if (!btn) return;
  const armed = state.deleteArmed && state.deleteArmed === state.selectedWorldId;
  btn.textContent = armed ? tUI('sp.deleteConfirm') : tUI('sp.delete');
  btn.disabled = !selectedWorld();
  btn.style.setProperty('--gui-btn', armed ? '#8a4f4f' : '#7d7d7d');
}

function handleDeleteWorld() {
  const w = selectedWorld();
  if (!w) return;
  if (state.deleteArmed !== w.id) {
    state.deleteArmed = w.id;
    updateDeleteButton();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { state.deleteArmed = null; updateDeleteButton(); }, 3000);
    return;
  }
  state.worlds = state.worlds.filter(x => x.id !== w.id);
  state.deleteArmed = null;
  saveWorlds();
  state.selectedWorldId = state.worlds.slice().sort((a, b) => b.lastPlayed - a.lastPlayed)[0]?.id ?? null;
  renderWorlds();
  toast(tUI('toast.worldDeleted'), 'plain');
}

function saveWorlds() {
  const clean = state.worlds.map(w => ({
    id: w.id, name: w.name, seed: w.seed, mode: w.mode, cheats: !!w.cheats,
    lastPlayed: w.lastPlayed, edits: w.edits || {}
  }));
  writeJSON(LS.worlds, clean);
}

function openCreateWorld() {
  state.createMode = 'creative';
  state.createCheats = true;
  const names = state.worlds.map(w => w.name.toLowerCase());
  let base = tUI('sp.defaultName');
  let name = base;
  let i = 2;
  while (names.includes(name.toLowerCase())) name = `${base} ${i++}`;
  $('#create-name').value = name;
  $('#create-seed').value = '';
  updateCreateToggles();
  const icon = $('#create-icon');
  if (icon) icon.style.backgroundImage = `url("${iconUrl}")`;
  showScreen('createworld');
  setTimeout(() => $('#create-name')?.focus(), 80);
}

function updateCreateToggles() {
  const mode = $('#create-mode');
  if (mode) {
    mode.textContent = tUI('mode.' + (state.createMode || 'creative'));
    mode.dataset.on = String((state.createMode || 'creative') === 'creative');
  }
  const cheats = $('#create-cheats');
  if (cheats) {
    cheats.textContent = tUI(state.createCheats ? 'opt.on' : 'opt.off');
    cheats.dataset.on = String(!!state.createCheats);
  }
}

async function confirmCreateWorld() {
  const nameEl = $('#create-name');
  const name = (nameEl.value || '').trim() || tUI('sp.defaultName');
  const seedInput = ($('#create-seed').value || '').trim();
  const seed = seedInput || randomSeed();
  const meta = {
    id: 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name,
    seed,
    mode: state.createMode || 'creative',
    cheats: !!state.createCheats,
    lastPlayed: Date.now(),
    edits: {}
  };
  state.worlds.unshift(meta);
  state.selectedWorldId = meta.id;
  saveWorlds();
  renderWorlds();
  showScreen('singleplayer');
  toast(tUI('toast.worldCreated', { s: name }), 'plain');
  await nextFrame();
}

async function startWorld(meta) {
  if (!meta) return;
  if (meta.id) {
    meta.lastPlayed = Date.now();
    saveWorlds();
  }
  await enterGame({
    ...meta,
    serverName: null
  });
}

/* ============================================================
   Servers
   ============================================================ */
function renderServers() {
  const list = $('#server-list');
  const empty = $('#server-empty');
  if (!list) return;
  list.innerHTML = '';
  for (const s of state.servers) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'server-row' + (s.id === state.selectedServerId ? ' selected' : '');
    row.dataset.id = s.id;

    const icon = document.createElement('div');
    icon.className = 'server-icon';
    icon.style.backgroundImage = `url("${serverIconURL(s.iconHue ?? 200)}")`;

    const main = document.createElement('div');
    main.className = 'server-main';
    const name = document.createElement('div');
    name.className = 'server-name';
    name.textContent = s.name;
    const motd = document.createElement('div');
    motd.className = 'server-motd';
    motd.textContent = (s.motd && (s.motd[state.lang] || s.motd.pt)) || s.ip;
    main.append(name, motd);

    const side = document.createElement('div');
    side.className = 'server-side';
    const players = document.createElement('div');
    players.className = 'server-players';
    const dot = document.createElement('span');
    dot.className = 'dot ' + (s.online ? 'online' : 'offline');
    players.append(dot, document.createTextNode(s.online ? `${s.players}/${s.max}` : tUI('opt.off')));
    const ping = document.createElement('div');
    const level = state.pinging ? 'pinging' : s.online ? 'p' + clamp(s.ping || 3, 1, 4) : '';
    ping.className = 'ping ' + level;
    ping.innerHTML = '<i></i><i></i><i></i>';
    side.append(players, ping);

    row.append(icon, main, side);
    row.addEventListener('click', () => {
      state.selectedServerId = s.id;
      renderServers();
    });
    row.addEventListener('dblclick', () => {
      state.selectedServerId = s.id;
      joinSelectedServer();
    });
    list.appendChild(row);
  }
  if (empty) empty.hidden = state.servers.length !== 0;
}

function refreshServers(showToast = false) {
  if (state.pinging) return;
  state.pinging = true;
  renderServers();
  setTimeout(() => {
    for (const s of state.servers) {
      if (s.online) s.ping = 2 + Math.floor(Math.random() * 4);
    }
    state.pinging = false;
    renderServers();
    if (showToast) toast(tUI('toast.refreshed'), 'plain');
  }, 850);
}

function joinSelectedServer() {
  const s = state.servers.find(x => x.id === state.selectedServerId);
  if (!s) return;
  if (!s.online) {
    toast(tUI('toast.connectionFailed'), 'error');
    return;
  }
  enterGame({
    id: null,
    name: s.name,
    seed: s.seed,
    mode: s.mode,
    cheats: true,
    edits: {},
    serverName: s.name
  });
}

function openAddServer() {
  $('#server-name').value = '';
  $('#server-ip').value = '';
  $('#server-modal').hidden = false;
  setTimeout(() => $('#server-name')?.focus(), 50);
}

function closeModal() {
  $('#server-modal').hidden = true;
}

function addServer() {
  const name = ($('#server-name').value || '').trim();
  const ip = ($('#server-ip').value || '').trim();
  if (!name || !ip) {
    toast(tUI('mp.needFields'), 'error');
    return;
  }
  const server = {
    id: 's_' + Date.now().toString(36),
    name,
    ip,
    online: false,
    players: 0,
    max: 20,
    ping: 0,
    seed: 'custom-' + ip.replace(/\W+/g, '-'),
    mode: 'survival',
    iconHue: Math.floor(Math.random() * 360),
    custom: true,
    motd: { pt: 'Servidor personalizado • offline', en: 'Custom server • offline' }
  };
  state.servers.push(server);
  state.customServers.push(server);
  state.selectedServerId = server.id;
  writeJSON(LS.servers, state.customServers);
  closeModal();
  renderServers();
  toast(tUI('toast.serverAdded'), 'plain');
}

/* ============================================================
   Language / accessibility screens
   ============================================================ */
function renderLanguage() {
  const list = $('#language-list');
  if (!list) return;
  list.innerHTML = '';
  const options = [
    {
      code: 'pt', label: tUI('lang.pt'), flag:
        'radial-gradient(circle at 50% 50%, #244a9b 0 24%, transparent 25%), linear-gradient(45deg, transparent 36%, #f2d63b 36% 64%, transparent 64%), #159447'
    },
    {
      code: 'en', label: tUI('lang.en'), flag:
        'linear-gradient(90deg, #2c3e88 0 40%, transparent 40%), repeating-linear-gradient(180deg, #d63b3b 0 4px, #f5f5f5 4px 8px)'
    }
  ];
  for (const opt of options) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'lang-row' + (state.lang === opt.code ? ' selected' : '');
    const flag = document.createElement('div');
    flag.className = 'lang-flag';
    flag.style.background = opt.flag;
    const label = document.createElement('div');
    label.textContent = opt.label;
    const code = document.createElement('div');
    code.className = 'lang-code';
    code.textContent = opt.code.toUpperCase();
    const check = document.createElement('div');
    check.className = 'lang-check';
    check.textContent = state.lang === opt.code ? '✔' : '';
    row.append(flag, label, code, check);
    row.addEventListener('click', () => {
      if (state.lang === opt.code) return;
      state.lang = opt.code;
      localStorage.setItem(LS.lang, state.lang);
      applyLanguage();
      audio.click();
    });
    list.appendChild(row);
  }
}

/* ============================================================
   Navigation / actions
   ============================================================ */
function stopGame() {
  if (!game) return;
  const world = game.world;
  game.setPaused(true);
  game.dispose();
  game = null;
  viewer.setMode('menu');
  viewer.setWorld(panoWorld);
  world.dispose();
  viewer.setCloudsVisible(state.options.clouds);
  viewer.scene.fog.color.setHex(0xc9dfef);
  viewer.renderer.setClearColor(0x9cc7e6, 1);
  state.inGame = false;
  state.paused = false;
  state.currentWorldMeta = null;
  hud.hidden = true;
  hud.classList.remove('dimmed');
  document.body.classList.remove('underwater', 'touch');
  $('#touch-controls').hidden = true;
  $('#touch-pause').hidden = true;
  $('#game-hint').hidden = true;
  showScreen('mainmenu');
  setSplash();
  renderWorlds();
  saveWorlds();
}

function showPause() {
  if (!game || state.loading) return;
  state.paused = true;
  game.setPaused(true);
  $('#pause-world').textContent = state.currentWorldMeta?.name || '';
  hud.classList.add('dimmed');
  showScreen('pause');
}

function resumeGame() {
  if (!game) return;
  showScreen(null);
  hud.classList.remove('dimmed');
  state.paused = false;
  game.resume();
}

function clearPause() {
  if (state.currentScreen === 'pause') {
    showScreen(null);
    hud.classList.remove('dimmed');
    state.paused = false;
  }
}

function openOptionsFrom(returnTo) {
  state.optionsReturn = returnTo;
  syncOptionsUI();
  showScreen('options');
}

function handleAction(action) {
  switch (action) {
    case 'singleplayer':
      if (state.inGame) return;
      renderWorlds();
      showScreen('singleplayer');
      break;
    case 'multiplayer':
      if (state.inGame) return;
      renderServers();
      showScreen('multiplayer');
      break;
    case 'realms':
      if (state.inGame) return;
      showScreen('realms');
      break;
    case 'options':
      openOptionsFrom(game ? 'pause' : 'mainmenu');
      break;
    case 'pause-options':
      openOptionsFrom('pause');
      break;
    case 'back-options':
      if (state.optionsReturn === 'pause') showScreen('pause');
      else showScreen('mainmenu');
      break;
    case 'language':
      state.languageReturn = game ? 'pause' : state.currentScreen;
      showScreen('language');
      break;
    case 'back-language':
      showScreen(state.languageReturn === 'pause' ? 'pause' : 'mainmenu');
      break;
    case 'accessibility':
      state.accessReturn = game ? 'pause' : state.currentScreen;
      showScreen('accessibility');
      break;
    case 'back-accessibility':
      showScreen(state.accessReturn === 'pause' ? 'pause' : 'mainmenu');
      break;
    case 'create-world':
      openCreateWorld();
      break;
    case 'add-server':
      openAddServer();
      break;
    case 'close-modal':
      closeModal();
      break;
    case 'join-realm':
      enterGame({
        id: null, name: 'Playground Realm', seed: 'realm-playground',
        mode: 'creative', cheats: true, edits: {}, serverName: 'Playground Realm'
      });
      break;
    case 'resume':
      resumeGame();
      break;
    case 'exit-game':
      stopGame();
      toast(tUI('toast.saved'), 'plain');
      break;
    case 'quit':
      showScreen('quit');
      audio.splash();
      break;
    case 'mainmenu':
      if (game) return;
      renderWorlds();
      showScreen('mainmenu');
      break;
    case 'music':
      toggleMusic();
      break;
    default:
      break;
  }
}

function onGlobalPointerDown(e) {
  const el = e.target.closest('.mc-btn, .world-row, .server-row, .lang-row');
  if (!el || el.disabled) return;
  audio.unlock();
  if (!el.classList.contains('hot-slot')) audio.click();
}

function onGlobalClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  handleAction(el.dataset.action);
}

function onGlobalKeyDown(e) {
  if (e.code === 'Escape') {
    const modal = $('#server-modal');
    if (modal && !modal.hidden) { closeModal(); return; }
    if (state.currentScreen === 'pause') { resumeGame(); return; }
    if (state.currentScreen === 'options' && state.optionsReturn === 'pause') { showScreen('pause'); return; }
    if (state.currentScreen === 'controls' && game) { showScreen('pause'); return; }
    if (!state.inGame && !['mainmenu', 'game', 'loading', 'quit'].includes(state.currentScreen)) {
      showScreen('mainmenu');
    }
  }
}

function bindUI() {
  document.addEventListener('click', onGlobalClick);
  document.addEventListener('pointerdown', onGlobalPointerDown, true);
  document.addEventListener('keydown', onGlobalKeyDown);
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  document.addEventListener('keydown', () => audio.unlock(), { once: true });
  window.addEventListener('mousemove', e => {
    if (state.currentScreen !== 'mainmenu' || !viewer) return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    viewer.setPointer(nx, ny);
  });
}

/* ============================================================
   Game entry / loading
   ============================================================ */
function setLoadingProgress(p, label, sub) {
  const fill = $('#loading-fill');
  if (fill) fill.style.width = `${clamp(p, 0, 1) * 100}%`;
  if (label) $('#loading-label').textContent = label;
  if (sub) $('#loading-sub').textContent = sub;
}

function applyEdits(world, edits) {
  if (!edits) return;
  let count = 0;
  for (const [key, block] of Object.entries(edits)) {
    const [x, y, z] = key.split(',').map(Number);
    if (![x, y, z, block].every(Number.isFinite)) continue;
    if (world.setBlock(x, y, z, block)) count++;
    if (count > 12000) break;
  }
}

function pickTip() {
  const list = TIPS[state.lang] || TIPS.pt;
  return list[Math.floor(Math.random() * list.length)];
}

let entering = false;

async function enterGame(meta) {
  if (entering) return;
  entering = true;
  state.loading = true;
  closeModal();
  hud.hidden = true;
  hud.classList.remove('dimmed');
  showScreen('loading');
  const tipEl = $('#loading-tip-text');
  if (tipEl) tipEl.textContent = pickTip();
  setLoadingProgress(0.02, tUI(meta.serverName ? 'loading.connecting' : 'loading.generating'), tUI('loading.sub'));

  try {
    await nextFrame();
    if (meta.serverName) await delay(620);
    setLoadingProgress(0.08, tUI(meta.serverName ? 'loading.joining' : 'loading.generating'), tUI('loading.sub'));

    const world = new VoxelWorld({ size: 112, height: 48, seed: meta.seed || randomSeed() });
    world.generate();
    applyEdits(world, meta.edits);

    setLoadingProgress(0.16, tUI('loading.building'), tUI('loading.sub'));
    await world.buildAllAsync(p => {
      setLoadingProgress(0.16 + p * 0.76, p > 0.55 ? tUI('loading.building') : tUI('loading.generating'), null);
    });

    setLoadingProgress(1, tUI('loading.preparing'), tUI('loading.sub'));
    await nextFrame();
    await delay(120);

    if (!viewer || !canvas) throw new Error('Renderer unavailable');
    game = new Game({
      viewer,
      world,
      app: makeAppApi(),
      options: state.options,
      worldMeta: meta,
      t: tUI
    });

    state.inGame = true;
    state.loading = false;
    state.currentWorldMeta = meta;
    if (meta.id) {
      const stored = state.worlds.find(w => w.id === meta.id);
      if (stored) stored.lastPlayed = Date.now();
      saveWorlds();
    }
    showScreen(null);
    hud.classList.remove('dimmed');
    state.paused = !game.isTouch && game.paused;

    setTimeout(() => {
      if (!game) return;
      if (meta.serverName) toast(tUI('toast.connected', { s: meta.serverName }), 'plain');
      else toast(tUI('game.welcome', { s: meta.name }), 'plain');
    }, 500);
  } catch (err) {
    console.error(err);
    state.loading = false;
    state.inGame = false;
    game = null;
    hud.hidden = true;
    showScreen('mainmenu');
    toast(state.lang === 'pt' ? 'Erro ao carregar o mundo.' : 'Failed to load the world.', 'error');
  } finally {
    entering = false;
  }
}

function makeAppApi() {
  return {
    get lang() { return state.lang; },
    audio,
    showPause,
    clearPause,
    showAdvancement,
    recordEdit,
    toast
  };
}

/* ============================================================
   Toasts
   ============================================================ */
function toast(text, kind = 'plain') {
  const stack = $('#toasts');
  if (!stack) return;
  while (stack.children.length >= 3) stack.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  const body = document.createElement('div');
  body.className = 'toast-body';
  const desc = document.createElement('div');
  desc.className = 'toast-desc';
  desc.textContent = text;
  body.appendChild(desc);
  el.appendChild(body);
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 450);
  }, kind === 'error' ? 3200 : 2600);
}

function showAdvancement(title, desc, icon) {
  const stack = $('#toasts');
  if (!stack) return;
  while (stack.children.length >= 3) stack.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  const iconEl = document.createElement('div');
  iconEl.className = 'toast-icon';
  iconEl.style.backgroundImage = `url("${icon}")`;
  const body = document.createElement('div');
  body.className = 'toast-body';
  const titleEl = document.createElement('div');
  titleEl.className = 'toast-title';
  titleEl.textContent = title;
  const descEl = document.createElement('div');
  descEl.className = 'toast-desc';
  descEl.textContent = desc;
  body.append(titleEl, descEl);
  el.append(iconEl, body);
  stack.appendChild(el);
  audio.achievement();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 450);
  }, 3800);
}

/* ============================================================
   Saves
   ============================================================ */
function recordEdit(x, y, z, block) {
  const meta = state.currentWorldMeta;
  if (!meta || !meta.id) return;
  const stored = state.worlds.find(w => w.id === meta.id);
  if (!stored) return;
  if (!stored.edits) stored.edits = {};
  const key = `${x},${y},${z}`;
  const count = Object.keys(stored.edits).length;
  if (!(key in stored.edits) && count >= 6000) return;
  stored.edits[key] = block;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveWorlds(), 800);
}

/* ============================================================
   Go
   ============================================================ */
init().catch(err => {
  console.error(err);
  if (bootEl) {
    const sub = bootEl.querySelector('.boot-sub');
    if (sub) sub.textContent = 'Não foi possível iniciar o WebGL neste navegador.';
  }
});
