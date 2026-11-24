import { CARS, CAR_BY_ID, RARITY, THEMES, TEAM, carPhysicalStats } from '../data/cars.js';
import { getRank, rankEmblem, buildLeaderboard, LEADERBOARD_NAMES } from '../data/ranks.js';
import { ACHIEVEMENTS, levelProgress } from '../core/save.js';
import { CarPreview } from './carPreview.js';

const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9Z"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 15h16M5 15l1.7-5.2A2 2 0 0 1 8.6 8h6.8a2 2 0 0 1 1.9 1.8L19 15M5 15v3M19 15v3" stroke-linecap="round"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6" stroke-linecap="round"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-.9.7-1.5 1.2-1.5 2.5M12 17h.01" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10" stroke-linecap="round"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v10M9 9.5h4.2a1.8 1.8 0 0 1 0 3.6H10.8a1.8 1.8 0 0 0 0 3.6H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none"><path d="M13 3 5 14h5l-1 7 8-11h-5l1-7Z" fill="currentColor"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none"><path d="m12 3 2.7 5.9 6.3.7-4.7 4.3 1.3 6.1L12 16.8 6.4 20l1.3-6.1L3 9.6l6.3-.7L12 3Z" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 5 5L20 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 11a8 8 0 1 0-1.7 6M20 5v6h-6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 21V4M5 4h11l-1.5 4L16 12H5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 5 6v5c0 4.6 3 8.3 7 10 4-1.7 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4.5 9a12 12 0 0 1 15 0M7.5 12.5a8 8 0 0 1 9 0M10.5 16a4 4 0 0 1 3 0M12 19h.01" stroke-linecap="round"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const fmt = (n) => Number(n || 0).toLocaleString('pt-BR');
const clock = (t) => {
  const v = Math.max(0, Math.ceil(t));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

const icon = (name, cls = '') => `<span class="ic ${cls}" style="display:inline-flex;width:16px;height:16px">${ICONS[name] || ''}</span>`;

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('screen-root');
    this.hud = document.getElementById('hud');
    this.currentScreen = null;
    this.preview = null;
    this.garageSelected = game.save.data.car;
    this.boardTab = 'online';
    this.confirmReset = false;
    this.hudVisible = false;
    this.hudCache = {};
    this.blueLabel = game.save.data.name;
    this.orangeLabel = 'Rival';
    this.bannerTimeout = null;
    this.flashTimeout = null;
    this.previewVisible = false;
    this.onlineStatusText = 'Pronto para jogar online';
    this.onlineStatusKind = 'on';
    this.roomCode = '';
    this.onlineWaiting = false;
    this.playForm = {
      mode: 'casual',
      teamSize: 1,
      difficulty: 2,
      duration: 180,
      themeId: 'neon',
    };
    this.onlineForm = { teamSize: 1, duration: 180, themeId: 'neon' };
    this.codeField = '';
    this.resultData = null;
    this.pauseOnline = false;
    this.buildOverlays();
    this.bindGlobal();
    this.initHud();
    this.showScreen('home');
  }

  // ---------- base ----------
  buildOverlays() {
    const app = document.getElementById('app');
    this.resultsEl = document.createElement('div');
    this.resultsEl.className = 'overlay';
    this.resultsEl.id = 'results-overlay';
    app.appendChild(this.resultsEl);
    this.pauseEl = document.createElement('div');
    this.pauseEl.className = 'overlay';
    this.pauseEl.id = 'pause-overlay';
    app.appendChild(this.pauseEl);
    this.toastRoot = document.getElementById('toast-root');
  }

  bindGlobal() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (el) {
        e.preventDefault();
        this.handleAction(el.dataset.action, el);
      }
      const seg = e.target.closest('[data-seg]');
      if (seg) {
        e.preventDefault();
        this.handleSegment(seg);
      }
    });
    document.addEventListener('input', (e) => {
      const el = e.target;
      if (el.id === 'setting-volume') {
        const v = Number(el.value) / 100;
        this.game.applySetting('volume', v);
        const label = document.getElementById('volume-val');
        if (label) label.textContent = `${Math.round(v * 100)}%`;
      }
      if (el.id === 'room-code-input') {
        el.value = el.value.toUpperCase().replace(/[^A-Za-z0-9]/g, '').slice(0, 5);
        this.codeField = el.value;
      }
      if (el.id === 'player-name-input') {
        this.nameDraft = el.value;
      }
    });
    document.addEventListener('change', (e) => {
      const el = e.target;
      if (el.id === 'player-name-input') {
        this.game.setPlayerName(el.value);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.target?.id === 'room-code-input' && e.key === 'Enter') {
        this.handleAction('join-room', e.target);
      }
    });
    document.getElementById('hud-menu')?.addEventListener('click', () => this.game.handlePause());
  }

  initHud() {
    this.pips = document.getElementById('boost-pips');
    if (this.pips) this.pips.innerHTML = Array.from({ length: 10 }, () => '<i></i>').join('');
    this.hudElements = {
      scoreBlue: document.getElementById('score-blue'),
      scoreOrange: document.getElementById('score-orange'),
      clock: document.getElementById('clock'),
      clockSub: document.getElementById('clock-sub'),
      blueSub: document.getElementById('blue-sub'),
      orangeSub: document.getElementById('orange-sub'),
      speed: document.getElementById('speed'),
      speedFill: document.getElementById('speed-fill'),
      boostFill: document.getElementById('boost-fill'),
      boostValue: document.getElementById('boost-value'),
      supersonic: document.getElementById('supersonic'),
      banner: document.getElementById('banner'),
      hintBar: document.getElementById('hint-bar'),
    };
  }

  // ---------- navigation ----------
  showScreen(id) {
    if (this.currentScreen === 'garage' && id !== 'garage') this.disposePreview();
    this.currentScreen = id;
    const html = this.renderScreen(id);
    if (!html) return;
    this.root.innerHTML = html;
    const screen = this.root.firstElementChild;
    if (screen) {
      requestAnimationFrame(() => screen.classList.add('active'));
      const scrollables = screen.querySelectorAll('.play-layout, .garage-layout, .board-layout, .settings-layout, .howto-grid, .online-layout, .shell-body');
      scrollables.forEach((el) => { el.dataset.fresh = '1'; });
    }
    if (id === 'garage') this.afterGarageRender();
    if (id === 'home') this.flushOnlineFields();
    this.updateOnlineDom();
    this.audioHover();
  }

  refresh() {
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return;
    if (this.currentScreen && this.currentScreen !== 'garage') {
      const scrollPos = this.getScroll();
      this.showScreen(this.currentScreen);
      this.restoreScroll(scrollPos);
    } else if (this.currentScreen === 'garage') {
      this.refreshGarageChrome();
    }
  }

  getScroll() {
    const el = this.root.querySelector('.play-layout, .garage-layout, .board-layout, .settings-layout, .howto-grid, .online-layout');
    return el ? el.scrollTop : 0;
  }

  restoreScroll(v) {
    const el = this.root.querySelector('.play-layout, .garage-layout, .board-layout, .settings-layout, .howto-grid, .online-layout');
    if (el) el.scrollTop = v;
  }

  audioHover() {
    this.root.querySelectorAll('button, .car-item, .mode-card').forEach(() => {});
  }

  hideScreens() {
    this.disposePreview();
    this.root.innerHTML = '';
    this.currentScreen = null;
  }

  disposePreview() {
    if (this.preview) {
      this.preview.dispose();
      this.preview = null;
    }
  }

  // ---------- render router ----------
  renderScreen(id) {
    switch (id) {
      case 'home': return this.renderHome();
      case 'play': return this.renderPlay();
      case 'online': return this.renderOnline();
      case 'garage': return this.renderGarage();
      case 'leaderboard': return this.renderLeaderboard();
      case 'settings': return this.renderSettings();
      case 'howto': return this.renderHowTo();
      default: return this.renderHome();
    }
  }

  shellHead(title, sub, options = {}) {
    return `<div class="shell-head">
      <button class="back-btn" data-action="nav" data-nav="${options.back || 'home'}" aria-label="Voltar">${ICONS.back}</button>
      <div class="shell-title"><h1>${title}</h1><p>${sub}</p></div>
      <div class="shell-head-right">
        ${options.stats || ''}
        <div class="wallet-pill">${icon('coin')}<span>${fmt(this.game.save.data.credits)}</span></div>
      </div>
    </div>`;
  }

  // ---------- HOME ----------
  renderHome() {
    const save = this.game.save.data;
    const rank = getRank(save.online.mmr);
    const prog = levelProgress(save);
    const initials = (save.name || 'Piloto').slice(0, 2).toUpperCase();
    return `
    <div class="screen home">
      <div class="home-inner">
        <div class="home-left">
          <div class="brand">
            <div class="brand-line">
              <div class="brand-mark">${ICONS.car}</div>
              <div class="brand-title">TURBO <em>STRIKE</em></div>
            </div>
            <div class="brand-sub">ARENA DE CARROS • TEMPORADA 1</div>
          </div>

          <div class="hero-block">
            <div class="eyebrow">Futebol de carros em alta velocidade</div>
            <h1 class="hero-title"><span>ENTRE NA</span><span class="line-2">ARENA</span></h1>
            <p class="hero-desc">Acelere, voe e marque gols em <strong>arenas neon</strong> com 16 carros únicos. Jogue online com um amigo, suba no ranqueado ou domine a garagem.</p>

            <div class="menu-stack">
              <button class="menu-btn primary" data-action="nav" data-nav="play">
                <span class="mb-icon">${ICONS.play}</span>
                <span class="mb-text"><span class="mb-title">Jogar Agora</span><span class="mb-sub">Partida rápida • vs IA • 1v1, 2v2 ou 3v3</span></span>
                <span class="mb-tag">OFFLINE</span>
              </button>
              <button class="menu-btn" data-action="nav" data-nav="online">
                <span class="mb-icon">${ICONS.globe}</span>
                <span class="mb-text"><span class="mb-title">Multijogador Online</span><span class="mb-sub">Crie uma sala ou entre com código</span></span>
                <span class="mb-tag">P2P</span>
              </button>
              <button class="menu-btn" data-action="ranked-quick">
                <span class="mb-icon">${ICONS.trophy}</span>
                <span class="mb-text"><span class="mb-title">Ranqueada</span><span class="mb-sub">${rank.name} • ${rank.mmr} MMR online</span></span>
                <span class="mb-tag">RANQUEADA</span>
              </button>
              <button class="menu-btn" data-action="nav" data-nav="garage">
                <span class="mb-icon">${ICONS.car}</span>
                <span class="mb-text"><span class="mb-title">Garagem</span><span class="mb-sub">${save.owned.length} de ${CARS.length} carros desbloqueados</span></span>
                <span class="mb-tag">LOJA</span>
              </button>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
                <button class="menu-btn compact" data-action="nav" data-nav="leaderboard">
                  <span class="mb-icon">${ICONS.star}</span>
                  <span class="mb-text"><span class="mb-title">Ranking</span></span>
                </button>
                <button class="menu-btn compact" data-action="nav" data-nav="settings">
                  <span class="mb-icon">${ICONS.settings}</span>
                  <span class="mb-text"><span class="mb-title">Ajustes</span></span>
                </button>
              </div>
              <button class="menu-btn compact" data-action="nav" data-nav="howto">
                <span class="mb-icon">${ICONS.help}</span>
                <span class="mb-text"><span class="mb-title">Como Jogar</span></span>
              </button>
            </div>
          </div>

          <div class="home-bottom">
            <div class="profile-bar">
              <div class="profile-avatar">${initials}</div>
              <div class="profile-meta">
                <span class="profile-name">${save.name}</span>
                <span class="profile-level">NÍVEL ${save.level} • ${save.stats.wins} VITÓRIAS</span>
                <div class="profile-xp"><i style="width:${Math.round(prog.progress * 100)}%"></i></div>
              </div>
              <div class="profile-credits">${icon('coin')}<b>${fmt(save.credits)}</b><span>CRÉDITOS</span></div>
            </div>
            <div class="home-footer">
              <span class="chip"><span class="dot"></span> ARENA AO VIVO</span>
              <span class="chip">ONLINE P2P</span>
              <span class="chip">RANQUEADO</span>
              <span class="chip">16 CARROS</span>
              <span>© 2026 TURBO STRIKE • Jogo original inspirado em futebol de carros</span>
            </div>
          </div>
        </div>
        <div class="home-right">
          <div style="display:flex;flex-direction:column;gap:12px;align-items:flex-end;width:min(340px,100%)">
            <div class="rank-mini">
              <div class="rank-mini-head"><span>SEU RANQUE ONLINE</span><span>${rank.mmr} MMR</span></div>
              <div class="rank-mini-body">
                <div class="rank-emblem">${rankEmblem(rank, 54)}</div>
                <div class="rank-info">
                  <div class="rank-name" style="color:${rank.color}">${rank.name}</div>
                  <div class="rank-mmr">${save.online.wins}V • ${save.online.losses}D • MELHOR ${fmt(save.online.best)} MMR</div>
                  <div class="rank-progress"><i style="width:${Math.round(rank.progress * 100)}%"></i></div>
                </div>
              </div>
            </div>
            <div class="rank-mini" style="width:min(340px,100%)">
              <div class="rank-mini-head"><span>CARRO EQUIPADO</span><span style="color:${RARITY[this.game.selectedCar.rarity].color}">${this.game.selectedCar.rarity}</span></div>
              <div class="rank-mini-body">
                <div class="car-swatch" style="--swatch-a:${this.game.selectedCar.paint.body};--swatch-b:${this.game.selectedCar.paint.accent};width:46px;height:46px;flex-basis:46px"></div>
                <div class="rank-info">
                  <div class="rank-name" style="font-size:17px">${this.game.selectedCar.name}</div>
                  <div class="rank-mmr">${this.game.selectedCar.tag} • ${this.game.selectedCar.stats.speed} VEL</div>
                </div>
                <button class="btn sm" data-action="nav" data-nav="garage">Trocar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---------- PLAY ----------
  renderPlay() {
    const f = this.playForm;
    const theme = THEMES.find((t) => t.id === f.themeId) || THEMES[0];
    const rankOff = getRank(this.game.save.data.offline.mmr);
    const car = this.game.selectedCar;
    const diffNames = ['Iniciante', 'Amador', 'Profissional', 'All-Star', 'Lenda'];
    const teams = (n) => {
      const blue = ['VOCÊ', ...Array.from({ length: n - 1 }, (_, i) => `BOT ${i + 1}`)];
      const orange = Array.from({ length: n }, (_, i) => `BOT ${i + 1}`);
      return { blue, orange };
    };
    const lu = teams(f.teamSize);
    return `
    <div class="screen panel-screen">
      <div class="shell">
        ${this.shellHead('Jogar Offline', 'Escolha o formato e entre na arena')}
        <div class="shell-body">
          <div class="play-layout">
            <div class="play-main">
              <div class="mode-grid">
                <button class="mode-card ${f.mode === 'casual' ? 'active' : ''}" data-action="play-mode" data-value="casual">
                  <span class="mode-icon">${ICONS.play}</span>
                  <span class="mode-name">Casual</span>
                  <span class="mode-desc">Créditos e XP a cada partida. Sem pressão no MMR.</span>
                  <span class="mode-check"></span>
                </button>
                <button class="mode-card ${f.mode === 'ranked' ? 'active' : ''}" data-action="play-mode" data-value="ranked">
                  <span class="mode-icon">${ICONS.trophy}</span>
                  <span class="mode-name">Ranqueada local</span>
                  <span class="mode-desc">Valendo MMR offline. Seu ranque: ${rankOff.name}.</span>
                  <span class="mode-check"></span>
                </button>
                <button class="mode-card" data-action="online-ai">
                  <span class="mode-icon">${ICONS.wifi}</span>
                  <span class="mode-name">Treino online</span>
                  <span class="mode-desc">Ranqueada online contra IA enquanto espera um amigo.</span>
                  <span class="mode-check"></span>
                </button>
              </div>

              <div class="card opt-card">
                <div class="opt-row" style="margin-bottom:14px">
                  <span class="opt-label">Formato</span>
                  <div class="seg">
                    ${[1, 2, 3].map((n) => `<button class="${f.teamSize === n ? 'active' : ''}" data-action="play-opt" data-key="teamSize" data-value="${n}">${n}v${n}</button>`).join('')}
                  </div>
                </div>
                <div class="opt-row" style="margin-bottom:14px">
                  <span class="opt-label">Dificuldade</span>
                  <div class="seg">
                    ${diffNames.map((d, i) => `<button class="${f.difficulty === i ? 'active' : ''}" data-action="play-opt" data-key="difficulty" data-value="${i}" ${f.mode === 'ranked' ? 'disabled style="opacity:.35"' : ''}>${d}</button>`).join('')}
                  </div>
                </div>
                <div class="opt-row" style="margin-bottom:14px">
                  <span class="opt-label">Duração</span>
                  <div class="seg">
                    ${[[120, '2 min'], [180, '3 min'], [300, '5 min']].map(([v, l]) => `<button class="${f.duration === v ? 'active' : ''}" data-action="play-opt" data-key="duration" data-value="${v}">${l}</button>`).join('')}
                  </div>
                </div>
                <div class="opt-row">
                  <span class="opt-label">Arena</span>
                  <div class="seg">
                    ${THEMES.map((t) => `<button class="${f.themeId === t.id ? 'active' : ''}" data-action="play-opt" data-key="themeId" data-value="${t.id}">${t.name}</button>`).join('')}
                  </div>
                </div>
                ${f.mode === 'ranked' ? `<div class="tip-card" style="margin-top:16px"><b>Ranqueada offline</b><p>Dificuldade ajustada ao seu MMR (${rankOff.name} • ${rankOff.mmr}). Vencer sobe a divisão; perder desce. O ranking online é separado.</p></div>` : ''}
              </div>

              <div class="card card-pad">
                <div class="card-title">Seu veículo</div>
                <div style="display:flex;align-items:center;gap:14px;margin-top:12px;flex-wrap:wrap">
                  <div class="car-swatch" style="--swatch-a:${car.paint.body};--swatch-b:${car.paint.accent};width:46px;height:46px;flex-basis:46px"></div>
                  <div style="flex:1;min-width:160px">
                    <div style="font-size:14px;font-weight:800">${car.name} <span style="font-size:9px;color:${RARITY[car.rarity].color};letter-spacing:1.5px">${car.rarity.toUpperCase()}</span></div>
                    <div style="font-size:10px;color:var(--muted);margin-top:2px">VEL ${car.stats.speed} • ACEL ${car.stats.accel} • MANUSEIO ${car.stats.handling} • BOOST ${car.stats.boost}</div>
                  </div>
                  <button class="btn sm" data-action="nav" data-nav="garage">Alterar</button>
                </div>
              </div>
            </div>

            <div class="play-side">
              <div class="card card-pad">
                <div class="card-title">Escalação</div>
                <div class="teams-lineup" style="margin-top:14px">
                  <div class="lineup-team"><span class="lineup-dot blue"></span><span class="lineup-label">AZUL</span><div class="lineup-chips">${lu.blue.map((n, i) => `<span class="lineup-chip ${i === 0 ? 'you' : 'bot'}">${n}</span>`).join('')}</div></div>
                  <div class="lineup-team"><span class="lineup-dot orange"></span><span class="lineup-label">LARANJA</span><div class="lineup-chips">${lu.orange.map((n) => `<span class="lineup-chip bot">${n}</span>`).join('')}</div></div>
                </div>
                <div class="divider"></div>
                <div class="arena-preview">
                  <div class="pitch"></div>
                  <span class="tag">ARENA SELECIONADA</span>
                  <span class="tag2">${theme.name}</span>
                </div>
              </div>
              <button class="btn primary full" data-action="start-offline" style="padding:16px">${icon('play')} Entrar na arena</button>
              <div class="hint-text" style="text-align:center">${f.mode === 'ranked' ? 'Ao vencer você ganha MMR offline e créditos.' : 'Vitória rende créditos extras e XP.'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---------- ONLINE ----------
  renderOnline() {
    const online = this.game.online;
    const hosting = online.status === 'hosting' || online.status === 'joining-wait';
    const rank = getRank(this.game.save.data.online.mmr);
    const statusKind = this.onlineStatusKind;
    return `
    <div class="screen panel-screen">
      <div class="shell">
        ${this.shellHead('Multijogador Online', '1v1 e 2v2 • conexão direta entre jogadores')}
        <div class="shell-body">
          <div class="online-layout">
            <div class="online-main" style="display:flex;flex-direction:column;gap:12px;min-width:0">
              <div class="online-cards">
                <div class="card online-card">
                  <h3>Criar sala</h3>
                  <p>Gere um código e envie para seu amigo. Vocês jogam direto, sem servidores de jogo.</p>
                  <div class="room-code ${!this.roomCode ? '' : 'waiting'}" id="room-code-box">${this.roomCode || '--- --'}</div>
                  <div style="display:flex;gap:8px">
                    <button class="btn ${this.roomCode ? 'ghost' : 'primary'} full" id="host-create-btn" data-action="${this.roomCode ? 'copy-code' : 'host-room'}">
                      ${this.roomCode ? `${icon('copy')} Copiar código` : `${icon('wifi')} Criar sala`}
                    </button>
                    ${this.roomCode ? `<button class="btn danger sm" data-action="cancel-room" title="Fechar sala">✕</button>` : ''}
                  </div>
                  ${this.roomCode ? `<div class="hint-text">Sala aberta. Aguardando um adversário conectar…</div>` : ''}
                </div>
                <div class="card online-card">
                  <h3>Entrar em sala</h3>
                  <p>Recebeu um código? Digite abaixo para entrar na partida do seu amigo.</p>
                  <input class="input-field code-input" id="room-code-input" maxlength="5" placeholder="ABC12" value="${this.codeField}" autocomplete="off" spellcheck="false" ${hosting ? 'disabled' : ''} />
                  <button class="btn full" data-action="join-room" ${hosting ? 'disabled' : ''}>${icon('arrow')} Entrar na arena</button>
                  <div class="hint-text">Códigos têm 5 caracteres. Use fones para aproveitar o áudio.</div>
                </div>
              </div>

              <div class="card card-pad">
                <div class="card-title">Formato da sala</div>
                <div class="opt-row" style="margin-top:14px;margin-bottom:12px">
                  <span class="opt-label">Times</span>
                  <div class="seg">
                    ${[1, 2].map((n) => `<button class="${this.onlineForm.teamSize === n ? 'active' : ''}" data-action="online-opt" data-key="teamSize" data-value="${n}" ${hosting ? 'disabled' : ''}>${n}v${n}${n === 2 ? ' + bots' : ''}</button>`).join('')}
                  </div>
                </div>
                <div class="opt-row" style="margin-bottom:12px">
                  <span class="opt-label">Duração</span>
                  <div class="seg">
                    ${[[120, '2 min'], [180, '3 min'], [300, '5 min']].map(([v, l]) => `<button class="${this.onlineForm.duration === v ? 'active' : ''}" data-action="online-opt" data-key="duration" data-value="${v}" ${hosting ? 'disabled' : ''}>${l}</button>`).join('')}
                  </div>
                </div>
                <div class="opt-row">
                  <span class="opt-label">Arena</span>
                  <div class="seg">
                    ${THEMES.map((t) => `<button class="${this.onlineForm.themeId === t.id ? 'active' : ''}" data-action="online-opt" data-key="themeId" data-value="${t.id}" ${hosting ? 'disabled' : ''}>${t.name}</button>`).join('')}
                  </div>
                </div>
              </div>

              <div class="status-line" id="online-status-line"><span class="status-dot ${statusKind}" id="online-status-dot"></span><span id="online-status-text">${this.onlineStatusText}</span></div>
            </div>

            <div class="online-side" style="display:flex;flex-direction:column;gap:12px">
              <div class="card card-pad">
                <div class="card-title">Ranque online</div>
                <div style="display:flex;align-items:center;gap:14px;margin-top:14px">
                  <div style="width:58px;height:58px;flex:0 0 58px">${rankEmblem(rank, 58)}</div>
                  <div style="flex:1;min-width:0">
                    <div style="font-family:var(--display);font-style:italic;font-size:18px;color:${rank.color}">${rank.name}</div>
                    <div style="font-size:10px;color:var(--muted);margin-top:2px">${rank.mmr} MMR • ${this.game.save.data.online.wins}V / ${this.game.save.data.online.losses}D</div>
                    <div class="rank-progress"><i style="width:${Math.round(rank.progress * 100)}%"></i></div>
                  </div>
                </div>
                <div class="divider"></div>
                <div style="display:flex;flex-direction:column;gap:11px">
                  <div class="tip-item"><span class="tip-num">1</span><span>Um jogador cria a sala e compartilha o código de 5 caracteres.</span></div>
                  <div class="tip-item"><span class="tip-num">2</span><span>O outro entra com o código. A partida começa automaticamente.</span></div>
                  <div class="tip-item"><span class="tip-num">3</span><span>O resultado vale MMR online para os dois pilotos.</span></div>
                </div>
              </div>

              <div class="net-workout">
                <div style="font-family:var(--display);font-style:italic;font-size:13px;letter-spacing:1px">TREINO RANQUEADO</div>
                <p style="font-size:10.5px;color:#b9a08c;line-height:1.5;margin:6px 0 11px">Sem um amigo disponível? Enfrente a IA em uma partida ranqueada online simulada e mantenha o ritmo.</p>
                <button class="btn full" data-action="online-ai">Jogar ranqueada vs IA</button>
              </div>

              <div class="card card-pad" style="padding:13px 16px">
                <div style="display:flex;gap:9px;align-items:flex-start">
                  <span style="color:var(--cyan);flex:0 0 auto">${icon('wifi')}</span>
                  <div class="hint-text" style="color:#8fa2bb">Conexão P2P (WebRTC). Para melhor estabilidade, use a mesma rede ou uma internet com NAT aberto. Se a sala não conectar, reabra a sala e tente novamente.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---------- GARAGE ----------
  renderGarage() {
    const sorted = [...CARS].sort((a, b) => {
      const ao = this.game.save.data.owned.includes(a.id) ? 0 : 1;
      const bo = this.game.save.data.owned.includes(b.id) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return a.price - b.price;
    });
    return `
    <div class="screen panel-screen">
      <div class="shell">
        ${this.shellHead('Garagem', `${this.game.save.data.owned.length} de ${CARS.length} carros na coleção`)}
        <div class="shell-body">
          <div class="garage-layout">
            <div class="car-list" id="car-list">${this.renderCarList(sorted)}</div>
            <div class="garage-view">
              <div class="preview-card card">
                <canvas id="car-preview-canvas"></canvas>
                <div class="preview-vignette"></div>
                <div class="preview-floor"></div>
                <div class="preview-badge">GARAGEM TURBO STRIKE</div>
                <div class="preview-rarity" id="preview-rarity"></div>
                <div class="preview-name" id="preview-name"></div>
                <div class="preview-actions" id="preview-actions"></div>
              </div>
              <div class="garage-detail">
                <div class="card card-pad" id="garage-detail"></div>
                <div class="card card-pad garage-buy" id="garage-buy"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  renderCarList(list) {
    return list.map((car) => {
      const owned = this.game.save.data.owned.includes(car.id);
      const equipped = this.game.save.data.car === car.id;
      const selected = this.garageSelected === car.id;
      const rar = RARITY[car.rarity];
      return `<button class="car-item ${selected ? 'active' : ''} ${equipped ? 'selected' : ''}" data-action="garage-select" data-car="${car.id}">
        <span class="car-swatch ${owned ? '' : 'locked'}" style="--swatch-a:${car.paint.body};--swatch-b:${car.paint.accent}"></span>
        <span class="car-item-main">
          <span class="car-item-name">${car.name}</span>
          <span class="car-item-sub" style="color:${rar.color}">${car.rarity} ${equipped ? '• EQUIPADO' : ''}</span>
        </span>
        <span class="car-item-side">${owned ? `<span class="car-owned">${equipped ? 'EM USO' : 'NA GARAGEM'}</span>` : car.price === 0 ? `<span class="car-price free">GRÁTIS</span><div class="car-lock">NÍVEL ${car.unlockLevel}</div>` : `<span class="car-price">${fmt(car.price)}</span><div class="car-lock">${icon('lock')}</div>`}</span>
      </button>`;
    }).join('');
  }

  afterGarageRender() {
    const canvas = document.getElementById('car-preview-canvas');
    if (!canvas) return;
    const def = CAR_BY_ID[this.garageSelected] || this.game.selectedCar;
    this.preview = new CarPreview(canvas);
    this.preview.setCar(def);
    this.preview.setVisible(true);
    this.updateGarageDetail();
  }

  updateGarageDetail() {
    const def = CAR_BY_ID[this.garageSelected] || this.game.selectedCar;
    const save = this.game.save.data;
    const owned = save.owned.includes(def.id);
    const equipped = save.car === def.id;
    const rar = RARITY[def.rarity];
    const previewName = document.getElementById('preview-name');
    const previewRarity = document.getElementById('preview-rarity');
    if (previewName) previewName.innerHTML = `<h2>${def.name}</h2><p>${def.tag} • ${def.rarity}</p>`;
    if (previewRarity) {
      previewRarity.textContent = def.rarity.toUpperCase();
      previewRarity.style.color = rar.color;
      previewRarity.style.borderColor = rar.color;
      previewRarity.style.background = rar.glow.replace('.4)', '.08)');
    }
    const detail = document.getElementById('garage-detail');
    if (detail) {
      detail.innerHTML = `
        <div class="card-title">Ficha técnica</div>
        <p class="card-sub" style="margin-bottom:14px">${def.desc}</p>
        <div class="stat-list">
          ${[['Velocidade', def.stats.speed], ['Aceleração', def.stats.accel], ['Manuseio', def.stats.handling], ['Boost', def.stats.boost]].map(([name, val]) => `
            <div class="stat-row"><span class="stat-name">${name}</span><span class="stat-track"><i style="width:${val}%"></i></span><span class="stat-val">${val}</span></div>
          `).join('')}
        </div>
        <div class="divider"></div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--dim);letter-spacing:1px"><span>CHASSI</span><span>${def.style.toUpperCase()} • HITBOX ${def.stats.boost > 85 ? 'PESADA' : def.stats.speed > 90 ? 'VELOZ' : 'EQUILIBRADA'}</span></div>`;
    }
    const buy = document.getElementById('garage-buy');
    if (buy) {
      let actionHtml = '';
      let priceHtml = '';
      if (owned) {
        priceHtml = `<div class="price-big free">GRÁTIS<small>DESBLOQUEADO</small></div>`;
        actionHtml = equipped
          ? `<button class="btn full" disabled>${icon('check')} Equipado</button>`
          : `<button class="btn primary full" data-action="equip-car">${icon('check')} Equipar carro</button>`;
      } else if (def.price === 0) {
        priceHtml = `<div class="price-big free">GRÁTIS<small>RECOMPENSA DE NÍVEL</small></div>`;
        actionHtml = `<button class="btn full" disabled>${icon('lock')} Alcance o nível ${def.unlockLevel}</button>`;
      } else {
        priceHtml = `<div class="price-big">${fmt(def.price)}<small>CRÉDITOS</small></div>`;
        actionHtml = `<button class="btn primary full" data-action="buy-car" ${save.credits < def.price ? 'disabled' : ''}>${icon('coin')} Comprar agora</button>`;
      }
      buy.innerHTML = `
        ${priceHtml}
        ${actionHtml}
        ${!owned && def.price > 0 ? `<div class="hint-text">${save.credits >= def.price ? `Você tem ${fmt(save.credits)} créditos.` : `Faltam ${fmt(def.price - save.credits)} créditos. Jogue partidas para ganhar.`}</div>` : `<div class="hint-text">Todos os carros têm desempenho único e são liberados permanentemente.</div>`}
        <div class="divider" style="margin:6px 0"></div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--dim);letter-spacing:1.5px;font-weight:800"><span>CRÉDITOS</span><span style="color:var(--gold)">${fmt(save.credits)}</span></div>
        <div class="hint-text">Vitórias, gols e defesas rendem créditos. Carros grátis são desbloqueados ao subir de nível.</div>`;
    }
    const list = document.getElementById('car-list');
    if (list) {
      const sorted = [...CARS].sort((a, b) => {
        const ao = save.owned.includes(a.id) ? 0 : 1;
        const bo = save.owned.includes(b.id) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return a.price - b.price;
      });
      list.innerHTML = this.renderCarList(sorted);
    }
    const wallet = this.root.querySelector('.wallet-pill span');
    if (wallet) wallet.textContent = fmt(save.credits);
  }

  selectGarageCar(id) {
    const def = CAR_BY_ID[id];
    if (!def) return;
    this.garageSelected = id;
    this.game.audio.ui('click');
    this.preview?.setCar(def);
    this.updateGarageDetail();
    this.root.querySelectorAll('.car-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.car === id);
    });
  }

  refreshGarageChrome() {
    this.updateGarageDetail();
  }

  // ---------- LEADERBOARD ----------
  renderLeaderboard() {
    const save = this.game.save.data;
    const tab = this.boardTab;
    const mmr = tab === 'online' ? save.online.mmr : save.offline.mmr;
    const rank = getRank(mmr);
    const rows = tab === 'online'
      ? buildLeaderboard(mmr, save.name, true)
      : buildLeaderboard(mmr, save.name, false).map((r, i) => ({ ...r, mmr: Math.round(r.mmr * 0.86) }));
    const myPos = rows.findIndex((r) => r.you) + 1;
    return `
    <div class="screen panel-screen">
      <div class="shell">
        ${this.shellHead('Ranking', 'Classificação da temporada')}
        <div class="shell-body">
          <div class="board-layout">
            <div class="card board-card">
              <div class="board-tabs">
                <button class="board-tab ${tab === 'online' ? 'active' : ''}" data-action="board-tab" data-value="online">Online</button>
                <button class="board-tab ${tab === 'offline' ? 'active' : ''}" data-action="board-tab" data-value="offline">Offline</button>
              </div>
              <div class="board-table">
                ${rows.map((row) => `
                  <div class="board-row ${row.you ? 'me' : ''}">
                    <span class="board-rank">${row.pos}</span>
                    <span class="board-name">${row.name} ${row.you ? '<span style="color:var(--cyan);font-size:8px;letter-spacing:1px">VOCÊ</span>' : ''}</span>
                    <span class="board-tier" style="color:${row.tier.color}">${row.tier.name}</span>
                    <span class="board-mmr">${fmt(row.mmr)}<small> MMR</small></span>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="board-side">
              <div class="card my-rank-card">
                <div class="my-rank-emblem">${rankEmblem(rank, 92)}</div>
                <div class="my-rank-title" style="color:${rank.color}">${rank.name}</div>
                <div class="my-rank-mmr">${fmt(mmr)} MMR • #${myPos || rows.length}</div>
                <div class="progress-wide"><i style="width:${Math.round(rank.progress * 100)}%"></i></div>
                <div class="my-rank-next">${rank.nextTier ? `${rank.mmrToNext} MMR para ${rank.nextTier}` : 'Topo absoluto da arena'}</div>
              </div>
              <div class="card card-pad">
                <div class="card-title">Estatísticas</div>
                <div class="profile-stats" style="margin-top:12px">
                  <div class="pstat"><b>${save.stats.matches}</b><span>Partidas</span></div>
                  <div class="pstat"><b>${save.stats.wins}</b><span>Vitórias</span></div>
                  <div class="pstat"><b>${save.stats.goals}</b><span>Gols</span></div>
                  <div class="pstat"><b>${save.stats.saves}</b><span>Defesas</span></div>
                  <div class="pstat"><b>${save.stats.demolitions}</b><span>Demolições</span></div>
                  <div class="pstat"><b>${fmt(Math.round(save.stats.boost))}</b><span>Boost usado</span></div>
                </div>
                <div class="divider"></div>
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:9px;letter-spacing:1.5px;color:var(--dim);font-weight:800">CONQUISTAS</span>
                  <span style="font-size:10px;color:var(--cyan);font-weight:800">${Object.keys(save.achievements).length}/${ACHIEVEMENTS.length}</span>
                </div>
                <div style="display:flex;gap:5px;margin-top:9px;flex-wrap:wrap">
                  ${ACHIEVEMENTS.map((a) => `<span title="${a.name}: ${a.desc}" style="width:22px;height:22px;display:grid;place-items:center;border:1px solid ${save.achievements[a.id] ? 'rgba(53,240,255,.4)' : 'rgba(255,255,255,.08)'};color:${save.achievements[a.id] ? 'var(--cyan)' : '#3c4759'};font-size:9px;background:${save.achievements[a.id] ? 'rgba(53,240,255,.06)' : 'transparent'}">${save.achievements[a.id] ? '★' : '·'}</span>`).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---------- SETTINGS ----------
  renderSettings() {
    const s = this.game.save.data.settings;
    const save = this.game.save.data;
    return `
    <div class="screen panel-screen">
      <div class="shell">
        ${this.shellHead('Ajustes', 'Controles, áudio e desempenho')}
        <div class="shell-body">
          <div class="settings-layout">
            <div class="card card-pad">
              <div class="card-title">Jogador</div>
              <div class="setting-item">
                <div class="setting-top"><span class="setting-name">Nome de piloto</span></div>
                <input class="input-field" id="player-name-input" maxlength="16" value="${save.name.replace(/"/g, '&quot;')}" />
                <div class="setting-hint">Aparece no placar e nas partidas online.</div>
              </div>
              <div class="setting-item">
                <div class="setting-top"><span class="setting-name">Volume geral</span><span id="volume-val" style="font-size:10px;color:var(--cyan);font-weight:800">${Math.round(s.volume * 100)}%</span></div>
                <input type="range" id="setting-volume" min="0" max="100" value="${Math.round(s.volume * 100)}" />
                <div class="setting-hint">Motor, impactos, torcida e efeitos.</div>
              </div>
              <div class="setting-item">
                <div class="setting-top"><span class="setting-name">Câmera padrão</span></div>
                <div class="seg">
                  <button class="${s.camera === 'ball' ? 'active' : ''}" data-action="set-camera" data-value="ball">Na bola</button>
                  <button class="${s.camera === 'car' ? 'active' : ''}" data-action="set-camera" data-value="car">No carro</button>
                </div>
              </div>
              <div class="setting-item">
                <div class="setting-top"><span class="setting-name">Qualidade gráfica</span></div>
                <div class="seg">
                  ${[['low', 'Baixa'], ['medium', 'Média'], ['high', 'Alta']].map(([v, l]) => `<button class="${s.quality === v ? 'active' : ''}" data-action="set-quality" data-value="${v}">${l}</button>`).join('')}
                </div>
                <div class="setting-hint">Reduza para ganhar FPS em máquinas mais modestas.</div>
              </div>
              <div class="setting-item">
                <div class="setting-top"><span class="setting-name">Tremor de tela</span></div>
                <div class="seg">
                  <button class="${s.shake !== false ? 'active' : ''}" data-action="set-shake" data-value="1">Ativado</button>
                  <button class="${s.shake === false ? 'active' : ''}" data-action="set-shake" data-value="0">Desativado</button>
                </div>
              </div>
            </div>

            <div class="card card-pad">
              <div class="card-title">Controles</div>
              <div class="control-table" style="margin-top:16px">
                <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Dirigir / virar</span>
                <span><kbd>ESPAÇO</kbd></span><span>Pular • segundo toque = flip</span>
                <span><kbd>SHIFT</kbd></span><span>Turbo (consome boost)</span>
                <span><kbd>CTRL</kbd></span><span>Drift / derrapagem</span>
                <span><kbd>C</kbd></span><span>Alternar câmera</span>
                <span><kbd>ESC</kbd></span><span>Pausar / menu</span>
                <span><kbd>Q</kbd><kbd>E</kbd></span><span>Rolar no ar</span>
              </div>
              <div class="divider"></div>
              <div class="card-title" style="margin-bottom:10px">Dados</div>
              <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin-bottom:4px"><span>Créditos</span><b style="color:var(--gold)">${fmt(save.credits)}</b></div>
              <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin-bottom:4px"><span>Ranque online</span><b style="color:var(--cyan)">${getRank(save.online.mmr).name}</b></div>
              <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin-bottom:10px"><span>Ranque offline</span><b style="color:var(--cyan)">${getRank(save.offline.mmr).name}</b></div>
              <div class="divider"></div>
              <button class="btn danger full" data-action="reset-save">${this.confirmReset ? 'Confirmar exclusão?' : 'Apagar progresso'}</button>
              <div class="hint-text" style="margin-top:8px">${this.confirmReset ? 'Clique novamente para apagar carros, créditos, ranking e estatísticas.' : 'Remove carros, créditos, ranques e estatísticas deste navegador.'}</div>
              <div class="divider"></div>
              <div class="hint-text">TURBO STRIKE v1.0 • WebGL • Jogo original de futebol de carros. Não afiliado à Psyonix/Rocket League.</div>
              <button class="btn ghost full sm" data-action="nav" data-nav="howto" style="margin-top:10px">Como jogar</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---------- HOW TO ----------
  renderHowTo() {
    return `
    <div class="screen panel-screen">
      <div class="shell">
        ${this.shellHead('Como Jogar', 'Tudo sobre a arena')}
        <div class="shell-body">
          <div class="howto-grid">
            <div class="card howto-card">
              <h3>Fundamentos</h3>
              <div class="howto-list">
                <div class="howto-item"><span class="howto-ic">${ICONS.play}</span><div><b>Acerte a bola, não o carro</b><p>Bata com o bico do carro para imprimir força. Quanto maior a velocidade e o boost, mais longe a bola vai.</p></div></div>
                <div class="howto-item"><span class="howto-ic">${ICONS.bolt}</span><div><b>Boost é vida</b><p>Pegue cápsulas amarelas (100) nos cantos e pequenas cápsulas ciano (12) pelo campo. Use SHIFT para acelerar a 200+ km/h.</p></div></div>
                <div class="howto-item"><span class="howto-ic">${ICONS.arrow}</span><div><b>Flip e voo</b><p>Pule com ESPAÇO e pule novamente no ar para dar um flip. Segure boost no ar para fazer jogadas aéreas.</p></div></div>
                <div class="howto-item"><span class="howto-ic">${ICONS.car}</span><div><b>Drift</b><p>Segure CTRL para derrapar em curvas fechadas sem perder tanta velocidade. Ótimo para defender.</p></div></div>
              </div>
            </div>
            <div class="card howto-card">
              <h3>Modos de jogo</h3>
              <div class="howto-list">
                <div class="howto-item"><span class="howto-ic">${ICONS.trophy}</span><div><b>Ranqueado</b><p>Vença para subir de divisão. Do Bronze à Lenda Supersônica. Ranking online e offline separados, com MMR.</p></div></div>
                <div class="howto-item"><span class="howto-ic">${ICONS.globe}</span><div><b>Online P2P</b><p>Crie uma sala ou entre com o código de um amigo. Partidas 1v1 e 2v2 com bots preenchendo os times.</p></div></div>
                <div class="howto-item"><span class="howto-ic">${ICONS.coin}</span><div><b>Economia</b><p>Gols, defesas, demolições e vitórias rendem créditos. Use-os na garagem. Carros grátis são liberados por nível.</p></div></div>
                <div class="howto-item"><span class="howto-ic">${ICONS.shield}</span><div><b>Defenda e demole</b><p>Fique entre a bola e seu gol. Em alta velocidade com boost, você pode demolir o rival por 2 segundos.</p></div></div>
              </div>
              <div class="tip-card"><b>Dica de ouro</b><p>No kickoff, alinhe o carro com a bola e segure boost. Depois do primeiro toque, gire para o lado da bola que aponta para o gol adversário.</p></div>
            </div>
            <div class="card howto-card">
              <h3>Controles de PC</h3>
              <div class="control-table">
                <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Acelerar, frear e virar</span>
                <span><kbd>ESPAÇO</kbd></span><span>Pular e dar flip</span>
                <span><kbd>SHIFT</kbd></span><span>Turbo / boost</span>
                <span><kbd>CTRL</kbd></span><span>Drift</span>
                <span><kbd>C</kbd></span><span>Câmera bola / carro</span>
                <span><kbd>ESC</kbd></span><span>Pausar</span>
              </div>
              <div class="divider"></div>
              <h3>No celular</h3>
              <p style="font-size:10.5px;color:var(--muted);line-height:1.6">Use o direcional virtual à esquerda e os botões SALTAR / TURBO / DRIFT à direita. O jogo funciona em paisagem e retrato. Toque no botão II para pausar.</p>
              <div class="divider"></div>
              <h3>Controle (gamepad)</h3>
              <p style="font-size:10.5px;color:var(--muted);line-height:1.6">Conecte um controle USB/Bluetooth. Analógico esquerdo dirige, A pula, gatilho direito dá boost e LB faz drift.</p>
            </div>
            <div class="card howto-card">
              <h3>Regras da arena</h3>
              <div class="howto-list">
                <div class="howto-item"><span class="howto-ic">${ICONS.flag}</span><div><b>Kickoff 3•2•1</b><p>Cada partida começa com contagem regressiva. Após um gol, a bola volta ao centro.</p></div></div>
                <div class="howto-item"><span class="howto-ic">${ICONS.refresh}</span><div><b>Prorrogação</b><p>Empate no tempo normal leva à morte súbita: o primeiro gol vence.</p></div></div>
                <div class="howto-item"><span class="howto-ic">${ICONS.star}</span><div><b>Progressão</b><p>XP sobe seu nível, libera carros grátis e bônus de créditos. Conquistas dão recompensas extras.</p></div></div>
              </div>
              <div style="margin-top:16px"><button class="btn primary full" data-action="nav" data-nav="play">${icon('play')} Jogar agora</button></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ---------- actions ----------
  handleAction(action, el) {
    const game = this.game;
    game.audio.init();
    switch (action) {
      case 'nav':
        game.audio.ui('click');
        if (this.currentScreen === 'online' && (el.dataset.nav || 'home') !== 'online'
          && ['hosting', 'joining', 'joining-wait'].includes(game.online.status)) {
          game.cancelOnline();
        }
        this.showScreen(el.dataset.nav || 'home');
        break;
      case 'play-mode':
        this.playForm.mode = el.dataset.value;
        game.audio.ui('click');
        this.showScreen('play');
        break;
      case 'play-opt': {
        const key = el.dataset.key;
        const raw = el.dataset.value;
        this.playForm[key] = ['teamSize', 'difficulty', 'duration'].includes(key) ? Number(raw) : raw;
        game.audio.ui('click');
        this.showScreen('play');
        break;
      }
      case 'online-opt': {
        const key = el.dataset.key;
        const raw = el.dataset.value;
        this.onlineForm[key] = ['teamSize', 'duration'].includes(key) ? Number(raw) : raw;
        game.audio.ui('click');
        this.showScreen('online');
        break;
      }
      case 'start-offline': {
        const f = this.playForm;
        game.audio.ui('buy');
        if (f.mode === 'ranked') {
          game.startRankedAI({ teamSize: f.teamSize, duration: f.duration, themeId: f.themeId });
        } else {
          game.startOffline({ teamSize: f.teamSize, difficulty: f.difficulty, duration: f.duration, themeId: f.themeId, ranked: false });
        }
        break;
      }
      case 'ranked-quick':
        this.playForm.mode = 'ranked';
        game.audio.ui('click');
        this.showScreen('play');
        break;
      case 'online-ai':
        game.audio.ui('click');
        game.startRankedAI({ teamSize: 1, duration: 180, themeId: this.onlineForm.themeId });
        break;
      case 'host-room':
        game.audio.ui('click');
        game.hostRoom({ ...this.onlineForm });
        break;
      case 'cancel-room':
        game.audio.ui('back');
        game.cancelOnline();
        break;
      case 'join-room': {
        const input = document.getElementById('room-code-input');
        const code = (input?.value || this.codeField || '').trim().toUpperCase();
        if (code.length < 4) {
          this.toast('Código inválido', 'Digite os 5 caracteres do código da sala.', 'orange');
          game.audio.ui('error');
          break;
        }
        game.audio.ui('click');
        game.joinRoom(code);
        break;
      }
      case 'copy-code':
        if (game.online.code) {
          navigator.clipboard?.writeText(game.online.code).then(() => {
            this.toast('Código copiado', `Envie "${game.online.code}" para seu amigo.`, 'cyan');
          }).catch(() => this.toast('Código da sala', game.online.code, 'cyan'));
        }
        break;
      case 'garage-select':
        this.selectGarageCar(el.dataset.car);
        break;
      case 'equip-car':
        game.selectCar(this.garageSelected);
        this.updateGarageDetail();
        break;
      case 'buy-car':
        if (game.buyCar(this.garageSelected)) {
          this.updateGarageDetail();
          this.syncWallet();
        }
        break;
      case 'board-tab':
        this.boardTab = el.dataset.value;
        game.audio.ui('click');
        this.showScreen('leaderboard');
        break;
      case 'set-camera':
        game.applySetting('camera', el.dataset.value);
        game.audio.ui('click');
        this.showScreen('settings');
        break;
      case 'set-quality':
        game.applySetting('quality', el.dataset.value);
        game.audio.ui('click');
        this.showScreen('settings');
        break;
      case 'set-shake':
        game.applySetting('shake', el.dataset.value === '1');
        game.audio.ui('click');
        this.showScreen('settings');
        break;
      case 'reset-save':
        if (this.confirmReset) {
          game.save.reset();
          this.confirmReset = false;
          this.garageSelected = game.save.data.car;
          game.audio.ui('levelup');
          this.toast('Progresso apagado', 'Uma nova carreira começa agora.', 'orange');
          this.showScreen('home');
        } else {
          this.confirmReset = true;
          game.audio.ui('error');
          this.showScreen('settings');
          setTimeout(() => { if (this.confirmReset) { this.confirmReset = false; if (this.currentScreen === 'settings') this.showScreen('settings'); } }, 4000);
        }
        break;
      case 'resume':
        game.closePause();
        break;
      case 'quit':
        game.quitMatch();
        break;
      case 'rematch':
        if (this.resultData?.online) game.requestRematch();
        else game.requestRematch();
        break;
      case 'menu':
        game.quitMatch();
        break;
      case 'close-results':
        this.hideResults();
        break;
      default:
        break;
    }
  }

  handleSegment(el) {
    const key = el.dataset.seg;
    const value = el.dataset.value;
    if (!key) return;
    if (key.startsWith('play')) {
      this.playForm[key.replace('play-', '')] = value;
    }
  }

  syncWallet() {
    const pill = this.root.querySelector('.wallet-pill span');
    if (pill) pill.textContent = fmt(this.game.save.data.credits);
  }

  // ---------- HUD ----------
  setHUD(visible) {
    this.hudVisible = visible;
    this.hud.classList.toggle('hidden', !visible);
    if (!visible) this.game.input.setTouchVisible(false);
  }

  setTouchVisible(v) {
    this.game.input.setTouchVisible(v && this.hudVisible);
  }

  setScore(score) {
    if (!score) return;
    const b = this.hudElements.scoreBlue;
    const o = this.hudElements.scoreOrange;
    if (b) b.textContent = score[0];
    if (o) o.textContent = score[1];
  }

  setBlueLabel(name) {
    this.blueLabel = name;
    if (this.hudElements?.blueSub) this.hudElements.blueSub.textContent = name || 'AZUL';
  }

  setOrangeLabel(name) {
    this.orangeLabel = name;
    if (this.hudElements?.orangeSub) this.hudElements.orangeSub.textContent = name || 'LARANJA';
  }

  updateHUD(world, car, opts = {}) {
    if (!this.hudVisible || !world) return;
    const el = this.hudElements;
    if (!el) return;
    if (el.scoreBlue.textContent !== String(world.score[0])) el.scoreBlue.textContent = world.score[0];
    if (el.scoreOrange.textContent !== String(world.score[1])) el.scoreOrange.textContent = world.score[1];
    const timeStr = world.overtime ? 'OT' : clock(world.matchTime);
    if (el.clock.textContent !== timeStr) el.clock.textContent = timeStr;
    el.clock.classList.toggle('overtime', !!world.overtime);
    const sub = world.phase === 'ended' ? 'FIM DE JOGO' : world.overtime ? 'PRORROGAÇÃO' : opts.mode === 'online-host' || opts.mode === 'online-guest' ? 'ONLINE • RANQUEADA' : (this.game.matchMeta?.ranked ? 'RANQUEADA LOCAL' : 'PARTIDA CASUAL');
    if (el.clockSub.textContent !== sub) el.clockSub.textContent = sub;
    if (car) {
      const speed = Math.hypot(car.vel.x, car.vel.z);
      const kmh = Math.round(speed * 7.4);
      if (el.speed.textContent !== String(kmh)) el.speed.textContent = kmh;
      const pct = Math.min(100, (speed / 44) * 100);
      el.speedFill.style.width = `${pct}%`;
      el.supersonic.classList.toggle('on', speed > 34 && car.boostActive);
      const boost = Math.round(car.boost);
      if (el.boostValue.textContent !== String(boost)) el.boostValue.textContent = boost;
      const circ = 2 * Math.PI * 50;
      el.boostFill.style.strokeDasharray = `${circ}`;
      el.boostFill.style.strokeDashoffset = `${circ * (1 - car.boost / 100)}`;
      el.boostFill.classList.toggle('low', car.boost < 25);
      if (this.pips) {
        [...this.pips.children].forEach((pip, i) => pip.classList.toggle('on', car.boost >= (i + 1) * 10 - 5));
      }
    }
    if (opts.hints !== undefined) el.hintBar.style.opacity = opts.hints ? '1' : '0';
    if (this.blueLabel !== el.blueSub.textContent) el.blueSub.textContent = this.blueLabel;
    if (this.orangeLabel !== el.orangeSub.textContent) el.orangeSub.textContent = this.orangeLabel;
  }

  showBanner(text, cls = '', duration = 1200) {
    const banner = this.hudElements?.banner;
    if (!banner) return;
    clearTimeout(this.bannerTimeout);
    banner.textContent = text;
    banner.className = 'banner';
    void banner.offsetWidth;
    banner.className = `banner show ${cls}`;
    if (duration > 0) {
      this.bannerTimeout = setTimeout(() => { banner.className = `banner ${cls}`; }, duration);
    }
  }

  flash(color = 'blue') {
    const el = document.getElementById('flash');
    if (!el) return;
    el.style.background = color === 'orange'
      ? 'radial-gradient(circle at 50% 55%, rgba(255,240,220,.95), rgba(255,140,50,.28) 45%, transparent 70%)'
      : 'radial-gradient(circle at 50% 55%, rgba(240,255,255,.95), rgba(80,220,255,.28) 45%, transparent 70%)';
    el.classList.add('on');
    clearTimeout(this.flashTimeout);
    this.flashTimeout = setTimeout(() => el.classList.remove('on'), 220);
  }

  // ---------- results / pause ----------
  showResults(result) {
    this.resultData = result;
    const title = result.draw ? 'EMPATE' : result.won ? 'VITÓRIA' : 'DERROTA';
    const titleClass = result.draw ? 'draw' : result.won ? 'win' : 'loss';
    const stats = result.stats || {};
    const rankHtml = result.ranked && result.rankBefore ? `
      <div class="rank-delta">
        <div class="rank-delta-top">
          <div>
            <div class="rd-label">RANQUE ${result.online ? 'ONLINE' : 'OFFLINE'}</div>
            <div style="font-size:12px;font-weight:800;margin-top:3px;color:${result.rankAfter.color}">${result.rankAfter.name}</div>
          </div>
          <div class="rd-value ${result.delta > 0 ? 'up' : result.delta < 0 ? 'down' : ''}">${result.delta > 0 ? '+' : ''}${result.delta} MMR</div>
        </div>
        <div class="rank-track"><i class="old" style="width:${Math.round(result.rankBefore.progress * 100)}%"></i><i class="new" style="width:${Math.round(result.rankAfter.progress * 100)}%"></i></div>
        <div class="rank-sub"><span>${result.rankBefore.name} • ${result.rankBefore.mmr}</span><span>${result.rankAfter.mmr} MMR</span></div>
      </div>` : '';
    const modeLabel = result.online ? 'PARTIDA ONLINE' : result.ranked ? 'RANQUEADA LOCAL' : 'PARTIDA CASUAL';
    this.resultsEl.innerHTML = `
      <div class="result-card">
        <div class="result-top">
          <div>
            <div class="result-eyebrow">${modeLabel} • ${result.overtime ? 'PRORROGAÇÃO' : 'TEMPO NORMAL'}</div>
            <div class="result-title ${titleClass}">${title}</div>
          </div>
          <div style="text-align:right">
            <div class="result-score"><span class="b">${result.score[0]}</span><span class="x">×</span><span class="o">${result.score[1]}</span></div>
            <div class="result-tag">${result.draw ? 'TEMPO ESGOTADO' : result.won ? 'PONTOS NA CONTA' : 'REVANCHE?' }</div>
          </div>
        </div>
        <div class="result-grid">
          <div class="result-stat"><span class="rs-ic">${ICONS.coin}</span><div><b>+${fmt(result.credits)}</b><span>CRÉDITOS</span></div></div>
          <div class="result-stat"><span class="rs-ic cyan">${ICONS.bolt}</span><div><b>+${fmt(result.xp)}</b><span>XP • NÍVEL ${result.level}</span></div></div>
          <div class="result-stat"><span class="rs-ic cyan">${ICONS.flag}</span><div><b>${stats.goals || 0}</b><span>GOLS • ${stats.saves || 0} DEFESAS</span></div></div>
          <div class="result-stat"><span class="rs-ic">${ICONS.trophy}</span><div><b>${result.online ? result.opponentName : `${stats.demos || 0} demos`}</b><span>${result.online ? 'ADVERSÁRIO' : 'DEMOLIÇÕES'}</span></div></div>
        </div>
        ${rankHtml}
        <div class="level-up ${result.levelUps > 0 ? 'show' : ''}">NÍVEL ${result.level} • +${fmt(result.levelBonus)} CRÉDITOS DE BÔNUS</div>
        <div class="result-actions">
          <button class="btn primary" data-action="rematch" ${result.rematchEnabled ? '' : 'disabled'}>${ICONS.refresh} ${result.online ? (result.mode === 'online-guest' ? 'Pedir revanche' : 'Revanche') : 'Revanche'}</button>
          <button class="btn" data-action="menu">Menu principal</button>
        </div>
        ${result.online ? '<div class="hint-text" style="text-align:center;margin-top:10px">A revanche reinicia a partida com o mesmo adversário.</div>' : ''}
      </div>`;
    this.resultsEl.classList.add('active');
    this.hidePause();
  }

  hideResults() {
    this.resultsEl?.classList.remove('active');
  }

  showPause({ online = false } = {}) {
    this.pauseOnline = online;
    this.pauseEl.innerHTML = `
      <div class="result-card pause-card">
        <div class="result-eyebrow">${online ? 'PARTIDA ONLINE' : 'PARTIDA PAUSADA'}</div>
        <div class="result-title" style="font-size:42px">${online ? 'ATENÇÃO' : 'PAUSA'}</div>
        <p style="font-size:11px;color:var(--muted);margin-top:10px;line-height:1.6">${online ? 'No online a partida continua em andamento. Você pode voltar ou abandonar a sala.' : 'Respire, ajuste as mãos e volte para a arena quando quiser.'}</p>
        <div class="pause-menu">
          <button class="btn primary" data-action="resume">${ICONS.play} Continuar</button>
          <button class="btn danger" data-action="quit">Abandonar partida</button>
        </div>
      </div>`;
    this.pauseEl.classList.add('active');
  }

  hidePause() {
    this.pauseEl?.classList.remove('active');
  }

  // ---------- online DOM helpers ----------
  setOnlineStatus(text, kind = 'idle') {
    this.onlineStatusText = text;
    this.onlineStatusKind = kind;
    const t = document.getElementById('online-status-text');
    const d = document.getElementById('online-status-dot');
    if (t) t.textContent = text;
    if (d) {
      d.className = `status-dot ${kind === 'on' ? 'on' : kind === 'error' ? 'warn' : kind === 'warn' ? 'warn' : ''}`;
    }
  }

  setRoomCode(code) {
    this.roomCode = code || '';
    const box = document.getElementById('room-code-box');
    if (box) {
      box.textContent = this.roomCode || '--- --';
      box.classList.toggle('waiting', !!this.roomCode);
    }
    const btn = document.getElementById('host-create-btn');
    if (btn) {
      btn.dataset.action = this.roomCode ? 'copy-code' : 'host-room';
      btn.innerHTML = this.roomCode ? `${ICONS.copy} Copiar código` : `${ICONS.wifi} Criar sala`;
      btn.classList.toggle('primary', !this.roomCode);
      btn.classList.toggle('ghost', !!this.roomCode);
    }
    if (!this.roomCode) this.onlineWaiting = false;
  }

  setOnlineWaiting(waiting) {
    this.onlineWaiting = waiting;
    const joinBtn = this.root.querySelector('[data-action="join-room"]');
    if (joinBtn) joinBtn.disabled = waiting;
    const input = document.getElementById('room-code-input');
    if (input) input.disabled = waiting;
  }

  flushOnlineFields() {
    this.updateOnlineDom();
  }

  updateOnlineDom() {
    const t = document.getElementById('online-status-text');
    if (t) t.textContent = this.onlineStatusText;
    const d = document.getElementById('online-status-dot');
    if (d) d.className = `status-dot ${this.onlineStatusKind === 'on' ? 'on' : this.onlineStatusKind === 'error' || this.onlineStatusKind === 'warn' ? 'warn' : ''}`;
    if (this.currentScreen === 'online') {
      const box = document.getElementById('room-code-box');
      if (box) { box.textContent = this.roomCode || '--- --'; box.classList.toggle('waiting', !!this.roomCode); }
      const btn = document.getElementById('host-create-btn');
      if (btn) {
        const wanted = this.roomCode ? 'copy-code' : 'host-room';
        if (btn.dataset.action !== wanted) {
          btn.dataset.action = wanted;
          btn.innerHTML = this.roomCode ? `${ICONS.copy} Copiar código` : `${ICONS.wifi} Criar sala`;
          btn.classList.toggle('primary', !this.roomCode);
          btn.classList.toggle('ghost', !!this.roomCode);
        }
      }
      const joinBtn = this.root.querySelector('[data-action="join-room"]');
      if (joinBtn) joinBtn.disabled = this.onlineWaiting;
    }
  }

  // ---------- toast ----------
  toast(title, text, kind = 'cyan') {
    if (!this.toastRoot) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    const iconChar = kind === 'gold' ? '★' : kind === 'orange' ? '!' : kind === 'cyan' ? '⚡' : '•';
    el.innerHTML = `<span class="t-icon" style="color:${kind === 'gold' ? 'var(--gold)' : kind === 'orange' ? 'var(--orange)' : 'var(--cyan)'}">${iconChar}</span><div><b>${title}</b>${text ? `<span>${text}</span>` : ''}</div>`;
    this.toastRoot.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 350);
    }, 4600);
  }
}
