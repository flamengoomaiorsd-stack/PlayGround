// Arena combat: waves of undead, harpies, and the Minotaur boss.
import { drawText, drawLogo, logoWidth, px, disc, ring, glow, clamp, lerp, measureText, W, H, makeCanvas, mulberry32 } from './pixel.js';
import { input } from './input.js';
import { Save } from './save.js';
import { audio } from './audio.js';
import {
  GROUND_Y, buildArenaBackdrop, drawKratos, drawLegionnaire, drawHarpy,
  drawMinotaur, line,
} from './battleArt.js';

const LEFT_BOUND = 34;
const RIGHT_BOUND = 446;
const GOLD = '#d9ab5c';
const GOLD_DIM = '#8a6534';
const CREAM = '#efe3cf';
const ASH = '#b9a99a';
const RED = '#a3221b';
const RED_DARK = '#6d1210';

const WAVES = [
  {
    title: 'AS CINZAS SE ERGUEM',
    sub: 'ONDA I',
    spawns: ['legionnaire', 'legionnaire', 'legionnaire'],
  },
  {
    title: 'SABUJOS DE HADES',
    sub: 'ONDA II',
    spawns: ['legionnaire', 'harpy', 'legionnaire', 'harpy', 'legionnaire'],
  },
  {
    title: 'A LEGIAO CAIDA',
    sub: 'ONDA III',
    spawns: ['legionnaire', 'legionnaire', 'harpy', 'legionnaire', 'harpy', 'legionnaire', 'legionnaire'],
  },
  {
    title: 'IRA DE ARES',
    sub: 'ONDA IV',
    spawns: ['harpy', 'legionnaire', 'legionnaire', 'harpy', 'legionnaire', 'legionnaire', 'harpy', 'legionnaire'],
  },
  {
    title: 'O MINOTAURO',
    sub: 'ONDA V',
    boss: true,
    spawns: ['minotaur', 'legionnaire', 'harpy', 'legionnaire', 'harpy'],
  },
];

const ENEMY_INFO = {
  legionnaire: { hp: 42, speed: 34, score: 90, radius: 28 },
  harpy: { hp: 28, speed: 42, score: 130, radius: 26 },
  minotaur: { hp: 340, speed: 26, score: 1400, radius: 46 },
};

function waveOf(n) {
  return WAVES[clamp(n - 1, 0, WAVES.length - 1)];
}

export class GameScene {
  constructor(app, opts = {}) {
    this.app = app;
    this.backdrop = app.arenaBackdrop;
    this.time = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.flash = 0;
    this.lightningIn = 8;
    this.lightning = 0;
    this.paused = false;
    this.pauseIndex = 0;
    this.status = 'playing';
    this.statusT = 0;
    this.overlayIndex = 0;
    this.statusRecorded = false;
    this.hintT = 11;
    this.arenaDecals = [];
    this.particles = [];
    this.orbs = [];
    this.texts = [];
    this.waves = [];
    this.pendingVictory = 0;

    const run = opts.resume ? Save.progress.run : null;
    this.enemies = [];
    this.shockwaves = [];
    this.toastT = 0;
    this.enemies = [];
    this.player = {
      x: 122,
      y: GROUND_Y,
      vy: 0,
      onGround: true,
      facing: 1,
      hp: run ? clamp(run.hp, 30, 100) : 100,
      maxHp: 100,
      rage: run ? clamp(run.rage || 0, 0, 100) : 0,
      state: 'idle',
      stateT: 0,
      walkPhase: 0,
      invuln: 0,
      dashT: 0,
      dashCd: 0,
      dashDir: 1,
      attackStep: 0,
      attackT: 0,
      attackDur: 0.24,
      attackHasHit: false,
      attackBuffer: 0,
      comboWindow: 0,
      hitFlash: 0,
      deadT: 0,
    };

    this.score = run ? run.score : 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.finished = false;
    this.damageTakenThisWave = false;
    this.ash = Array.from({ length: 46 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vy: 6 + Math.random() * 14,
      vx: -8 + Math.random() * 16,
      a: 0.15 + Math.random() * 0.35,
      s: Math.random() < 0.85 ? 1 : 2,
    }));

    const startWave = run ? clamp(run.wave, 1, 5) : 1;
    this.setupWave(startWave, true);
    audio.setMode('battle');
  }

  // ------------------------------------------------------------- wave logic
  setupWave(number, initial = false) {
    this.wave = number;
    const data = waveOf(number);
    this.spawnQueue = [...data.spawns];
    this.spawnTimer = 1.1;
    this.waveState = 'banner';
    this.waveTimer = initial ? 2.8 : 2.4;
    this.waveTitle = data.title;
    this.waveSub = data.sub;
    this.bannerT = this.waveTimer;
    this.bossSpawned = false;
    this.damageTakenThisWave = false;
    this.clearedBonus = 0;
    Save.checkpoint({
      wave: number,
      score: Math.floor(this.score),
      hp: Math.round(this.player.hp),
      rage: Math.round(this.player.rage),
    });
  }

  spawnEnemy(type) {
    const info = ENEMY_INFO[type];
    const fromLeft = Math.random() < 0.5;
    let x = fromLeft ? -22 : W + 22;
    let y = GROUND_Y;
    if (type === 'harpy') {
      x = fromLeft ? 40 : W - 40;
      y = 120 + Math.random() * 40;
    } else if (type === 'minotaur') {
      x = fromLeft ? 70 : W - 70;
    }
    const e = {
      type,
      x,
      y,
      vy: 0,
      hp: info.hp,
      maxHp: info.hp,
      speed: info.speed,
      facing: x < this.player.x ? 1 : -1,
      state: 'walk',
      stateT: 0,
      walkPhase: Math.random() * 6,
      seed: Math.random() * 6,
      attackCd: 0.9 + Math.random() * 0.8,
      hurtT: 0,
      hitFlash: 0,
      kb: 0,
      spawnT: 0.55,
      baseY: y,
      diveCd: 1.4 + Math.random(),
      deathT: 0,
      contactCd: 0,
      chargeDir: 0,
      chargeT: 0,
    };
    if (type === 'minotaur') {
      e.spawnT = 0.8;
      this.boss = e;
      this.bossSpawned = true;
      this.shake = Math.max(this.shake, 6);
    }
    this.enemies.push(e);
    this.enemies.sort((a, b) => a.y - b.y);
    this.shake = Math.max(this.shake, type === 'minotaur' ? 8 : 3);
    this.spawnSmoke(x, GROUND_Y - 4, type === 'minotaur' ? 26 : 10, true);
  }

  // --------------------------------------------------------------- particles
  addParticle(p) {
    if (this.particles.length > 340) this.particles.shift();
    this.particles.push(p);
  }

  spawnBlood(x, y, count = 8, dir = 0, power = 1) {
    if (!Save.settings.blood) return;
    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * 2.4;
      const sp = (20 + Math.random() * 90) * power;
      this.addParticle({
        type: 'blood',
        x, y,
        vx: Math.cos(a) * sp + dir * 30,
        vy: Math.sin(a) * sp - 40 * Math.random() * power,
        g: 420,
        life: 0.35 + Math.random() * 0.5,
        max: 0.85,
        size: Math.random() < 0.75 ? 1 : 2,
        color: Math.random() < 0.6 ? '#a3221b' : Math.random() < 0.5 ? '#6d1210' : '#c43622',
      });
    }
    this.addDecal(x + (Math.random() - 0.5) * 14, GROUND_Y + 3 + Math.random() * 18, 4 + Math.random() * 6);
  }

  spawnSpark(x, y, count = 6, dir = 0) {
    for (let i = 0; i < count; i++) {
      const a = dir + (Math.random() - 0.5) * 2.2;
      const sp = 40 + Math.random() * 120;
      this.addParticle({
        type: 'spark',
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 30,
        g: 320,
        life: 0.15 + Math.random() * 0.3,
        max: 0.45,
        size: 1,
        color: Math.random() < 0.5 ? '#ffd27a' : '#ff9d3a',
      });
    }
  }

  spawnFlame(x, y, count = 2, dir = 1) {
    for (let i = 0; i < count; i++) {
      this.addParticle({
        type: 'flame',
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: dir * (10 + Math.random() * 30) + (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 30,
        g: -30,
        life: 0.14 + Math.random() * 0.24,
        max: 0.38,
        size: Math.random() < 0.6 ? 1 : 2,
        color: Math.random() < 0.4 ? '#ffe6a0' : Math.random() < 0.6 ? '#ffab3c' : '#e0622a',
      });
    }
  }

  spawnSmoke(x, y, count = 6, big = false) {
    for (let i = 0; i < count; i++) {
      this.addParticle({
        type: 'smoke',
        x: x + (Math.random() - 0.5) * (big ? 50 : 16),
        y: y - Math.random() * (big ? 20 : 6),
        vx: (Math.random() - 0.5) * 26,
        vy: -12 - Math.random() * 24,
        g: -6,
        life: 0.6 + Math.random() * 0.8,
        max: 1.4,
        size: big ? 3 + Math.random() * 4 : 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#3a3233' : '#544948',
        soft: true,
      });
    }
  }

  addDecal(x, y, r) {
    this.arenaDecals.push({ x, y, r, seed: Math.random() * 100 });
    if (this.arenaDecals.length > 36) this.arenaDecals.shift();
  }

  addText(text, x, y, color = CREAM, size = 1) {
    this.texts.push({ text: String(text), x, y, color, size, life: 0.9, vy: -26 });
  }

  // --------------------------------------------------------------- combat
  startAttack(step = 0) {
    const p = this.player;
    p.state = 'attack';
    p.attackStep = step;
    p.attackT = 0;
    p.attackDur = step === 2 ? 0.34 : 0.24;
    p.attackHasHit = false;
    p.attackBuffer = 0;
    p.comboWindow = 0.5;
    p.stateT = 0;
    if (step === 0) p.vxLunge = 40;
    audio.sfx('swing');
  }

  startHeavy() {
    const p = this.player;
    p.state = 'heavy';
    p.attackT = 0;
    p.attackDur = 0.52;
    p.attackHasHit = false;
    p.stateT = 0;
    p.comboWindow = 0;
    audio.sfx('swing');
  }

  attackHit(step) {
    const p = this.player;
    const heavy = step === 3;
    const range = heavy ? 52 : step === 2 ? 44 : 38;
    const dmg = heavy ? 30 : step === 2 ? 20 : 12;
    const cy = p.y - 22;
    let hitAny = false;
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.spawnT > 0.2) continue;
      const ex = e.x;
      const ey = e.type === 'harpy' ? e.y : e.y - 16;
      const dx = (ex - p.x) * p.facing;
      if (dx < -6 || dx > range) continue;
      if (Math.abs(ey - cy) > (heavy ? 40 : 32)) continue;
      this.damageEnemy(e, dmg * (1 + Math.min(this.combo, 12) * 0.03), p.facing);
      hitAny = true;
    }
    if (hitAny) {
      this.hitstop = heavy ? 0.075 : 0.045;
      this.shake = Math.max(this.shake, heavy ? 7 : 3.4);
      this.spawnFlame(p.x + p.facing * 24, p.y - 26, 8, p.facing);
    } else {
      this.spawnFlame(p.x + p.facing * 22, p.y - 28, 3, p.facing);
    }
  }

  damageEnemy(e, dmg, dir) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.hurtT = 0.16;
    e.hitFlash = 0.18;
    e.kb = dir * (e.type === 'minotaur' ? 18 : 78);
    this.combo += 1;
    this.comboTimer = 2.6;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += Math.round(dmg * 1.6) + Math.min(this.combo, 20) * 2;
    this.player.rage = Math.min(100, this.player.rage + 3.5);
    const sx = e.type === 'harpy' ? e.x : e.x;
    const sy = e.type === 'harpy' ? e.y : e.y - 18;
    this.spawnBlood(sx, sy, 7, dir > 0 ? 0 : Math.PI, 0.9);
    this.spawnSpark(sx, sy, 5, dir > 0 ? 0 : Math.PI);
    audio.sfx('hit');
    if (e.type !== 'minotaur') {
      e.state = 'hurt';
      e.stateT = 0.22;
    } else if (e.hp > 0) {
      this.addText(Math.round(dmg), e.x, e.y - 62, '#ffd27a', 1);
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    e.state = 'dying';
    e.deathT = e.type === 'minotaur' ? 1.6 : 0.55;
    e.hp = 0;
    const info = ENEMY_INFO[e.type];
    this.kills += 1;
    this.score += info.score + this.combo * 5;
    this.spawnBlood(e.x, e.type === 'harpy' ? e.y : e.y - 16, 18, 0, 1.3);
    this.spawnSmoke(e.x, e.y - 10, e.type === 'minotaur' ? 14 : 5, e.type === 'minotaur');
    this.addDecal(e.x, GROUND_Y + 6 + Math.random() * 14, e.type === 'minotaur' ? 18 : 8);
    audio.sfx('enemyDie');
    this.shake = Math.max(this.shake, e.type === 'minotaur' ? 12 : 4);
    this.addText(`+${info.score}`, e.x, e.y - 40, '#ffd27a', 1);
    const orbCount = e.type === 'minotaur' ? 12 : 4;
    for (let i = 0; i < orbCount; i++) {
      this.orbs.push({
        x: e.x,
        y: (e.type === 'harpy' ? e.y : e.y - 14) - 4,
        vx: (Math.random() - 0.5) * 90,
        vy: -40 - Math.random() * 90,
        delay: 0.35 + Math.random() * 0.25,
        type: 'score',
        life: 8,
      });
    }
    if (Math.random() < 0.22 || e.type === 'minotaur') {
      this.orbs.push({
        x: e.x,
        y: e.y - 20,
        vx: (Math.random() - 0.5) * 40,
        vy: -60,
        delay: 0.6,
        type: 'hp',
        life: 10,
      });
    }
    const totalKills = Save.progress.kills + this.kills;
    if (totalKills >= 1) Save.unlock('firstblood');
    if (totalKills >= 25) Save.unlock('centurion');
    if (e.type === 'minotaur') {
      Save.unlock('titan');
      this.boss = null;
      this.spawnQueue.length = 0; // no more reinforcements after the boss falls
      this.pendingVictory = 1.4;
      this.flash = 0.8;
    }
  }

  hurtPlayer(dmg, fromX) {
    const p = this.player;
    if (p.invuln > 0 || p.dashT > 0 || this.status !== 'playing') return;
    p.hp -= dmg;
    p.invuln = 0.95;
    p.hitFlash = 0.3;
    p.state = 'hurt';
    p.stateT = 0.3;
    p.vy = -140;
    p.onGround = false;
    if (fromX !== undefined) p.x += (p.x > fromX ? 1 : -1) * 8;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 7;
    this.flash = 0.35;
    this.damageTakenThisWave = true;
    this.spawnBlood(p.x, p.y - 24, 14, 0, 1);
    audio.sfx('hurt');
    if (p.hp <= 0) {
      p.hp = 0;
      this.die();
    }
  }

  unleashRage() {
    const p = this.player;
    if (p.rage < 100) return;
    p.rage = 0;
    p.invuln = 1.0;
    this.hitstop = 0.1;
    this.shake = 14;
    this.flash = 0.7;
    audio.sfx('rage');
    p.hp = Math.min(p.maxHp, p.hp + 15);
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - p.x, (e.y - 16) - (p.y - 20));
      if (d < 132) {
        this.damageEnemy(e, 95, e.x > p.x ? 1 : -1);
        e.kb = (e.x > p.x ? 1 : -1) * 160;
      }
    }
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 120;
      this.spawnFlame(p.x + Math.cos(a) * r, p.y - 20 + Math.sin(a) * r * 0.6, 1, Math.cos(a));
    }
    this.spawnSmoke(p.x, p.y - 20, 18, true);
    this.addText('FURIA DE ESPARTA', p.x, p.y - 74, '#ff9d3a', 2);
  }

  die() {
    const p = this.player;
    p.state = 'dead';
    p.deadT = 0;
    this.status = 'dead';
    this.statusT = 0;
    this.overlayIndex = 0;
    audio.sfx('death');
    audio.setMode('menu');
    this.shake = 9;
    if (!this.statusRecorded) {
      this.statusRecorded = true;
      Save.recordRun({
        score: this.score,
        wave: this.wave,
        kills: this.kills,
        cleared: false,
        died: true,
      });
      Save.progress.maxWave = Math.max(Save.progress.maxWave || 0, this.wave);
      this.app.persistProgress();
    }
  }

  victory() {
    if (this.status === 'victory') return;
    this.status = 'victory';
    this.statusT = 0;
    this.overlayIndex = 0;
    this.enemies = [];
    this.spawnQueue.length = 0;
    this.shockwaves = [];
    this.orbs = [];
    audio.sfx('victory');
    audio.setMode('menu');
    this.score += 500 + this.player.hp * 5;
    if (!this.statusRecorded) {
      this.statusRecorded = true;
      Save.recordRun({
        score: this.score,
        wave: 5,
        kills: this.kills,
        cleared: true,
        died: false,
      });
      Save.checkpoint(null);
      Save.progress.maxWave = 5;
      Save.unlock('god');
      this.app.persistProgress();
    }
  }

  // ----------------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.hintT = Math.max(0, this.hintT - dt);
    if (this.toastT > 0) this.toastT -= dt;

    // lightning ambience
    this.lightningIn -= dt;
    if (this.lightningIn <= 0) {
      this.lightningIn = 9 + Math.random() * 12;
      this.lightning = 0.5;
      audio.sfx('thunder');
    }
    this.lightning = Math.max(0, this.lightning - dt * 2.2);

    this.updateAsh(dt);
    this.updateTexts(dt);

    // overlays first
    if (this.status === 'playing' && input.justPressed('pause')) {
      const willPause = !this.paused;
      this.paused = willPause;
      this.pauseIndex = 0;
      audio.sfx(willPause ? 'back' : 'select');
      if (willPause) audio.setMode('menu');
      else audio.setMode('battle');
      // Escape maps to both "pause" and "back"; consume both so the pause
      // overlay does not immediately close on the same key press.
      input.consume('pause');
      input.consume('back');
      if (willPause) return;
    }
    if (this.paused) {
      this.updatePause(dt);
      return;
    }
    if (this.status === 'dead') {
      this.statusT += dt;
      this.player.deadT += dt;
      this.updateParticles(dt);
      this.updateOverlay(dt, 2, true);
      return;
    }
    if (this.status === 'victory') {
      this.statusT += dt;
      this.updateParticles(dt);
      this.updateOrbs(dt);
      this.updateOverlay(dt, 2, false);
      return;
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.updateParticles(dt, true);
      return;
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateParticles(dt);
    this.updateOrbs(dt);
    this.updateWave(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    if (this.pendingVictory > 0) {
      this.pendingVictory -= dt;
      if (this.pendingVictory <= 0) this.victory();
    }

    // rage ready cue
    if (this.player.rage >= 100 && !this.rageCuePlayed) {
      this.rageCuePlayed = true;
      this.addText('FURIA PRONTA - L', this.player.x, this.player.y - 72, '#ff9d3a', 1);
    }
    if (this.player.rage < 90) this.rageCuePlayed = false;
  }

  updateAsh(dt) {
    for (const a of this.ash) {
      a.y += a.vy * dt;
      a.x += a.vx * dt;
      if (a.y > H + 4) { a.y = -4; a.x = Math.random() * W; }
      if (a.x < -4) a.x = W + 4;
      if (a.x > W + 4) a.x = -4;
    }
  }

  updateTexts(dt) {
    for (const t of this.texts) {
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.94;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  updatePlayer(dt) {
    const p = this.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    if (p.comboWindow > 0) {
      p.comboWindow = Math.max(0, p.comboWindow - dt);
      if (p.comboWindow === 0) p.attackStep = 0;
    }
    p.attackBuffer = Math.max(0, p.attackBuffer - dt);
    if (p.state === 'hurt') p.stateT -= dt;
    if (p.state === 'hurt' && p.stateT <= 0) p.state = 'idle';

    const moving = (input.isDown('left') ? -1 : 0) + (input.isDown('right') ? 1 : 0);

    // dash
    if (input.justPressed('dash') && p.dashCd <= 0 && p.state !== 'dead') {
      p.dashT = 0.2;
      p.dashCd = 0.55;
      p.dashDir = moving || p.facing;
      p.facing = p.dashDir;
      p.invuln = Math.max(p.invuln, 0.26);
      p.state = 'dash';
      this.spawnSmoke(p.x, p.y - 16, 5);
      audio.sfx('dash');
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashDir * 310 * dt;
      if (Math.random() < 0.5) this.spawnSmoke(p.x - p.dashDir * 10, p.y - 20, 1);
      if (p.dashT <= 0) p.state = 'idle';
    } else {
      // movement
      let speed = p.state === 'attack' || p.state === 'heavy' ? 18 : p.state === 'hurt' ? 22 : 118;
      if (p.state === 'dash') speed = 0;
      if (moving !== 0 && p.state !== 'hurt') {
        if (p.state !== 'attack' && p.state !== 'heavy') p.facing = moving;
        p.x += moving * speed * dt;
        p.walkPhase += dt * 10;
        if (p.onGround && p.state === 'idle') p.state = 'run';
      } else if (p.onGround && p.state === 'run') {
        p.state = 'idle';
      }
    }

    // jump
    if (input.justPressed('jump') && p.onGround && p.state !== 'hurt') {
      p.vy = -345;
      p.onGround = false;
      if (p.state === 'run') p.state = 'idle';
      audio.sfx('jump');
      this.spawnSmoke(p.x, p.y - 2, 3);
    }

    // attacks
    if (input.justPressed('attack')) {
      if (p.state === 'attack') {
        p.attackBuffer = 0.32;
      } else if (p.state === 'heavy' || p.state === 'hurt') {
        // ignore
      } else if (p.comboWindow > 0 && p.attackStep < 2) {
        this.startAttack(p.attackStep + 1);
      } else {
        this.startAttack(0);
      }
    }
    if (input.justPressed('heavy') && (p.state === 'idle' || p.state === 'run' || p.state === 'jump')) {
      this.startHeavy();
    }
    if (input.justPressed('rage')) this.unleashRage();

    // attack state progression
    if (p.state === 'attack') {
      p.attackT += dt;
      const dur = p.attackDur;
      if (!p.attackHasHit && p.attackT >= (p.attackStep === 2 ? 0.1 : 0.07)) {
        p.attackHasHit = true;
        this.attackHit(p.attackStep);
      }
      this.spawnFlame(p.x + p.facing * (24 + Math.random() * 9), p.y - 26 + (Math.random() - 0.5) * 12, 1, p.facing);
      if (p.attackT >= dur) {
        if (p.attackBuffer > 0 && p.attackStep < 2) {
          this.startAttack(p.attackStep + 1);
        } else {
          p.state = 'idle';
          p.comboWindow = 0.38;
          p.comboBuffer = 0;
        }
      }
    } else if (p.state === 'heavy') {
      p.attackT += dt;
      if (!p.attackHasHit && p.attackT >= 0.26) {
        p.attackHasHit = true;
        this.attackHit(3);
        this.shake = Math.max(this.shake, 6);
        audio.sfx('heavy');
        for (let i = 0; i < 10; i++) {
          this.spawnSmoke(p.x + (Math.random() - 0.5) * 60, GROUND_Y - 2, 1);
        }
        if (p.onGround) this.addDecal(p.x + p.facing * 30, GROUND_Y + 6, 6);
      }
      this.spawnFlame(p.x + p.facing * 26, p.y - 20, 1, p.facing);
      if (p.attackT >= p.attackDur) {
        p.state = 'idle';
        p.attackStep = 0;
      }
    }

    // physics
    p.vy += 980 * dt;
    p.y += p.vy * dt;
    p.x += (p.kb || 0) * dt;
    p.kb = (p.kb || 0) * 0.86;
    if (p.y >= GROUND_Y) {
      if (!p.onGround) {
        audio.sfx('land');
        this.spawnSmoke(p.x, GROUND_Y - 2, 4);
      }
      p.y = GROUND_Y;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }
    p.x = clamp(p.x, LEFT_BOUND, RIGHT_BOUND);

    // trail when dashing
    // (kept as particles above)
  }

  updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      e.hurtT = Math.max(0, e.hurtT - dt);
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.state === 'dying') {
        e.deathT -= dt;
        e.y = Math.min(GROUND_Y, e.y + 30 * dt);
        continue;
      }
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        continue;
      }
      e.x += e.kb * dt;
      e.kb *= 0.85;
      e.x = clamp(e.x, -30, W + 30);
      e.facing = p.x < e.x ? -1 : 1;
      if (e.type === 'legionnaire') this.updateLegionnaire(e, dt);
      else if (e.type === 'harpy') this.updateHarpy(e, dt);
      else if (e.type === 'minotaur') this.updateMinotaur(e, dt);
    }
    this.enemies = this.enemies.filter((e) => !(e.state === 'dying' && e.deathT <= 0));
    this.enemies.sort((a, b) => a.y - b.y);
  }

  updateLegionnaire(e, dt) {
    const p = this.player;
    e.attackCd = Math.max(0, e.attackCd - dt);
    if (e.state === 'hurt') {
      e.stateT -= dt;
      if (e.stateT <= 0) e.state = 'walk';
      return;
    }
    if (e.state === 'windup') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.state = 'strike';
        e.stateT = 0.16;
        if (Math.abs(p.x - e.x) < 40 && Math.abs(p.y - e.y) < 26 && p.invuln <= 0) {
          this.hurtPlayer(9, e.x);
        }
        audio.sfx('swing');
      }
      return;
    }
    if (e.state === 'strike') {
      e.stateT -= dt;
      if (e.stateT <= 0) { e.state = 'walk'; e.attackCd = 1.25; }
      return;
    }
    const dx = p.x - e.x;
    const d = Math.abs(dx);
    if (d > 30) {
      e.x += e.facing * e.speed * dt;
      e.walkPhase += dt * 7;
    } else if (e.attackCd <= 0) {
      e.state = 'windup';
      e.stateT = 0.42;
    }
    // soft separation
    for (const o of this.enemies) {
      if (o === e || o.type !== 'legionnaire' || o.state === 'dying') continue;
      const sep = e.x - o.x;
      if (Math.abs(sep) < 18) e.x += Math.sign(sep || 1) * 12 * dt;
    }
  }

  updateHarpy(e, dt) {
    const p = this.player;
    e.attackCd = Math.max(0, e.attackCd - dt);
    if (e.state === 'hurt') {
      e.stateT -= dt;
      if (e.stateT <= 0) e.state = 'hover';
      return;
    }
    if (e.state === 'dive') {
      e.stateT -= dt;
      const t = 1 - Math.max(0, e.stateT) / 0.5;
      e.x = lerp(e.diveFrom.x, e.diveTo.x, t);
      e.y = lerp(e.diveFrom.y, e.diveTo.y, t);
      if (Math.hypot(p.x - e.x, (p.y - 18) - e.y) < 24 && p.invuln <= 0) {
        this.hurtPlayer(8, e.x);
        e.state = 'rise';
        e.stateT = 0.5;
      }
      if (e.stateT <= 0) {
        e.state = 'rise';
        e.stateT = 0.7;
      }
      return;
    }
    if (e.state === 'rise') {
      e.stateT -= dt;
      e.y = lerp(e.y, e.baseY, dt * 5);
      e.x += e.facing * e.speed * 0.7 * dt;
      if (e.stateT <= 0) {
        e.state = 'hover';
        e.attackCd = 1.5;
      }
      return;
    }
    // hover
    e.x += e.facing * e.speed * 0.45 * dt;
    e.x = clamp(e.x, 30, W - 30);
    e.y = e.baseY + Math.sin(this.time * 3 + e.seed) * 6;
    e.walkPhase += dt * 9;
    if (e.attackCd <= 0 && Math.abs(p.x - e.x) < 150) {
      e.state = 'dive';
      e.stateT = 0.5;
      e.diveFrom = { x: e.x, y: e.y };
      e.diveTo = { x: p.x + (p.x > e.x ? -12 : 12), y: p.y - 26 };
      audio.sfx('swing');
    }
  }

  updateMinotaur(e, dt) {
    const p = this.player;
    e.attackCd = Math.max(0, e.attackCd - dt);
    e.contactCd = Math.max(0, e.contactCd - dt);
    if (e.state === 'hurt') {
      e.stateT -= dt;
      if (e.stateT <= 0) e.state = 'walk';
      return;
    }
    if (e.state === 'windup') {
      e.stateT -= dt;
      if (e.stateT <= 0) {
        if (Math.random() < 0.55) {
          e.state = 'charge';
          e.stateT = 0.55;
          e.chargeDir = Math.sign(p.x - e.x) || 1;
          e.chargeT = 0;
          audio.sfx('rage');
        } else {
          e.state = 'slam';
          e.stateT = 0.9;
          e.slamDone = false;
          audio.sfx('heavy');
        }
      }
      return;
    }
    if (e.state === 'charge') {
      e.stateT -= dt;
      e.chargeT += dt;
      e.x += e.chargeDir * 215 * dt;
      e.walkPhase += dt * 16;
      if (Math.random() < 0.6) this.spawnSmoke(e.x - e.chargeDir * 12, GROUND_Y - 2, 1);
      if (Math.abs(p.x - e.x) < 34 && e.contactCd <= 0 && p.invuln <= 0) {
        this.hurtPlayer(17, e.x);
        e.contactCd = 1;
      }
      if (e.stateT <= 0 || e.x < 50 || e.x > W - 50) {
        e.state = 'recover';
        e.stateT = 0.6;
        this.shake = 5;
      }
      return;
    }
    if (e.state === 'slam') {
      e.stateT -= dt;
      const t = 0.9 - e.stateT;
      if (!e.slamDone && t > 0.45) {
        e.slamDone = true;
        this.shake = 11;
        audio.sfx('heavy');
        this.spawnSmoke(e.x, GROUND_Y - 2, 16, true);
        for (let i = 0; i < 12; i++) this.spawnSpark(e.x + (Math.random() - 0.5) * 70, GROUND_Y - 4, 1, 0);
        this.shockwaves.push(
          { x: e.x - 14, dir: -1, life: 1.35, hit: false },
          { x: e.x + 14, dir: 1, life: 1.35, hit: false },
        );
      }
      if (e.stateT <= 0) {
        e.state = 'recover';
        e.stateT = 0.7;
      }
      return;
    }
    if (e.state === 'recover') {
      e.stateT -= dt;
      if (e.stateT <= 0) { e.state = 'walk'; e.attackCd = 1.4; }
      return;
    }
    // walk
    const d = Math.abs(p.x - e.x);
    if (d > 52) {
      e.x += e.facing * e.speed * dt;
      e.walkPhase += dt * 6;
    }
    if (e.attackCd <= 0 && d < 130) {
      e.state = 'windup';
      e.stateT = 0.55;
    }
  }

  updateParticles(dt, frozen = false) {
    for (const p of this.particles) {
      p.life -= dt;
      if (frozen) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      if (p.type === 'blood' && p.y > GROUND_Y + 20) {
        p.life = 0;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateOrbs(dt) {
    const p = this.player;
    for (const o of this.orbs) {
      o.life -= dt;
      if (o.delay > 0) {
        o.delay -= dt;
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.vy += 260 * dt;
        if (o.y > GROUND_Y + 8) { o.y = GROUND_Y + 8; o.vy *= -0.4; }
        continue;
      }
      const dx = p.x - o.x;
      const dy = (p.y - 22) - o.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = 300 + Math.min(260, (6 - o.life) * 60);
      o.x += (dx / d) * sp * dt;
      o.y += (dy / d) * sp * dt;
      if (d < 12) {
        o.life = 0;
        if (o.type === 'hp') {
          p.hp = Math.min(p.maxHp, p.hp + 8);
          audio.sfx('heal');
          this.addText('+8 VIDA', p.x, p.y - 52, '#9fe27a', 1);
        } else {
          this.score += 20;
          p.rage = Math.min(100, p.rage + 0.8);
          audio.sfx('orb');
        }
      }
    }
    this.orbs = this.orbs.filter((o) => o.life > 0);
    // shockwaves
    for (const s of this.shockwaves) {
      s.life -= dt;
      s.x += s.dir * 165 * dt;
      if (!s.hit && Math.abs(s.x - p.x) < 16 && p.y > GROUND_Y - 8) {
        s.hit = true;
        this.hurtPlayer(11, s.x);
      }
      if (Math.random() < 0.4) this.spawnSpark(s.x, GROUND_Y - 3, 1, 0);
    }
    this.shockwaves = this.shockwaves.filter((s) => s.life > 0);
  }

  updateWave(dt) {
    if (this.waveState === 'banner') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.waveState = 'fight';
        this.spawnTimer = 0.2;
      }
      return;
    }
    if (this.waveState === 'fight') {
      const alive = this.enemies.filter((e) => e.hp > 0).length;
      if (this.spawnQueue.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && alive < 4) {
          const type = this.spawnQueue.shift();
          this.spawnEnemy(type);
          this.spawnTimer = 1.0 + Math.random() * 0.45;
        }
      } else if (alive === 0 && this.enemies.length === 0) {
        this.waveState = 'clear';
        this.waveTimer = 2.3;
        this.clearedBonus = 250 * this.wave;
        this.score += this.clearedBonus;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 20);
        if (!this.damageTakenThisWave) Save.unlock('unbroken');
        audio.sfx('victory');
        if (this.wave < 5) {
          Save.checkpoint({
            wave: this.wave + 1,
            score: Math.floor(this.score),
            hp: Math.round(this.player.hp),
            rage: Math.round(this.player.rage),
          });
        }
        this.addText(`BONUS DE ONDA +${this.clearedBonus}`, this.player.x, this.player.y - 66, '#ffd27a', 1);
      }
      return;
    }
    if (this.waveState === 'clear') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        if (this.wave >= 5) {
          this.victory();
        } else {
          this.setupWave(this.wave + 1);
        }
      }
    }
  }

  updateOverlay(dt, count, dead) {
    if (this.statusT < 1.0) return;
    if (input.justPressed('up') || input.justPressed('down')) {
      this.overlayIndex = (this.overlayIndex + 1) % count;
      audio.sfx('move');
    }
    if (input.justPressed('back')) {
      audio.sfx('back');
      this.app.toMenu();
      return;
    }
    if (dead && this.statusT > 1.3) {
      if (input.justPressed('confirm')) this.selectOverlay(dead);
    } else if (!dead) {
      if (input.justPressed('confirm')) this.selectOverlay(dead);
    }
    const click = input.consumeClick();
    if (click) {
      for (let i = 0; i < count; i++) {
        const r = this.overlayButtonRect(i, count);
        if (click.x > r.x && click.x < r.x + r.w && click.y > r.y && click.y < r.y + r.h) {
          this.overlayIndex = i;
          this.selectOverlay(dead);
          break;
        }
      }
    }
  }

  selectOverlay(dead) {
    audio.sfx('select');
    if (this.overlayIndex === 0) {
      // retry / play again
      if (dead) this.app.startGame({ resume: true });
      else this.app.startGame({ resume: false });
    } else {
      this.app.toMenu();
    }
  }

  updatePause(dt) {
    if (input.justPressed('up') || input.justPressed('down')) {
      this.pauseIndex = (this.pauseIndex + 1) % 3;
      audio.sfx('move');
    }
    if (input.justPressed('back') || input.justPressed('pause')) {
      this.paused = false;
      audio.setMode('battle');
      audio.sfx('select');
      return;
    }
    if (input.justPressed('confirm')) {
      if (this.pauseIndex === 0) {
        this.paused = false;
        audio.setMode('battle');
        audio.sfx('select');
      } else if (this.pauseIndex === 1) {
        this.app.startGame({ resume: true });
      } else {
        this.app.toMenu();
      }
      return;
    }
    const click = input.consumeClick();
    if (click) {
      for (let i = 0; i < 3; i++) {
        const y = 121 + i * 24;
        if (click.x > 140 && click.x < 340 && click.y > y - 5 && click.y < y + 19) {
          this.pauseIndex = i;
          if (i === 0) { this.paused = false; audio.setMode('battle'); audio.sfx('select'); }
          else if (i === 1) this.app.startGame({ resume: true });
          else this.app.toMenu();
          break;
        }
      }
    }
  }

  // ----------------------------------------------------------------- render
  render(ctx) {
    const shakeOn = Save.settings.shake;
    const s = this.shake;
    const ox = shakeOn ? Math.round((Math.random() - 0.5) * s) : 0;
    const oy = shakeOn ? Math.round((Math.random() - 0.5) * s) : 0;

    ctx.save();
    ctx.translate(ox, oy);
    this.drawBackground(ctx);

    // decals
    for (const d of this.arenaDecals) {
      const rnd = mulberry32(Math.floor(d.seed * 1000));
      ctx.save();
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#3d0d0c' : '#2a0808';
        ctx.beginPath();
        ctx.ellipse(d.x + (rnd() - 0.5) * d.r, d.y + (rnd() - 0.5) * 4, d.r * (0.3 + rnd() * 0.5), d.r * 0.18 + rnd(), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // shadows
    for (const e of this.enemies) {
      const fade = e.state === 'dying' ? clamp(e.deathT / 0.55, 0, 1) : 1;
      if (e.type === 'harpy') {
        ctx.save();
        ctx.globalAlpha = 0.2 * fade;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(e.x, GROUND_Y + 3, 12, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.35 * fade;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(e.x, GROUND_Y + 2, e.type === 'minotaur' ? 26 : 11, e.type === 'minotaur' ? 5 : 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.player.x, GROUND_Y + 2, 13, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // shockwaves (under enemies)
    for (const s2 of this.shockwaves) this.drawShockwave(ctx, s2);

    for (const e of this.enemies) {
      ctx.save();
      if (e.state === 'dying') {
        ctx.globalAlpha = clamp(e.deathT / 0.55, 0, 1);
        ctx.translate(0, (1 - ctx.globalAlpha) * 6);
      }
      if (e.type === 'legionnaire') drawLegionnaire(ctx, e, this.time);
      else if (e.type === 'harpy') drawHarpy(ctx, e, this.time);
      else drawMinotaur(ctx, e, this.time);
      if (e.hp > 0 && e.type !== 'minotaur') this.drawEnemyHealth(ctx, e);
      ctx.restore();
    }

    // player
    if (!(this.status === 'dead' && this.player.deadT > 0.8)) {
      drawKratos(ctx, this.player, this.time);
    }

    // particles
    this.drawParticles(ctx);

    // orbs
    for (const o of this.orbs) {
      const t = this.time * 6 + o.x;
      if (o.type === 'hp') {
        px(ctx, Math.round(o.x) - 2, Math.round(o.y) - 1, 5, 2, '#9fe27a');
        px(ctx, Math.round(o.x), Math.round(o.y) - 3, 1, 6, '#9fe27a');
        px(ctx, Math.round(o.x) - 1, Math.round(o.y), 3, 1, '#d9ffb0');
      } else {
        px(ctx, Math.round(o.x), Math.round(o.y), 2, 2, '#e04b2a');
        px(ctx, Math.round(o.x), Math.round(o.y), 1, 1, '#ffd27a');
        if (Math.sin(t) > 0.7) px(ctx, Math.round(o.x) - 1, Math.round(o.y) - 1, 3, 3, 'rgba(255,90,40,0.35)');
      }
    }

    // floating damage text
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life * 1.6, 0, 1);
      drawText(ctx, t.text, t.x, t.y, {
        scale: t.size, color: t.color, align: 'center', spacing: 1, outline: '#180606',
      });
    }
    ctx.globalAlpha = 1;

    this.drawForeground(ctx);
    ctx.restore();

    if (this.lightning > 0.02) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.3, this.lightning * 0.6);
      ctx.fillStyle = '#dfe9ff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.flash > 0.02) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.38, this.flash * 0.5);
      ctx.fillStyle = '#ff6a32';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (this.status === 'playing') this.drawHUD(ctx);

    if (this.paused) this.drawPause(ctx);
    if (this.status === 'dead' && this.statusT > 1.1) this.drawDead(ctx);
    if (this.status === 'victory' && this.statusT > 0.8) this.drawVictory(ctx);
  }

  drawBackground(ctx) {
    ctx.drawImage(this.backdrop, 0, 0);

    // brazier flames + light
    const flames = [[74, 190, 1.1], [408, 184, 1]];
    for (const [bx, by, sc] of flames) {
      const f = Math.sin(this.time * 11 + bx) * 0.5 + Math.sin(this.time * 7.3 + bx * 2) * 0.5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, bx, by - 4, 54 * sc, '#ff7a1e', 0.12 + f * 0.02, 5);
      ctx.globalAlpha = 0.5;
      glow(ctx, bx, GROUND_Y + 18, 42, '#c9581e', 0.16, 4);
      ctx.restore();
      // flame body
      for (let i = 0; i < 7; i++) {
        const t = (this.time * 1.7 + i * 0.517) % 1;
        const fx = bx + (Math.sin(this.time * 6 + i * 2.1) * 4) * sc;
        const fy = by - 4 - t * 14 * sc;
        const w = Math.max(1, Math.round((3 - t * 2.4) * sc));
        px(ctx, fx - w / 2, fy, w, 2, t < 0.35 ? '#ffe6a0' : t < 0.7 ? '#ff9d3a' : '#c43622');
      }
      px(ctx, bx - 5 * sc, by - 5, 10 * sc, 2, '#6d2a18');
    }

    // statue eyes glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + Math.sin(this.time * 2.3) * 0.15;
    glow(ctx, 230, 148, 7, '#ff5a1e', 0.5, 3);
    glow(ctx, 244, 148, 6, '#ff5a1e', 0.5, 3);
    ctx.restore();

    // lightning streaks in the upper sky
    if (this.lightning > 0.05) {
      const rnd = mulberry32(Math.floor(this.lightningIn * 100));
      ctx.save();
      ctx.globalAlpha = this.lightning;
      let x = 140 + rnd() * 200;
      let y = 0;
      ctx.fillStyle = '#eef5ff';
      while (y < 110) {
        const nx = x + (rnd() - 0.5) * 22;
        const ny = y + 8 + rnd() * 10;
        line(ctx, x, y, nx, ny, '#eef5ff', 1);
        x = nx;
        y = ny;
      }
      ctx.restore();
    }

    // drifting low fog
    for (let i = 0; i < 4; i++) {
      const off = (this.time * (6 + i * 2) + i * 160) % (W + 260) - 130;
      ctx.save();
      ctx.globalAlpha = 0.05 + i * 0.012;
      ctx.fillStyle = '#b9a99a';
      ctx.beginPath();
      ctx.ellipse(off, 208 + i * 6, 120, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(off - 300, 214 + i * 5, 100, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ambient ash
    for (const a of this.ash) {
      ctx.globalAlpha = a.a;
      ctx.fillStyle = '#b9a99a';
      ctx.fillRect(a.x | 0, a.y | 0, a.s, a.s);
    }
    ctx.globalAlpha = 1;

    // embers rising from the braziers
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const bx = i % 2 ? 74 : 408;
      const t = (this.time * (0.25 + (i % 5) * 0.04) + i * 0.137) % 1;
      const x = bx + Math.sin(this.time * 2 + i * 3) * (6 + t * 16);
      const y = 188 - t * 90;
      ctx.globalAlpha = (1 - t) * 0.6;
      ctx.fillStyle = i % 3 === 0 ? '#ffd27a' : '#e0622a';
      ctx.fillRect(x | 0, y | 0, 1, 1 + (i % 2));
    }
    ctx.restore();
  }

  drawForeground(ctx) {
    // fog over feet
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#0c0909';
    ctx.beginPath();
    ctx.ellipse(240, 262, 280, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // subtle vignette
    ctx.save();
    const g = ctx.createRadialGradient(240, 135, 90, 240, 135, 280);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      if (p.type === 'smoke') {
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * 0.4;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
        continue;
      }
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawShockwave(ctx, s) {
    const a = clamp(s.life / 1.35, 0, 1);
    ctx.save();
    ctx.globalAlpha = a * 0.8;
    px(ctx, s.x - 3, GROUND_Y - 6, 6, 6, '#ff9d3a');
    px(ctx, s.x - 5, GROUND_Y - 3, 10, 4, '#c43622');
    px(ctx, s.x - 2, GROUND_Y - 10, 4, 4, '#ffd27a');
    ctx.restore();
  }

  drawEnemyHealth(ctx, e) {
    if (e.hp >= e.maxHp) return;
    const w = 16;
    const x = Math.round(e.x - w / 2);
    const y = Math.round(e.y - (e.type === 'harpy' ? 26 : 48));
    px(ctx, x - 1, y - 1, w + 2, 4, '#120606');
    px(ctx, x, y, w, 2, '#3d0d0c');
    px(ctx, x, y, Math.round((e.hp / e.maxHp) * w), 2, '#c43622');
  }

  drawPortrait(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    // medallion
    disc(ctx, 12, 12, 13, '#151011');
    disc(ctx, 12, 12, 12, '#241a16');
    // shoulders
    px(ctx, 1, 19, 23, 6, '#3a2a24');
    px(ctx, 1, 19, 23, 1, '#8a6534');
    px(ctx, 3, 20, 19, 1, '#5a4130');
    // neck + jaw
    px(ctx, 8, 14, 9, 6, '#4b3b30');
    // face
    px(ctx, 6, 4, 12, 13, '#b0997f');
    px(ctx, 6, 4, 4, 13, '#d8c0a4');
    px(ctx, 16, 6, 3, 9, '#7b6a5c');
    px(ctx, 8, 4, 2, 8, '#962a20');
    px(ctx, 8, 11, 2, 4, '#5a1c18');
    // brow + eyes
    px(ctx, 7, 8, 10, 2, '#2a2020');
    px(ctx, 8, 10, 3, 1, '#eddcc3');
    px(ctx, 9, 10, 1, 1, '#1a1214');
    px(ctx, 13, 10, 2, 1, '#5a1c18');
    // beard
    px(ctx, 7, 14, 10, 4, '#2f282a');
    px(ctx, 8, 14, 8, 1, '#4a4242');
    px(ctx, 15, 15, 2, 3, '#1a1214');
    px(ctx, 7, 15, 1, 2, '#4a4242');
    // scar
    px(ctx, 11, 11, 1, 5, '#5a1c18');
    // gold ring
    ring(ctx, 12, 12, 12.2, '#8a6534');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.15;
      px(ctx, Math.round(12 + Math.cos(a) * 12.2), Math.round(12 + Math.sin(a) * 12.2), 1, 1, '#d9ab5c');
    }
    ctx.restore();
  }

  drawHUD(ctx) {
    const p = this.player;
    // portrait + bars
    this.drawPortrait(ctx, 18, 12, 28);
    const bx = 50;
    const by = 14;
    px(ctx, bx - 1, by - 1, 146, 12, '#160a09');
    px(ctx, bx, by, 144, 10, '#2a0d0c');
    const hpFrac = clamp(p.hp / p.maxHp, 0, 1);
    px(ctx, bx + 1, by + 1, Math.round(142 * hpFrac), 8, '#8d1b18');
    px(ctx, bx + 1, by + 1, Math.round(142 * hpFrac), 2, '#c43622');
    px(ctx, bx + 1, by + 7, Math.round(142 * hpFrac), 1, '#5a1d1c');
    for (let i = 1; i < 10; i++) px(ctx, bx + Math.round((142 / 10) * i), by + 1, 1, 8, '#160a09');
    px(ctx, bx, by, 144, 1, '#6b4a2e');
    px(ctx, bx, by + 9, 144, 1, '#3a1512');
    drawText(ctx, `${Math.ceil(p.hp)}`, bx + 146, by, { scale: 1, color: ASH, spacing: 1 });

    // rage bar
    const ry = by + 14;
    px(ctx, bx, ry, 112, 6, '#120a09');
    const rageFrac = clamp(p.rage / 100, 0, 1);
    px(ctx, bx + 1, ry + 1, Math.round(110 * rageFrac), 4, p.rage >= 100 ? '#ffd27a' : '#c96a1e');
    if (p.rage >= 100) {
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 8) * 0.3;
      px(ctx, bx + 1, ry + 1, 110, 4, '#ff9d3a');
      ctx.globalAlpha = 1;
      drawText(ctx, 'FURIA [L]', bx + 118, ry - 1, { scale: 1, color: '#ffd27a', spacing: 1 });
    } else {
      drawText(ctx, 'FURIA', bx + 118, ry - 1, { scale: 1, color: '#6b5b4c', spacing: 1 });
    }

    // wave + score
    drawText(ctx, `ONDA ${this.wave}/5`, 468, 12, { scale: 1, color: ASH, spacing: 1, align: 'right' });
    drawText(ctx, String(Math.floor(this.score)).padStart(6, '0'), 468, 22, { scale: 2, color: GOLD, spacing: 1, align: 'right' });
    drawText(ctx, this.waveTitle || '', 468, 40, { scale: 1, color: '#6b5b4c', spacing: 1, align: 'right' });

    // combo
    if (this.combo >= 2) {
      const a = clamp(this.comboTimer / 2.6, 0, 1);
      ctx.globalAlpha = 0.35 + a * 0.65;
      const scale = this.combo >= 10 ? 3 : 2;
      drawText(ctx, `x${this.combo}`, 456, 60, {
        scale, color: '#ffd7a0', outline: '#180606', shadow: '#8d1b18', spacing: 1, align: 'right',
      });
      drawText(ctx, 'COMBO', 456, 60 + 7 * scale + 2, { scale: 1, color: '#b9a99a', spacing: 1, align: 'right' });
      ctx.globalAlpha = 1;
    }

    // boss bar
    const boss = this.enemies.find((e) => e.type === 'minotaur' && e.hp > 0);
    if (boss) {
      const w = 200;
      const x = (W - w) / 2;
      const y = 252;
      drawText(ctx, 'MINOTAURO DE HADES', W / 2, y - 12, { scale: 1, color: '#d9ab5c', spacing: 2, align: 'center' });
      px(ctx, x - 2, y - 2, w + 4, 10, '#120606');
      px(ctx, x, y, w, 6, '#2a0d0c');
      px(ctx, x, y, Math.round((boss.hp / boss.maxHp) * w), 6, '#8d1b18');
      px(ctx, x, y, Math.round((boss.hp / boss.maxHp) * w), 2, '#c43622');
      px(ctx, x, y, w, 1, '#6b4a2e');
    }

    // wave banner
    if (this.waveState === 'banner' || this.waveState === 'clear') {
      const isClear = this.waveState === 'clear';
      const total = isClear ? 2.3 : (this.wave === 1 ? 2.8 : 2.4);
      const tLeft = isClear ? this.waveTimer : this.waveTimer;
      const a = clamp(tLeft / 0.6, 0, 1) * clamp((total - tLeft) / 0.45 + 0.15, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      const cy = 96;
      const grad = ctx.createLinearGradient(0, cy - 18, 0, cy + 48);
      grad.addColorStop(0, 'rgba(8,3,3,0)');
      grad.addColorStop(0.32, 'rgba(8,3,3,0.72)');
      grad.addColorStop(0.68, 'rgba(8,3,3,0.72)');
      grad.addColorStop(1, 'rgba(8,3,3,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, cy - 22, W, 72);
      drawText(ctx, isClear ? 'ONDA CONCLUIDA' : this.waveSub, W / 2, cy - 8, {
        scale: 1, color: '#b9a99a', spacing: 4, align: 'center',
      });
      const clearLine = this.wave >= 5 ? 'A ARENA ESTA SILENCIOSA' : `PROXIMA: ${waveOf(this.wave + 1)?.title || ''}`;
      drawText(ctx, isClear ? clearLine : this.waveTitle, W / 2, cy + 2, {
        scale: 2, color: isClear ? '#ffd7a0' : CREAM, outline: '#180606', shadow: '#6d1210', spacing: 1, align: 'center',
      });
      if (!isClear) {
        drawText(ctx, 'SOBREVIVA', W / 2, cy + 38, { scale: 1, color: '#7c2c26', spacing: 3, align: 'center' });
      }
      ctx.restore();
    }

    // hints
    if (this.hintT > 0 && !this.app.isTouch && this.waveState !== 'banner' && !boss) {
      const a = clamp(this.hintT / 2, 0, 1) * 0.75;
      ctx.globalAlpha = a;
      px(ctx, 22, 242, 436, 10, 'rgba(6,4,4,0.66)');
      drawText(ctx, 'A/D MOVER  ESPACO PULAR  J ATACAR  K PESADO  SHIFT ESQUIVA  L FURIA', 240, 244, {
        scale: 1, color: '#9c8b74', spacing: 1, align: 'center',
      });
      ctx.globalAlpha = 1;
    }

    // pause tap target on touch
    if (this.app.isTouch && this.status === 'playing' && !this.paused) {
      px(ctx, 458, 8, 14, 14, 'rgba(10,4,4,0.7)');
      px(ctx, 462, 11, 2, 8, '#b9a99a');
      px(ctx, 466, 11, 2, 8, '#b9a99a');
    }
  }

  drawPanel(ctx, x, y, w, h, title) {
    px(ctx, x, y, w, h, 'rgba(8,4,5,0.94)');
    px(ctx, x, y, w, 1, '#6b4a2e');
    px(ctx, x, y + h - 1, w, 1, '#2a1512');
    px(ctx, x, y, 1, h, '#3a2420');
    px(ctx, x + w - 1, y, 1, h, '#241715');
    for (const [cx, cy] of [[x, y], [x + w - 4, y], [x, y + h - 4], [x + w - 4, y + h - 4]]) {
      px(ctx, cx, cy, 4, 4, '#3a2420');
      px(ctx, cx + 1, cy + 1, 2, 2, '#8a6534');
    }
    if (title) {
      drawText(ctx, title, W / 2, y + 12, { scale: 3, color: '#efe3cf', outline: '#180606', shadow: '#6d1210', align: 'center' });
      px(ctx, x + 22, y + 38, w - 44, 1, '#4a1a16');
      px(ctx, x + w / 2 - 26, y + 39, 52, 1, '#8d1b18');
    }
  }

  drawPause(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(3,2,3,0.74)';
    ctx.fillRect(0, 0, W, H);
    this.drawPanel(ctx, 132, 56, 216, 158, 'PAUSA');
    const labels = ['CONTINUAR', 'REPETIR ONDA', 'MENU PRINCIPAL'];
    for (let i = 0; i < labels.length; i++) {
      const y = 126 + i * 24;
      const sel = i === this.pauseIndex;
      if (sel) {
        px(ctx, 140, y - 5, 200, 20, '#2a0d0c');
        px(ctx, 140, y - 5, 2, 20, '#a3221b');
      }
      drawText(ctx, labels[i], 240, y, {
        scale: 2, color: sel ? CREAM : '#8a6a58', outline: '#120606', spacing: 1, align: 'center',
      });
    }
    drawText(ctx, this.app.isTouch ? 'TOQUE PARA ESCOLHER' : 'ESC CONTINUAR', 240, 200, {
      scale: 1, color: '#6b5b4c', spacing: 1, align: 'center',
    });
    ctx.restore();
  }

  drawDead(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,2,3,0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = clamp((this.statusT - 1.1) / 0.5, 0, 1);
    drawText(ctx, 'VOCE MORREU', 240, 56, {
      scale: 4, color: '#8d1b18', outline: '#0d0304', shadow: '#3d0708', spacing: 1, align: 'center',
    });
    drawText(ctx, 'AS CINZAS RECLAMAM VOCE', 240, 100, { scale: 1, color: '#b9a99a', spacing: 2, align: 'center' });
    drawText(ctx, `ONDA ${this.wave}  \u00b7  PONTOS ${Math.floor(this.score)}  \u00b7  ABATES ${this.kills}`, 240, 116, {
      scale: 1, color: '#8a7a68', spacing: 1, align: 'center',
    });
    const labels = ['REPETIR ONDA', 'MENU PRINCIPAL'];
    for (let i = 0; i < 2; i++) {
      const r = this.overlayButtonRect(i, 2);
      const sel = i === this.overlayIndex;
      if (sel) {
        px(ctx, r.x, r.y, r.w, r.h, '#2a0d0c');
        px(ctx, r.x, r.y, 2, r.h, '#a3221b');
      }
      drawText(ctx, labels[i], r.x + r.w / 2, r.y + 4, {
        scale: 2, color: sel ? CREAM : '#8a6a58', outline: '#120606', spacing: 1, align: 'center',
      });
    }
    ctx.restore();
  }

  drawVictory(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,3,2,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = clamp((this.statusT - 0.8) / 0.5, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= 0.18;
    glow(ctx, 240, 64, 90, '#ffb24a', 0.5, 5);
    ctx.restore();
    drawLogo(ctx, 'GOD OF WAR', 240 - logoWidth('GOD OF WAR', 2) / 2, 30, 2, [
      '#5a3a12', '#8a6430', '#c7a052', '#f0d38a', '#ffeab0', '#fff4cf', '#f7e0a4', '#dcb46a', '#c08d40',
    ]);
    drawText(ctx, 'A ARENA ESTA SILENCIOSA', 240, 90, { scale: 1, color: '#b9a99a', spacing: 3, align: 'center' });
    drawText(ctx, `PONTOS ${Math.floor(this.score)}   \u00b7   ABATES ${this.kills}   \u00b7   COMBO MAX x${this.bestCombo}`, 240, 106, {
      scale: 1, color: '#8a7a68', spacing: 1, align: 'center',
    });
    const labels = ['JOGAR DE NOVO', 'MENU PRINCIPAL'];
    for (let i = 0; i < 2; i++) {
      const r = this.overlayButtonRect(i, 2);
      const sel = i === this.overlayIndex;
      if (sel) {
        px(ctx, r.x, r.y, r.w, r.h, '#2a0d0c');
        px(ctx, r.x, r.y, 2, r.h, '#a3221b');
      }
      drawText(ctx, labels[i], r.x + r.w / 2, r.y + 4, {
        scale: 2, color: sel ? CREAM : '#8a6a58', outline: '#120606', spacing: 1, align: 'center',
      });
    }
    ctx.restore();
  }

  overlayButtonRect(i, count) {
    const w = 176;
    const gap = 16;
    const total = w * count + gap * (count - 1);
    const x = (W - total) / 2 + i * (w + gap);
    return { x, y: 148, w, h: 26 };
  }
}
