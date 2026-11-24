import { makeCanvas, W, H } from './pixel.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { Save } from './save.js';
import { TitleArt } from './titleArt.js';
import { buildArenaBackdrop } from './battleArt.js';
import { MenuScene } from './menu.js';
import { GameScene } from './game.js';

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.frame = document.getElementById('frame');
    this.stage = document.getElementById('stage');
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    this.transition = null;
    this.scene = null;
    this.last = 0;
    this.acc = 0;
    this.running = true;
    this.audioReady = false;
    this.settingsApplied = false;
    this.audio = audio;
    this.input = input;
    this.save = Save;
  }

  boot() {
    Save.load();
    this.applySettings();
    document.body.classList.toggle('crt-on', !!Save.settings.crt);
    this.titleArt = new TitleArt();
    this.arenaBackdrop = buildArenaBackdrop();
    this.ctx.imageSmoothingEnabled = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));

    input.init(this.canvas);
    this.canvas.addEventListener('pointerdown', () => this.unlockAudio(), { passive: true });
    window.addEventListener('pointerdown', () => this.unlockAudio(), { passive: true });
    window.addEventListener('touchstart', () => {
      if (!this.isTouch) {
        this.isTouch = true;
        this.resize();
      }
      this.unlockAudio();
    }, { passive: true });
    window.addEventListener('keydown', () => this.unlockAudio());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        audio.ctx?.suspend?.();
        if (this.scene instanceof GameScene && this.scene.status === 'playing') this.scene.paused = true;
      } else {
        audio.ctx?.resume?.();
      }
    });

    this.toMenu(true);
    requestAnimationFrame((t) => this.loop(t));
  }

  unlockAudio() {
    if (!audio.ensure()) return;
    audio.setVolume(Save.settings.volume);
    if (!this.audioReady) {
      this.audioReady = true;
      this.scene?.onAudioReady?.();
    }
  }

  applySettings() {
    audio.setVolume(Save.settings.volume);
    document.body.classList.toggle('crt-on', !!Save.settings.crt);
  }

  persistProgress() {
    Save.persist();
  }

  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const touchBar = this.isTouch ? 118 : 0;
    const availH = Math.max(160, vh - touchBar - 12);
    const availW = vw - 12;
    let scale = Math.min(availW / W, availH / H);
    if (scale > 1) scale = Math.floor(scale * 2) / 2; // keep pixel ratio tidy
    const w = Math.max(240, Math.round(W * scale));
    const h = Math.max(135, Math.round(H * scale));
    this.frame.style.width = `${w}px`;
    this.frame.style.height = `${h}px`;
    this.frame.style.transform = 'translateY(0)';
    // nudge the frame upward on touch devices so the controls have their own room
    if (this.isTouch && vh > vw) {
      this.stage.style.alignItems = 'flex-start';
      this.stage.style.paddingTop = `${Math.max(8, (availH - h) / 2)}px`;
    } else {
      this.stage.style.alignItems = 'center';
      this.stage.style.paddingTop = '0px';
    }
  }

  beginTransition(cb) {
    this.transition = { t: 0, dur: 0.85, cb, fired: false };
  }

  updateTransition(dt) {
    if (!this.transition) return;
    const tr = this.transition;
    tr.t += dt;
    if (!tr.fired && tr.t >= tr.dur * 0.48) {
      tr.fired = true;
      tr.cb?.();
    }
    if (tr.t >= tr.dur) this.transition = null;
  }

  drawTransition(ctx) {
    if (!this.transition) return;
    const { t, dur } = this.transition;
    const p = Math.min(1, t / dur);
    const mid = 0.48;
    const a = p < mid ? p / mid : 1 - (p - mid) / (1 - mid);
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.25);
    // pixelated blood wash: rows of splatter
    ctx.fillStyle = '#240406';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#6d1210';
    for (let y = 0; y < H; y += 2) {
      const w = (Math.sin(y * 0.23 + t * 20) * 0.5 + 0.5) * W;
      ctx.fillRect(0, y, w, 1);
    }
    ctx.fillStyle = '#180204';
    for (let y = 1; y < H; y += 3) ctx.fillRect(W - (Math.sin(y * 0.19 + t * 15) * 0.5 + 0.5) * W, y, W, 1);
    ctx.restore();
  }

  startGame(opts = {}) {
    audio.ensure();
    audio.setMode('battle');
    const scene = new GameScene(this, opts);
    scene.onAudioReady = () => audio.setMode('battle');
    this.setScene(scene);
  }

  toMenu(instant = false) {
    audio.setMode('menu');
    const scene = new MenuScene(this);
    scene.art = this.titleArt;
    scene.art.onThunder = () => audio.sfx('thunder');
    if (!this.settingsApplied) {
      scene.applySettings?.();
      this.settingsApplied = true;
    }
    this.setScene(scene);
    if (instant) {
      // prime the audio graph lazily on first gesture; nothing else to do
    }
  }

  setScene(scene) {
    this.scene = scene;
    this.transition = null;
    this.acc = 0;
  }

  loop(ts) {
    requestAnimationFrame((t) => this.loop(t));
    if (!this.last) this.last = ts;
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.05);

    input.pollGamepad();
    audio.tick(dt);
    this.update(dt);

    const touchPlay = this.isTouch
      && this.scene instanceof GameScene
      && this.scene.status === 'playing'
      && !this.scene.paused;
    document.body.classList.toggle('touch-play', touchPlay);

    this.render();
    input.endFrame();
  }

  update(dt) {
    this.updateTransition(dt);
    if (this.transition && this.transition.fired && this.scene) {
      // new scene already active; keep updating it
    }
    this.scene?.update(dt);
  }

  render() {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    this.scene?.render(ctx);
    this.drawTransition(ctx);
  }
}

const app = new App();
window.__ashes = app;
app.boot();
