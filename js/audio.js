/* Tiny procedural sound engine: UI clicks, blocks, footsteps and ambient music. */

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.music = null;
    this.noise = null;
    this.musicEnabled = true;
    this.musicVolume = 0.4;
    this.sfxVolume = 0.7;
    this.musicTimer = null;
    this.chordIndex = 0;
    this.started = false;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = this.sfxVolume;
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = this.musicEnabled ? this.musicVolume * 0.14 : 0;
    this.music.connect(this.master);

    const len = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.musicEnabled) this.startMusic();
  }

  setVolumes({ musicVolume, sfxVolume, musicEnabled }) {
    if (typeof musicVolume === 'number') this.musicVolume = musicVolume;
    if (typeof sfxVolume === 'number') this.sfxVolume = sfxVolume;
    if (typeof musicEnabled === 'boolean') this.musicEnabled = musicEnabled;
    if (!this.ctx) return;
    this.sfx.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
    const target = this.musicEnabled ? this.musicVolume * 0.14 : 0;
    this.music.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
    if (this.musicEnabled && !this.musicTimer) this.startMusic();
    if (!this.musicEnabled && this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
  }

  setMusicEnabled(on) {
    this.setVolumes({ musicEnabled: on });
  }

  makeNoise(duration, filterFreq, gain, type = 'lowpass') {
    if (!this.ctx || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + duration + 0.03);
  }

  tone(freq, duration, gain, type = 'triangle', freqEnd = null, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.sfx);
    osc.start(t);
    osc.stop(t + duration + 0.04);
  }

  click() {
    if (!this.ctx) return;
    this.makeNoise(0.055, 2100, 0.05, 'bandpass');
    this.tone(460, 0.07, 0.07, 'triangle', 300);
  }

  breakBlock(block) {
    if (!this.ctx) return;
    const map = {
      1: [520, 0.020], 2: [350, 0.028], 3: [900, 0.026], 4: [780, 0.026],
      5: [420, 0.024], 6: [640, 0.020], 7: [380, 0.020], 8: [560, 0.020],
      13: [980, 0.026], 14: [260, 0.02]
    };
    const [freq, gain] = map[block] || [500, 0.02];
    this.makeNoise(0.17, freq, gain * 2.1, 'lowpass');
    this.makeNoise(0.09, freq * 2.1, gain, 'bandpass');
    this.tone(freq * 0.28, 0.13, 0.035, 'sine', freq * 0.18);
  }

  placeBlock() {
    if (!this.ctx) return;
    this.makeNoise(0.06, 900, 0.035, 'lowpass');
    this.tone(180, 0.08, 0.06, 'square', 110);
    this.tone(320, 0.045, 0.02, 'triangle', 240);
  }

  step() {
    if (!this.ctx) return;
    const f = 85 + Math.random() * 45;
    this.makeNoise(0.07, 320 + Math.random() * 180, 0.02, 'lowpass');
    this.tone(f, 0.06, 0.012, 'sine', f * 0.7);
  }

  splash() {
    if (!this.ctx) return;
    this.makeNoise(0.28, 1400, 0.05, 'lowpass');
  }

  achievement() {
    if (!this.ctx) return;
    this.tone(659.25, 0.38, 0.055, 'triangle');
    this.tone(987.77, 0.55, 0.045, 'triangle', null, 0.13);
    this.tone(1318.5, 0.5, 0.025, 'sine', null, 0.26);
  }

  /* ---- ambient music: slow chord pads + sparse bells ---- */
  startMusic() {
    if (!this.ctx || !this.musicEnabled || this.musicTimer) return;
    this.scheduleChord(1.2);
  }

  scheduleChord(delay) {
    this.musicTimer = setTimeout(() => {
      this.musicTimer = null;
      if (!this.musicEnabled) return;
      this.playChord();
      this.scheduleChord(7200 + Math.random() * 2600);
    }, delay * 1000);
  }

  playChord() {
    if (!this.ctx || !this.musicEnabled) return;
    const chords = [
      [130.81, 196.0, 261.63, 329.63],
      [110.0, 174.61, 220.0, 293.66],
      [98.0, 146.83, 196.0, 246.94],
      [116.54, 174.61, 233.08, 293.66]
    ];
    const chord = chords[this.chordIndex % chords.length];
    this.chordIndex++;
    const t = this.ctx.currentTime;
    chord.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700 + i * 120;
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      const gain = 0.16 / (i + 1.4);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + 2.4);
      g.gain.linearRampToValueAtTime(0.0001, t + 9.6);
      osc.connect(filter).connect(g).connect(this.music);
      osc.start(t);
      osc.stop(t + 10);
    });
    // sparse bell melody
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0];
    if (Math.random() < 0.8) {
      const note = notes[Math.floor(Math.random() * notes.length)];
      const delay = 1.5 + Math.random() * 4;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note;
      const start = t + delay;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.022, start + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 2.6);
      osc.connect(g).connect(this.music);
      osc.start(start);
      osc.stop(start + 2.8);
    }
  }
}
