// Small procedural audio engine (no external assets).
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.volume = 0.65;
    this.mode = 'silent'; // silent | menu | battle
    this.drone = null;
    this.beat = 0;
    this.thunderIn = 6 + Math.random() * 7;
    this.musicEnabled = true;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    } catch {
      this.ctx = null;
      return false;
    }
    return true;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  setMode(mode) {
    if (this.mode === mode) {
      // The audio graph may have been created after the scene asked for its
      // ambience (first gesture). Start it now that audio is available.
      if (this.ctx && this.musicEnabled && !this.drone) {
        if (mode === 'menu') this.startDrone(55, 0.05, 260);
        if (mode === 'battle') this.startDrone(41, 0.05, 180);
      }
      return;
    }
    this.mode = mode;
    this.stopDrone();
    if (mode === 'menu') this.startDrone(55, 0.05, 260);
    if (mode === 'battle') this.startDrone(41, 0.05, 180);
    this.beat = 0;
  }

  startDrone(freq, gain, cutoff) {
    if (!this.ctx || !this.musicEnabled) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(gain, t + 2.2);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = cutoff;
    filt.Q.value = 2.5;
    const o1 = this.ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = freq;
    const o2 = this.ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = freq * 1.5 + 0.4;
    o2.detune.value = -9;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = cutoff * 0.35;
    lfo.connect(lfoGain);
    lfoGain.connect(filt.frequency);
    o1.connect(filt);
    o2.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    o1.start();
    o2.start();
    lfo.start();
    this.drone = { g, o1, o2, lfo, filt };
  }

  stopDrone() {
    if (!this.drone || !this.ctx) return;
    const { g, o1, o2, lfo } = this.drone;
    const t = this.ctx.currentTime;
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.8);
      o1.stop(t + 0.9);
      o2.stop(t + 0.9);
      lfo.stop(t + 0.9);
    } catch {}
    this.drone = null;
  }

  tick(dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.thunderIn -= dt;
    if (this.mode === 'menu' && this.thunderIn <= 0) {
      this.thunderIn = 14 + Math.random() * 12;
      this.sfx('thunder');
    }
    if (this.mode === 'battle') {
      this.beat -= dt;
      if (this.beat <= 0) {
        this.beat += 0.46;
        const step = Math.round(this.ctx.currentTime / 0.46) % 4;
        this.sfx(step === 0 ? 'kick' : step === 2 ? 'snare' : 'hat');
      }
    }
  }

  env(node, t, a, d, peak) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(freq, dur, type = 'square', gain = 0.08, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    this.env(g, t, 0.005, dur, gain);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  burst(dur = 0.2, freq = 1200, gain = 0.12, type = 'bandpass', q = 0.8, sweep = 0) {
    if (!this.ctx || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(80, freq + sweep), t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, dur, gain);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'move':
        this.tone(420, 0.05, 'square', 0.035, -120);
        break;
      case 'select':
        this.tone(210, 0.07, 'square', 0.06, 80);
        setTimeout(() => this.tone(420, 0.12, 'square', 0.05, 60), 55);
        break;
      case 'back':
        this.tone(300, 0.1, 'square', 0.05, -120);
        break;
      case 'start':
        this.burst(0.9, 300, 0.16, 'lowpass', 0.5, -220);
        this.tone(55, 1.1, 'sawtooth', 0.09, -20);
        break;
      case 'swing':
        this.burst(0.13, 900, 0.09, 'bandpass', 1.4, 1800);
        break;
      case 'hit':
        this.burst(0.12, 1600, 0.13, 'bandpass', 0.7, -900);
        this.tone(90, 0.09, 'square', 0.07, -40);
        break;
      case 'heavy':
        this.burst(0.3, 420, 0.16, 'lowpass', 0.6, -200);
        this.tone(60, 0.3, 'sawtooth', 0.1, -20);
        break;
      case 'hurt':
        this.tone(180, 0.2, 'sawtooth', 0.09, -110);
        this.burst(0.16, 500, 0.1, 'lowpass', 0.5, -200);
        break;
      case 'thunder':
        this.burst(2.4, 220, 0.12, 'lowpass', 0.4, -160);
        break;
      case 'jump':
        this.tone(250, 0.12, 'square', 0.05, 160);
        break;
      case 'land':
        this.burst(0.12, 260, 0.08, 'lowpass');
        break;
      case 'dash':
        this.burst(0.22, 1500, 0.09, 'bandpass', 1.1, -1000);
        break;
      case 'rage':
        this.tone(55, 0.9, 'sawtooth', 0.12, 160);
        this.burst(1.1, 500, 0.15, 'lowpass', 0.5, 400);
        break;
      case 'orb':
        this.tone(880, 0.06, 'triangle', 0.03, 260);
        break;
      case 'heal':
        this.tone(520, 0.1, 'triangle', 0.05, 220);
        setTimeout(() => this.tone(780, 0.14, 'triangle', 0.04, 120), 80);
        break;
      case 'enemyDie':
        this.burst(0.25, 350, 0.1, 'lowpass', 0.5, -150);
        this.tone(120, 0.22, 'sawtooth', 0.05, -60);
        break;
      case 'victory':
        [392, 494, 587, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.55, 'triangle', 0.06, 20), i * 130));
        break;
      case 'death':
        this.tone(220, 1.4, 'sawtooth', 0.1, -170);
        break;
      case 'kick':
        this.tone(65, 0.14, 'sine', 0.11, -30);
        this.burst(0.06, 120, 0.05, 'lowpass');
        break;
      case 'snare':
        this.burst(0.11, 1800, 0.045, 'highpass', 0.7);
        break;
      case 'hat':
        this.burst(0.045, 6000, 0.022, 'highpass', 0.6);
        break;
      default:
        break;
    }
  }
}

export const audio = new AudioEngine();
