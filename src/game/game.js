import * as THREE from 'three';
import { SaveStore, addXp, ACHIEVEMENTS, levelProgress } from '../core/save.js';
import { GameAudio } from '../core/audio.js';
import { Input } from '../core/input.js';
import { NetClient } from '../core/net.js';
import { Renderer } from './renderer.js';
import { World } from './physics.js';
import { makeBotController, difficultyLabel } from './bot.js';
import { ARENA } from './constants.js';
import { CARS, CAR_BY_ID, THEMES, TEAM, carPhysicalStats } from '../data/cars.js';
import { BOT_NAMES, getRank } from '../data/ranks.js';
import { UI } from '../ui/ui.js';

const IDLE_INPUT = { throttle: 0, steer: 0, boost: false, drift: false, jumpPressed: false, airRoll: 0 };
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Game {
  constructor(canvas) {
    this.save = new SaveStore();
    this.audio = new GameAudio(this.save.data.settings.volume);
    this.input = new Input();
    this.net = new NetClient();
    this.renderer = new Renderer(canvas, { quality: this.save.data.settings.quality });
    this.state = 'menu';
    this.mode = 'demo';
    this.world = null;
    this.localCarId = null;
    this.currentInput = { ...IDLE_INPUT };
    this.paused = false;
    this.pauseOverlay = false;
    this.acc = 0;
    this.lastT = performance.now();
    this.elapsed = 0;
    this.matchMeta = null;
    this.matchStats = null;
    this.matchFinished = false;
    this.pendingToasts = [];
    this.online = {
      status: 'idle',
      code: '',
      guestInfo: null,
      hostInfo: null,
      config: null,
      remoteInput: { ...IDLE_INPUT },
      guestJump: false,
      hostJump: false,
      lastSnapshot: null,
      snapTimer: 0,
      inputTimer: 0,
      rematchPending: false,
    };
    this.hudAccum = 0;
    this.hintsTimer = 0;
    this.boostPrev = null;
    this.demoThemeIndex = 0;
    this.lastConfig = null;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    this.checkFreeCars(true);
    const daily = this.save.claimDaily();
    if (daily > 0) this.pendingToasts.push({ title: 'Bônus diário', text: `+${daily} créditos por voltar à arena!`, kind: 'gold' });

    this.ui = new UI(this);
    this.setupDemo();
    this.input.onPause = () => this.handlePause();
    this.bindNetwork();
    this.bindInputExtras();
    if (this.isTouch) this.input.bindTouch();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    setTimeout(() => this.flushToasts(), 500);
    this.audio.setVolume(this.save.data.settings.volume);
    this.audio.startCrowd();
  }

  // ---------- boot / profile ----------
  checkFreeCars(silent = false) {
    const unlocked = [];
    for (const car of CARS) {
      if (car.price === 0 && car.unlockLevel > 0 && this.save.data.level >= car.unlockLevel && !this.save.data.owned.includes(car.id)) {
        this.save.ownCar(car.id);
        unlocked.push(car);
      }
    }
    if (!this.save.data.owned.includes(this.save.data.car)) this.save.data.car = 'falcon';
    if (unlocked.length) {
      this.save.flush();
      if (!silent) {
        for (const car of unlocked) this.ui?.toast('Carro grátis desbloqueado', `${car.name} já está na sua garagem!`, 'gold');
      }
    }
    return unlocked;
  }

  flushToasts() {
    while (this.pendingToasts.length) {
      const t = this.pendingToasts.shift();
      this.ui.toast(t.title, t.text, t.kind);
    }
  }

  applySetting(key, value) {
    this.save.data.settings[key] = value;
    this.save.save();
    if (key === 'volume') this.audio.setVolume(value);
    if (key === 'quality') this.renderer.setQuality(value);
    if (key === 'camera') this.renderer.cameraState.ballCam = value === 'ball';
  }

  setPlayerName(name) {
    const clean = String(name || '').replace(/[<>&]/g, '').trim().slice(0, 16) || 'Piloto';
    this.save.data.name = clean;
    this.save.save();
    this.ui.refresh();
  }

  // ---------- demo backdrop ----------
  setupDemo() {
    this.mode = 'demo';
    this.state = this.state === 'menu' ? 'menu' : this.state;
    this.localCarId = null;
    this.paused = false;
    this.pauseOverlay = false;
    this.matchFinished = false;
    const theme = THEMES[this.demoThemeIndex % THEMES.length];
    const carA = rand(CARS);
    let carB = rand(CARS);
    if (carB.id === carA.id) carB = CARS[(CARS.indexOf(carA) + 4) % CARS.length];
    const setups = [
      { id: 'demo-a', team: 0, def: carA, isBot: true, name: rand(BOT_NAMES), difficulty: 3 },
      { id: 'demo-b', team: 1, def: carB, isBot: true, name: rand(BOT_NAMES), difficulty: 3 },
    ];
    const world = new World({ carSetups: setups, theme, mode: 'demo', duration: 9999, teamSize: 1 });
    world.setController('demo-a', makeBotController(3, 'attacker', Math.floor(Math.random() * 999)));
    world.setController('demo-b', makeBotController(3, 'attacker', Math.floor(Math.random() * 999)));
    this.world = world;
    this.renderer.loadWorld(world);
    this.renderer.setCameraMode('menu');
    this.renderer.cameraState.ballCam = true;
    this.renderer.cameraState.shake = 0;
    this.audio.stopEngine();
    this.audio.updateEngine(0, 0, false, false, false, false);
    this.input.setPlaying(false);
    this.ui?.setHUD(false);
    this.ui?.setOnlineWaiting(false);
    if (this.ui) this.ui.refresh();
  }

  returnToMenu() {
    this.net.close();
    this.online.status = 'idle';
    this.online.code = '';
    this.online.guestInfo = null;
    this.online.rematchPending = false;
    this.state = 'menu';
    this.paused = false;
    this.pauseOverlay = false;
    this.matchFinished = false;
    this.setupDemo();
    this.ui.setRoomCode('');
    this.ui.setOnlineWaiting(false);
    this.ui.hideResults();
    this.ui.hidePause();
    this.ui.showScreen('home');
    this.ui.setHUD(false);
    this.ui.setTouchVisible(false);
    this.ui.refresh();
    this.audio.ui('back');
  }

  // ---------- offline ----------
  startOffline(config = {}) {
    const {
      teamSize = 1, difficulty = 2, duration = 180, themeId = 'neon', ranked = false, mode = 'offline',
    } = config;
    this.lastConfig = { ...config, teamSize, difficulty, duration, themeId, ranked, mode };
    this.net.close();
    this.mode = mode;
    this.state = 'playing';
    this.input.setPlaying(true);
    this.paused = false;
    this.pauseOverlay = false;
    this.matchFinished = false;
    this.hintsTimer = 0;
    this.boostPrev = null;
    this.audio.init();
    const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];
    const selected = CAR_BY_ID[this.save.data.car] || CARS[0];
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const setups = [{ id: 'local', team: 0, def: selected, isLocal: true, name: this.save.data.name }];
    const botNames = names.slice(0, Math.max(0, teamSize * 2 - 1));
    const usedCars = new Set([selected.id]);
    let ni = 0;
    const pickBotCar = () => {
      let car = rand(CARS);
      let guard = 0;
      while (usedCars.has(car.id) && guard++ < 10) car = rand(CARS);
      usedCars.add(car.id);
      return car;
    };
    for (let i = 1; i < teamSize; i++) {
      setups.push({ id: `ally-${i}`, team: 0, def: pickBotCar(), isBot: true, name: botNames[ni++] || 'Aliado', difficulty });
    }
    for (let i = 0; i < teamSize; i++) {
      setups.push({ id: `enemy-${i}`, team: 1, def: pickBotCar(), isBot: true, name: botNames[ni++] || 'Rival', difficulty });
    }
    const world = new World({ carSetups: setups, theme, mode, duration, teamSize });
    this.localCarId = 'local';
    world.setController('local', () => this.currentInput);
    let ai = 0;
    for (const car of world.cars) {
      if (car.isBot) {
        const role = car.team === 0 ? (teamSize > 1 ? 'defender' : 'attacker') : 'attacker';
        world.setController(car.id, makeBotController(difficulty, role, 100 + ai * 37 + Math.floor(Math.random() * 50)));
        ai++;
      }
    }
    this.attachWorld(world, { mode, ranked });
    this.ui.setHUD(true);
    this.ui.hideScreens();
    this.ui.setTouchVisible(this.isTouch);
    this.ui.showBanner('3', 'count', 900);
    this.audio.countdown(3);
    this.ui.refresh();
    this.audio.startEngine();
    this.audio.startCrowd();
    this.audio.crowdIntensity(0.15);
    this.ui.setBlueLabel(this.save.data.name);
    this.ui.setOrangeLabel(`${difficultyLabel(difficulty)} • IA`);
  }

  startRankedAI(config = {}) {
    const rank = getRank(this.save.data.offline.mmr);
    const difficulty = Math.min(4, Math.max(1, Math.floor((this.save.data.offline.mmr - 300) / 300) + 1));
    this.ui.toast(`Ranqueada local • ${rank.name}`, `${difficultyLabel(difficulty)} — valendo MMR offline`, 'orange');
    this.startOffline({ ...config, ranked: true, difficulty, mode: 'offline-ranked' });
  }

  attachWorld(world, meta = {}) {
    this.world = world;
    this.matchMeta = {
      ...meta,
      startedAt: performance.now(),
      duration: world.duration,
      localTeam: this.localCarId === 'guest' ? 1 : 0,
    };
    this.matchStats = { goals: 0, saves: 0, demos: 0, boost: 0, shots: 0 };
    this.acc = 0;
    this.matchFinished = false;
    this.renderer.loadWorld(world);
    this.renderer.setCameraMode('chase');
    this.renderer.cameraState.ballCam = this.save.data.settings.camera !== 'car';
    this.renderer.cameraState.goalFocus = 0;
    const car = world.cars.find((c) => c.id === this.localCarId || c.isLocal);
    if (car) {
      const f = new THREE.Vector3(Math.sin(car.yaw), 0, Math.cos(car.yaw));
      this.renderer.cameraState.pos.set(car.pos.x - f.x * 12, 4.8, car.pos.z - f.z * 12);
      this.renderer.cameraState.look.set(car.pos.x, 1.5, car.pos.z);
      this.renderer.cameraState.shake = 0;
      this.renderer.cameraState.fov = 70;
    }
    this.boostPrev = car ? car.boost : 33;
  }

  // ---------- camera / pause / input ----------
  bindInputExtras() {
    this.input.onPause = () => this.handlePause();
  }

  handlePause() {
    if (this.state === 'results') return;
    if (this.state !== 'playing') return;
    if (this.online.status === 'connected' && this.pauseOverlay) {
      this.closePause();
      return;
    }
    if (this.pauseOverlay) { this.closePause(); return; }
    this.pauseOverlay = true;
    const online = this.mode.startsWith('online');
    if (!online) this.paused = true;
    this.input.setPlaying(false);
    this.ui.showPause({ online });
    this.ui.setTouchVisible(false);
    this.audio.ui('click');
    if (!online) this.audio.updateEngine(0, 0, false, false, false, false);
  }

  closePause() {
    this.pauseOverlay = false;
    this.paused = false;
    this.ui.hidePause();
    this.ui.setTouchVisible(this.isTouch && this.state === 'playing');
    this.input.setPlaying(true);
    this.audio.ui('back');
  }

  quitMatch() {
    this.ui.hidePause();
    this.ui.hideResults();
    this.returnToMenu();
  }

  // ---------- online ----------
  async hostRoom(config = {}) {
    this.audio.init();
    this.online.config = {
      teamSize: config.teamSize || 1,
      duration: config.duration || 180,
      themeId: config.themeId || 'neon',
    };
    this.online.status = 'hosting';
    this.online.guestInfo = null;
    this.ui.setOnlineWaiting(true);
    this.ui.setOnlineStatus('Criando sala segura…', 'warn');
    try {
      const code = await this.net.createRoom();
      this.online.code = code;
      this.ui.setRoomCode(code);
      this.ui.setOnlineStatus('Sala pronta • aguardando adversário', 'on');
      this.ui.refresh();
    } catch (err) {
      this.online.status = 'error';
      this.ui.setOnlineStatus(`Não foi possível criar a sala: ${err?.message || err}`, 'error');
      this.ui.setOnlineWaiting(false);
      this.ui.toast('Falha ao criar sala', 'Verifique sua conexão e tente novamente.', 'orange');
    }
  }

  async joinRoom(code) {
    this.audio.init();
    this.online.status = 'joining';
    this.ui.setOnlineWaiting(true);
    this.ui.setOnlineStatus('Procurando a sala…', 'warn');
    try {
      await this.net.joinRoom(code);
      this.ui.setOnlineStatus('Conectado! Sincronizando partida…', 'on');
      this.net.send({
        type: 'hello',
        name: this.save.data.name,
        carId: this.save.data.car,
        mmr: this.save.data.online.mmr,
      });
      this.online.status = 'joining-wait';
    } catch (err) {
      this.online.status = 'error';
      this.ui.setOnlineWaiting(false);
      this.ui.setOnlineStatus(err?.message || 'Falha ao entrar na sala', 'error');
      this.ui.toast('Sala indisponível', err?.message || 'Confira o código e tente novamente.', 'orange');
    }
  }

  cancelOnline() {
    this.net.close();
    this.online.status = 'idle';
    this.online.code = '';
    this.online.guestInfo = null;
    this.ui.setOnlineWaiting(false);
    this.ui.setRoomCode('');
    this.ui.setOnlineStatus('Pronto para jogar online', 'on');
    this.ui.refresh();
  }

  bindNetwork() {
    this.net.on('status', (text) => {
      if (this.online.status === 'hosting' || this.online.status === 'joining') this.ui.setOnlineStatus(text, 'warn');
    });
    this.net.on('room', (code) => {
      this.online.code = code;
      this.ui.setRoomCode(code);
    });
    this.net.on('data', (data) => this.onNetData(data));
    this.net.on('guest', () => {
      this.ui.setOnlineStatus('Adversário conectado! Preparando kickoff…', 'on');
    });
    this.net.on('close', () => {
      if (['online-host', 'online-guest'].includes(this.mode) && this.state === 'playing') {
        this.ui.toast('Conexão encerrada', 'O adversário saiu da partida.', 'orange');
        this.ui.setOnlineWaiting(false);
        setTimeout(() => this.returnToMenu(), 600);
      } else {
        this.ui.setOnlineStatus('Conexão encerrada', 'error');
        this.ui.setOnlineWaiting(false);
      }
    });
    this.net.on('error', (msg) => {
      this.ui.setOnlineStatus(`Erro de rede: ${msg}`, 'error');
    });
  }

  onNetData(data) {
    if (!data || typeof data !== 'object') return;
    const hosting = this.mode === 'online-host' || this.online.status === 'hosting';
    if (hosting) {
      if (data.type === 'hello') {
        this.online.guestInfo = {
          name: String(data.name || 'Rival').slice(0, 16),
          carId: CAR_BY_ID[data.carId] ? data.carId : 'falcon',
          mmr: Number(data.mmr) || 600,
        };
        this.ui.setOnlineStatus(`Adversário: ${this.online.guestInfo.name}`, 'on');
        this.beginOnlineHostMatch();
      } else if (this.mode === 'online-host' && data.type === 'input' && data.input) {
        this.online.remoteInput = { ...IDLE_INPUT, ...data.input, jumpPressed: false };
      } else if (this.mode === 'online-host' && data.type === 'jump') {
        this.online.guestJump = true;
      } else if (this.mode === 'online-host' && data.type === 'rematch') {
        this.online.rematchPending = false;
        this.beginOnlineHostMatch();
      }
    } else if (this.mode === 'online-guest' || this.online.status === 'joining-wait') {
      if (data.type === 'welcome') {
        this.online.hostInfo = data;
        this.beginOnlineGuestMatch(data);
      } else if (data.type === 'snap') {
        if (this.world && this.mode === 'online-guest') {
          this.online.lastSnapshot = data;
          this.world.applySnapshot(data, 'guest');
        }
      } else if (data.type === 'goal') {
        if (this.world) {
          this.world.score = [...data.score];
          this.world.matchTime = data.time ?? this.world.matchTime;
          this.presentGoal(data.team, { name: data.scorer, ownGoal: data.ownGoal }, data.score);
        }
      } else if (data.type === 'end') {
        this.finishMatch(data.winner, { fromNet: true });
      } else if (data.type === 'event') {
        this.handleEvent(data.event);
      }
    }
  }

  beginOnlineHostMatch() {
    const guest = this.online.guestInfo;
    if (!guest) return;
    const cfg = this.online.config || { teamSize: 1, duration: 180, themeId: 'neon' };
    const theme = THEMES.find((t) => t.id === cfg.themeId) || THEMES[0];
    const hostDef = CAR_BY_ID[this.save.data.car] || CARS[0];
    const guestDef = CAR_BY_ID[guest.carId] || CARS[0];
    const teamSize = cfg.teamSize || 1;
    const setups = [
      { id: 'host', team: 0, def: hostDef, isLocal: true, name: this.save.data.name },
      { id: 'guest', team: 1, def: guestDef, isGuest: true, name: guest.name },
    ];
    const botDefs = [];
    const used = new Set([hostDef.id, guestDef.id]);
    const pick = () => {
      let c = rand(CARS); let g = 0;
      while (used.has(c.id) && g++ < 8) c = rand(CARS);
      used.add(c.id); return c;
    };
    for (let i = 1; i < teamSize; i++) {
      const def = pick();
      const name = rand(BOT_NAMES);
      setups.push({ id: `ally-${i}`, team: 0, def, isBot: true, name, difficulty: 3 });
      botDefs.push({ id: `ally-${i}`, team: 0, defId: def.id, name });
    }
    for (let i = 1; i < teamSize; i++) {
      const def = pick();
      const name = rand(BOT_NAMES);
      setups.push({ id: `guest-ally-${i}`, team: 1, def, isBot: true, name, difficulty: 3 });
      botDefs.push({ id: `guest-ally-${i}`, team: 1, defId: def.id, name });
    }
    const world = new World({ carSetups: setups, theme, mode: 'online-host', duration: cfg.duration, teamSize });
    this.localCarId = 'host';
    world.setController('host', () => this.currentInput);
    world.setController('guest', () => {
      if (this.online.guestJump) {
        this.online.guestJump = false;
        return { ...this.online.remoteInput, jumpPressed: true };
      }
      return this.online.remoteInput;
    });
    let ai = 1;
    for (const car of world.cars) {
      if (car.isBot) {
        world.setController(car.id, makeBotController(3, car.team === 0 ? 'defender' : 'attacker', 700 + ai * 41));
        ai++;
      }
    }
    this.net.send({
      type: 'welcome',
      hostName: this.save.data.name,
      hostCarId: hostDef.id,
      guestCarId: guestDef.id,
      guestName: guest.name,
      hostMmr: this.save.data.online.mmr,
      guestMmr: guest.mmr,
      teamSize,
      duration: cfg.duration,
      themeId: theme.id,
      bots: botDefs,
      rematch: this.matchFinished,
    });
    this.mode = 'online-host';
    this.state = 'playing';
    this.input.setPlaying(true);
    this.paused = false;
    this.pauseOverlay = false;
    this.matchFinished = false;
    this.ui.hideResults();
    this.ui.hidePause();
    this.ui.hideScreens();
    this.ui.setHUD(true);
    this.ui.setTouchVisible(this.isTouch);
    this.ui.setOnlineWaiting(false);
    this.attachWorld(world, { mode: 'online-host', ranked: true, online: true, opponentMmr: guest.mmr, guestName: guest.name });
    this.audio.startEngine();
    this.audio.startCrowd();
    this.audio.crowdIntensity(0.2);
    this.online.status = 'connected';
    this.ui.showBanner('3', 'count', 900);
    this.audio.countdown(3);
    this.ui.setBlueLabel(this.save.data.name);
    this.ui.setOrangeLabel(guest.name);
    this.ui.toast('Partida online', `${guest.name} entrou na arena.`, 'gold');
    this.ui.refresh();
  }

  beginOnlineGuestMatch(data) {
    const theme = THEMES.find((t) => t.id === data.themeId) || THEMES[0];
    const hostDef = CAR_BY_ID[data.hostCarId] || CARS[0];
    const guestDef = CAR_BY_ID[data.guestCarId] || CAR_BY_ID[this.save.data.car] || CARS[0];
    const teamSize = data.teamSize || 1;
    const bots = Array.isArray(data.bots) ? data.bots : [];
    const setups = [
      { id: 'host', team: 0, def: hostDef, name: data.hostName || 'Host', isBot: false },
      { id: 'guest', team: 1, def: guestDef, isLocal: true, name: this.save.data.name },
    ];
    for (const bot of bots) {
      const def = CAR_BY_ID[bot.defId] || CARS[0];
      setups.push({ id: bot.id, team: bot.team, def, isBot: true, name: bot.name, difficulty: 3 });
    }
    const world = new World({ carSetups: setups, theme, mode: 'online-guest', duration: data.duration || 180, teamSize, authorative: false });
    this.localCarId = 'guest';
    this.hostRemoteInput = { ...IDLE_INPUT };
    world.setController('guest', () => this.currentInput);
    world.setController('host', () => this.hostRemoteInput);
    this.mode = 'online-guest';
    this.state = 'playing';
    this.input.setPlaying(true);
    this.paused = false;
    this.pauseOverlay = false;
    this.matchFinished = false;
    this.ui.hideResults();
    this.ui.hidePause();
    this.ui.hideScreens();
    this.ui.setHUD(true);
    this.ui.setTouchVisible(this.isTouch);
    this.ui.setOnlineWaiting(false);
    this.attachWorld(world, {
      mode: 'online-guest',
      ranked: true,
      online: true,
      opponentMmr: Number(data.hostMmr) || 600,
      hostName: data.hostName || 'Host',
    });
    this.audio.startEngine();
    this.audio.startCrowd();
    this.audio.crowdIntensity(0.2);
    this.online.status = 'connected';
    this.ui.showBanner('3', 'count', 900);
    this.audio.countdown(3);
    this.ui.setBlueLabel(data.hostName || 'Host');
    this.ui.setOrangeLabel(this.save.data.name);
    this.ui.toast('Partida online', `Conectado à sala de ${data.hostName || 'Host'}.`, 'gold');
    this.ui.refresh();
  }

  requestRematch() {
    if (this.mode === 'online-host') {
      if (!this.net.connected) { this.returnToMenu(); return; }
      this.beginOnlineHostMatch();
    } else if (this.mode === 'online-guest') {
      if (!this.net.connected) { this.returnToMenu(); return; }
      this.net.send({ type: 'rematch' });
      this.ui.toast('Revanche solicitada', 'Aguardando o host iniciar a nova partida…', 'gold');
    } else if (this.lastConfig) {
      this.ui.hideResults();
      if (this.matchMeta?.ranked) this.startRankedAI({ ...this.lastConfig, ranked: true });
      else this.startOffline(this.lastConfig);
    }
  }

  // ---------- loop ----------
  loop(now) {
    requestAnimationFrame(this.loop);
    const rawDt = Math.min(0.05, Math.max(0, (now - this.lastT) / 1000));
    this.lastT = now;
    this.elapsed += rawDt;
    if (!this.world) return;

    if (this.state === 'menu') {
      this.acc += rawDt;
      const step = 1 / 120;
      let guard = 0;
      while (this.acc >= step && guard++ < 8) {
        this.world.step(step);
        this.acc -= step;
      }
      this.world.events.length = 0;
      this.renderer.update(rawDt, this.world, { cameraMode: 'menu' });
      return;
    }

    if (this.state === 'playing' || this.state === 'results') {
      const online = this.mode.startsWith('online');
      const running = this.state === 'playing' && (!this.pauseOverlay || online) && !this.matchFinished;
      if (this.state === 'playing' && !this.pauseOverlay) {
        this.currentInput = this.input.read();
        if (this.currentInput.cameraToggle) {
          this.renderer.toggleBallCam();
          this.ui.toast('Câmera', this.renderer.cameraState.ballCam ? 'Câmera na bola' : 'Câmera no carro', 'cyan');
        }
        if (online && this.mode === 'online-guest') {
          this.online.inputTimer += rawDt;
          if (this.online.inputTimer >= 0.033) {
            this.online.inputTimer = 0;
            this.net.send({
              type: 'input',
              input: {
                throttle: this.currentInput.throttle,
                steer: this.currentInput.steer,
                boost: this.currentInput.boost,
                drift: this.currentInput.drift,
                airRoll: this.currentInput.airRoll,
              },
            });
            if (this.currentInput.jumpPressed) this.net.send({ type: 'jump' });
          }
        }
        if (online && this.mode === 'online-host') {
          this.online.snapTimer += rawDt;
          if (this.online.snapTimer >= 0.05 && this.net.connected) {
            this.online.snapTimer = 0;
            const snap = this.world.getSnapshot({
              hi: {
                throttle: this.currentInput.throttle,
                steer: this.currentInput.steer,
                boost: this.currentInput.boost,
                drift: this.currentInput.drift,
                airRoll: this.currentInput.airRoll,
              },
            });
            this.net.send({ type: 'snap', ...snap });
          }
        }
      }

      if (running) {
        this.acc += rawDt;
        const step = 1 / 120;
        let guard = 0;
        this.world.events.length = 0;
        while (this.acc >= step && guard++ < 10) {
          this.world.step(step);
          this.currentInput.jumpPressed = false;
          if (this.online.guestJump) {
            // will be consumed next controller call
          }
          this.acc -= step;
        }
        if (this.acc > 0.25) this.acc = 0;
        this.processEvents();
        this.trackStats();
        // guest: feed host input from latest snapshot for prediction
        if (this.mode === 'online-guest' && this.online.lastSnapshot?.hi) {
          const hi = this.online.lastSnapshot.hi;
          this.hostRemoteInput = { ...this.hostRemoteInput, ...hi, jumpPressed: false };
          if (this.online.lastSnapshot.phase) this.world.phase = this.online.lastSnapshot.phase;
          if (Array.isArray(this.online.lastSnapshot.score)) this.world.score = [...this.online.lastSnapshot.score];
          if (typeof this.online.lastSnapshot.t === 'number') this.world.matchTime = this.online.lastSnapshot.t;
          if (this.online.lastSnapshot.overtime) this.world.overtime = true;
        }
      }
      this.updateHud(rawDt);
      this.updateEngineAudio();
      if (this.state === 'playing' && this.hintsTimer < 100) this.hintsTimer += rawDt;

      this.renderer.update(rawDt, this.world, {
        cameraMode: 'chase',
        carId: this.localCarId,
        paused: this.pauseOverlay,
      });
      if (this.mode === 'demo') return;
    }
  }

  trackStats() {
    const car = this.world.cars.find((c) => c.id === this.localCarId);
    if (car && this.boostPrev != null) {
      const used = this.boostPrev - car.boost;
      if (used > 0 && used < 5) this.matchStats.boost += used;
    }
    if (car) this.boostPrev = car.boost;
  }

  processEvents() {
    const events = this.world.events;
    if (!events.length) return;
    for (const event of events) {
      this.handleEvent(event);
    }
    events.length = 0;
  }

  handleEvent(event) {
    if (!event) return;
    const localCar = this.world?.cars.find((c) => c.id === this.localCarId);
    const near = event.pos && localCar
      ? Math.hypot(event.pos.x - localCar.pos.x, event.pos.z - localCar.pos.z) < 34
      : false;
    switch (event.type) {
      case 'hit': {
        this.renderer.handleEvent(event, this.world);
        if (near) this.audio.hit(event.power);
        if (this.mode.startsWith('online') && this.mode === 'online-host') {
          this.net.send({ type: 'event', event: { type: 'hit', pos: event.pos, power: event.power } });
        }
        break;
      }
      case 'jump': case 'flip': case 'land': case 'drift': {
        this.renderer.handleEvent(event, this.world);
        if (near) {
          if (event.type === 'jump') this.audio.jump();
          if (event.type === 'flip') this.audio.flip();
          if (event.type === 'land') this.audio.land();
        }
        break;
      }
      case 'boost': {
        this.renderer.handleEvent(event, this.world);
        if (event.carId === this.localCarId) this.audio.boostPickup(event.big);
        break;
      }
      case 'save': {
        if (event.carId === this.localCarId) {
          this.matchStats.saves += 1;
          this.ui.showBanner('DEFESA!', 'sub', 700);
        }
        break;
      }
      case 'demolish': {
        this.renderer.handleEvent(event, this.world);
        this.audio.demolish();
        if (event.attackerId === this.localCarId) this.matchStats.demos += 1;
        if (event.carId === this.localCarId) this.ui.showBanner('DEMOLIDO', 'loss', 1200);
        if (this.mode === 'online-host') this.net.send({ type: 'event', event: { type: 'demolish', pos: event.pos } });
        break;
      }
      case 'wallHit': case 'ballBounce': {
        if (near) this.audio.hit(Math.min(0.7, (event.power || 10) / 40));
        break;
      }
      case 'countdown': {
        this.ui.showBanner(String(event.n), 'count', 700);
        this.audio.countdown(event.n);
        break;
      }
      case 'go': {
        this.ui.showBanner('VAI!', 'goal', 600);
        this.audio.countdown(0);
        this.hintsTimer = 0;
        break;
      }
      case 'overtime': {
        this.ui.showBanner('PRORROGAÇÃO', 'goal', 1800);
        this.ui.toast('Prorrogação', 'O próximo gol decide a partida!', 'orange');
        break;
      }
      case 'goal': {
        this.presentGoal(event.team, event.scorer, this.world.score);
        if (this.mode === 'online-host') {
          this.net.send({
            type: 'goal',
            team: event.team,
            scorer: event.scorer?.name || '',
            ownGoal: event.scorer?.ownGoal,
            score: [...this.world.score],
            time: this.world.matchTime,
          });
        }
        break;
      }
      case 'end': {
        if (this.mode === 'online-host') {
          this.net.send({ type: 'end', winner: event.winner, score: event.score });
        }
        if (!this.matchFinished) this.finishMatch(event.winner, { fromNet: false });
        break;
      }
      default: break;
    }
  }

  presentGoal(team, scorer, score) {
    const localTeam = this.matchMeta?.localTeam ?? 0;
    const isLocalGoal = team === localTeam;
    const label = scorer?.ownGoal ? 'GOL CONTRA!' : isLocalGoal ? 'GOL!' : 'GOL SOFRIDO';
    this.ui.showBanner(label, `goal ${team === 1 ? 'orange' : ''}`, 2200);
    this.ui.flash(team === 0 ? 'blue' : 'orange');
    this.audio.goal(team === 0);
    this.renderer.handleEvent({ type: 'goal', team }, this.world);
    this.audio.crowdIntensity(0.75);
    setTimeout(() => this.audio.crowdIntensity(0.25), 2800);
    if (this.world) {
      this.world.score = [...score];
      this.ui.setScore(score);
    }
    if (scorer && scorer.carId && scorer.carId === this.localCarId && !scorer.ownGoal) {
      this.matchStats.goals += 1;
    }
  }

  updateHud(dt) {
    this.ui.updateHUD(this.world, this.world.cars.find((c) => c.id === this.localCarId), {
      ballCam: this.renderer.cameraState.ballCam,
      touch: this.isTouch,
      hints: this.hintsTimer < 14,
      mode: this.mode,
    });
    // screen labels
    const blue = this.world.cars.find((c) => c.team === 0 && !c.isBot);
    const orange = this.world.cars.find((c) => c.team === 1 && !c.isBot);
    if (blue) this.ui.setBlueLabel(blue.isLocal ? this.save.data.name : blue.name);
    if (orange) this.ui.setOrangeLabel(orange.isLocal ? `${this.save.data.name} (você)` : orange.name);
  }

  updateEngineAudio() {
    const car = this.world?.cars.find((c) => c.id === this.localCarId);
    if (!car) return;
    const speed = Math.hypot(car.vel.x, car.vel.z);
    this.audio.updateEngine(speed, car.lastInput?.throttle || 0, car.boostActive, car.drifting, !car.onGround, this.state === 'playing' && !this.pauseOverlay);
  }

  // ---------- end of match ----------
  finishMatch(winner, { fromNet = false } = {}) {
    if (this.matchFinished || !this.world) return;
    if (this.mode === 'demo') return;
    this.matchFinished = true;
    this.state = 'results';
    this.input.setPlaying(false);
    this.ui.setTouchVisible(false);
    const localTeam = this.matchMeta?.localTeam ?? 0;
    const won = winner === localTeam;
    const draw = winner === null || winner === undefined;
    const stats = this.matchStats || { goals: 0, saves: 0, demos: 0, boost: 0 };
    const meta = this.matchMeta || {};
    const ranked = !!meta.ranked;
    let rankBefore = null;
    let rankAfter = null;
    let delta = 0;
    if (ranked) {
      const isOnline = this.mode.startsWith('online');
      const board = isOnline ? this.save.data.online : this.save.data.offline;
      const beforeMmr = board.mmr;
      const opp = meta.opponentMmr ?? (isOnline ? 620 : 500 + (meta.difficulty || 2) * 260);
      const expected = 1 / (1 + 10 ** ((opp - beforeMmr) / 420));
      const scoreVal = draw ? 0.5 : won ? 1 : 0;
      const streakBonus = won && board.streak >= 2 ? 2 : 0;
      delta = Math.round(30 * (scoreVal - expected)) + streakBonus;
      delta = Math.max(-34, Math.min(36, delta));
      board.mmr = Math.max(0, beforeMmr + delta);
      if (won) { board.wins += 1; board.streak += 1; } else if (!draw) { board.losses += 1; board.streak = 0; }
      board.best = Math.max(board.best || 0, board.mmr);
      rankBefore = getRank(beforeMmr);
      rankAfter = getRank(board.mmr);
      this.save.data.bestRank = Math.max(this.save.data.bestRank || 0, board.mmr);
    }
    // rewards
    const winBonus = won ? 170 : draw ? 110 : 80;
    const rankedBonus = ranked ? 60 : 0;
    const onlineBonus = this.mode.startsWith('online') ? 80 : 0;
    let credits = winBonus + rankedBonus + onlineBonus + stats.goals * 18 + stats.saves * 12 + stats.demos * 15;
    let xp = (won ? 220 : draw ? 140 : 100) + stats.goals * 22 + stats.saves * 12 + stats.demos * 10;
    this.save.data.credits += credits;
    const levelRes = addXp(this.save.data, xp);
    if (levelRes.bonus) this.save.data.credits += levelRes.bonus;
    // stats
    const s = this.save.data.stats;
    s.matches += 1;
    if (won) s.wins += 1;
    s.goals += stats.goals;
    s.saves += stats.saves;
    s.demolitions += stats.demos;
    s.boost += Math.round(stats.boost);
    if (this.mode.startsWith('online')) {
      if (won) s.onlineWins = (s.onlineWins || 0) + 1;
    }
    this.save.flush();
    const unlockedCars = this.checkFreeCars(false);
    const achievements = this.save.checkAchievements();
    this.save.flush();

    if (won) { this.audio.win(); } else if (draw) { this.audio.whistle(); } else { this.audio.lose(); }
    this.audio.crowdIntensity(won ? 0.7 : 0.25);
    setTimeout(() => this.audio.crowdIntensity(0.12), 3200);
    this.audio.stopEngine();

    const result = {
      won, draw,
      score: [...this.world.score],
      localTeam,
      mode: this.mode,
      ranked,
      online: this.mode.startsWith('online'),
      opponentName: meta.guestName || meta.hostName || this.world.cars.find((c) => c.team !== localTeam && !c.isBot)?.name || 'Rival',
      duration: Math.round(this.world.duration - this.world.matchTime),
      stats,
      credits,
      xp,
      levelUps: levelRes.leveled,
      levelBonus: levelRes.bonus,
      rankBefore, rankAfter, delta,
      unlockedCars,
      achievements,
      overtime: this.world.overtime,
      level: this.save.data.level,
      xpProgress: levelProgress(this.save.data),
      rematchEnabled: this.mode.startsWith('online') ? this.net.connected : true,
    };
    this.ui.showResults(result);
    this.ui.refresh();
    this.online.rematchPending = false;
    for (const car of unlockedCars) {
      this.ui.toast('Carro grátis desbloqueado', `${car.name} está na garagem!`, 'gold');
      this.audio.ui('levelup');
    }
    for (const a of achievements) {
      this.ui.toast('Conquista desbloqueada', `${a.name} • +${a.reward} créditos`, 'gold');
    }
    this.ui.setHUD(false);
    this.ui.setOnlineWaiting(false);
  }

  // ---------- garage ----------
  buyCar(id) {
    const car = CAR_BY_ID[id];
    if (!car) return false;
    if (this.save.data.owned.includes(id)) {
      this.selectCar(id);
      return true;
    }
    if (car.unlockLevel > 0 && car.price === 0 && this.save.data.level < car.unlockLevel) {
      this.ui.toast('Ainda bloqueado', `Alcance o nível ${car.unlockLevel} para ganhar este carro grátis.`, 'orange');
      this.audio.ui('error');
      return false;
    }
    if (car.price > 0 && this.save.data.credits < car.price) {
      this.ui.toast('Créditos insuficientes', `Faltam ${(car.price - this.save.data.credits).toLocaleString('pt-BR')} créditos. Jogue partidas para ganhar mais.`, 'orange');
      this.audio.ui('error');
      return false;
    }
    if (car.price > 0) {
      this.save.data.credits -= car.price;
    }
    this.save.ownCar(id);
    this.save.data.car = id;
    this.save.flush();
    this.audio.ui('buy');
    this.ui.toast('Carro desbloqueado', `${car.name} adicionado à garagem.`, 'gold');
    this.save.checkAchievements().forEach((a) => this.ui.toast('Conquista desbloqueada', `${a.name} • +${a.reward} créditos`, 'gold'));
    this.ui.refresh();
    return true;
  }

  selectCar(id) {
    if (!this.save.data.owned.includes(id)) return false;
    this.save.data.car = id;
    this.save.flush();
    this.audio.ui('click');
    this.ui.toast('Carro equipado', `${CAR_BY_ID[id]?.name || id} selecionado.`, 'cyan');
    this.ui.refresh();
    return true;
  }

  get selectedCar() {
    return CAR_BY_ID[this.save.data.car] || CARS[0];
  }

  get rankOnline() { return getRank(this.save.data.online.mmr); }
  get rankOffline() { return getRank(this.save.data.offline.mmr); }
}
