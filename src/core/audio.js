// Synthesized audio — engine, tires, impacts, crowd and UI. No external assets.
export class GameAudio {
  constructor(volume = 0.75) {
    this.volume = volume;
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.crowd = null;
    this.ready = false;
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 22;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise(2);
      this.ready = true;
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch { this.ready = false; }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
  }

  makeNoise(seconds = 1) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  noiseSource(loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = loop;
    return src;
  }

  startCrowd() {
    this.init();
    if (!this.ready || this.crowd) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoise(3);
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.6;
    const filter2 = this.ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.value = 1400;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.03;
    src.connect(filter); filter.connect(filter2); filter2.connect(gain); gain.connect(this.master);
    src.start();
    this.crowd = { src, gain, filter };
  }

  crowdIntensity(level = 0) {
    if (!this.crowd) return;
    const t = this.ctx.currentTime;
    this.crowd.gain.gain.setTargetAtTime(0.022 + level * 0.055, t, 0.4);
    this.crowd.filter.frequency.setTargetAtTime(520 + level * 620, t, 0.6);
  }

  stopCrowd() {
    if (!this.crowd) return;
    try { this.crowd.src.stop(); } catch {}
    this.crowd = null;
  }

  startEngine() {
    this.init();
    if (!this.ready || this.engine) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 4;
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 55;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 28;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    osc1.connect(filter);
    osc2.connect(g2); g2.connect(filter);
    filter.connect(out);
    out.connect(this.master);
    osc1.start(); osc2.start();
    const turboSrc = this.noiseSource(true);
    const turboFilter = ctx.createBiquadFilter();
    turboFilter.type = 'bandpass'; turboFilter.frequency.value = 1200; turboFilter.Q.value = 0.8;
    const turboGain = ctx.createGain(); turboGain.gain.value = 0;
    turboSrc.connect(turboFilter); turboFilter.connect(turboGain); turboGain.connect(this.master);
    turboSrc.start();
    const tireSrc = this.noiseSource(true);
    const tireFilter = ctx.createBiquadFilter();
    tireFilter.type = 'highpass'; tireFilter.frequency.value = 2400;
    const tireGain = ctx.createGain(); tireGain.gain.value = 0;
    tireSrc.connect(tireFilter); tireFilter.connect(tireGain); tireGain.connect(this.master);
    tireSrc.start();
    this.engine = { out, filter, osc1, osc2, turboGain, turboFilter, tireGain, tireSrc };
  }

  updateEngine(speed = 0, throttle = 0, boosting = false, drifting = false, airborne = false, active = true) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const norm = Math.min(1, Math.abs(speed) / 44);
    const base = 46 + norm * 118 + (boosting ? 22 : 0);
    this.engine.osc1.frequency.setTargetAtTime(base, t, 0.08);
    this.engine.osc2.frequency.setTargetAtTime(base * 0.5, t, 0.08);
    this.engine.filter.frequency.setTargetAtTime(420 + norm * 1500 + (boosting ? 700 : 0), t, 0.09);
    this.engine.out.gain.setTargetAtTime(active && !airborne ? 0.05 + Math.abs(throttle) * 0.045 + norm * 0.02 : 0.02, t, 0.12);
    this.engine.turboGain.gain.setTargetAtTime(boosting ? 0.1 : 0, t, 0.08);
    this.engine.turboFilter.frequency.setTargetAtTime(boosting ? 2200 : 900, t, 0.1);
    this.engine.tireGain.gain.setTargetAtTime(drifting && !airborne ? 0.055 : 0, t, 0.05);
  }

  stopEngine() {
    if (!this.engine) return;
    const e = this.engine;
    try {
      e.osc1.stop(); e.osc2.stop(); e.turboGain.disconnect(); e.tireSrc.stop();
      e.out.disconnect();
    } catch {}
    this.engine = null;
  }

  blip(freq = 440, dur = 0.08, type = 'sine', gain = 0.12, slide = 0) {
    this.init();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  noiseBurst(dur = 0.12, gain = 0.2, freq = 900, type = 'bandpass', q = 0.9) {
    this.init();
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const src = this.noiseSource(false);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  ui(kind = 'click') {
    if (kind === 'back') this.blip(280, 0.06, 'triangle', 0.07, -80);
    else if (kind === 'hover') this.blip(520, 0.03, 'sine', 0.025);
    else if (kind === 'error') { this.blip(160, 0.16, 'sawtooth', 0.08, -60); }
    else if (kind === 'buy') { this.blip(520, 0.09, 'triangle', 0.1); setTimeout(() => this.blip(780, 0.16, 'triangle', 0.1), 90); }
    else if (kind === 'levelup') { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.24, 'triangle', 0.09), i * 90)); }
    else this.blip(620, 0.05, 'triangle', 0.06);
  }

  hit(power = 1) {
    const p = Math.min(1.6, power);
    this.noiseBurst(0.09 + p * 0.05, 0.1 + p * 0.14, 1100 + p * 700, 'bandpass', 0.8);
    this.blip(120 - p * 30, 0.12 + p * 0.06, 'sine', 0.16 + p * 0.1, -60);
  }

  jump() { this.blip(220, 0.16, 'sine', 0.07, 300); this.noiseBurst(0.1, 0.05, 2200, 'highpass', 0.7); }
  flip() { this.blip(300, 0.2, 'triangle', 0.07, 500); this.noiseBurst(0.14, 0.06, 1800, 'bandpass', 1.2); }
  land() { this.noiseBurst(0.08, 0.07, 300, 'lowpass', 0.7); }
  boostPickup(big = false) {
    const base = big ? 420 : 620;
    this.blip(base, 0.09, 'triangle', 0.06, 180);
    if (big) setTimeout(() => this.blip(base * 1.5, 0.12, 'triangle', 0.05, 220), 70);
  }
  demolish() {
    this.noiseBurst(0.45, 0.35, 260, 'lowpass', 0.6);
    this.blip(70, 0.5, 'sawtooth', 0.18, -40);
  }
  goal(forBlue = true) {
    const notes = forBlue ? [392, 494, 587, 784] : [370, 466, 554, 740];
    notes.forEach((f, i) => setTimeout(() => {
      this.blip(f, 0.5, 'sawtooth', 0.055, 4);
      this.blip(f * 2, 0.35, 'square', 0.018, 0);
    }, i * 90));
    this.crowdIntensity(1);
    setTimeout(() => this.crowdIntensity(0.2), 2600);
    this.noiseBurst(1.4, 0.06, 800, 'bandpass', 0.5);
  }
  countdown(n) {
    if (n > 0) this.blip(440, 0.14, 'square', 0.08);
    else { this.blip(880, 0.4, 'square', 0.1); this.blip(1320, 0.3, 'sine', 0.05); }
  }
  whistle() {
    this.blip(1600, 0.5, 'sine', 0.08, 200);
    this.blip(2100, 0.45, 'sine', 0.05, -200);
  }
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.blip(f, 0.35, 'triangle', 0.08), i * 110));
    this.crowdIntensity(0.8);
    setTimeout(() => this.crowdIntensity(0.15), 2800);
  }
  lose() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.4, 'sine', 0.08), i * 160));
  }
}
