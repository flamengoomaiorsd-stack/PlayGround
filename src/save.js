// Persistent progress + settings stored in localStorage.
const KEY = 'ashes-of-olympus-v1';

const DEFAULTS = {
  settings: {
    volume: 0.65,
    shake: true,
    blood: true,
    crt: true,
  },
  progress: {
    bestScore: 0,
    maxWave: 0,
    kills: 0,
    deaths: 0,
    runs: 0,
    cleared: false,
    run: null, // { wave, score, hp, rage } checkpoint
    unlocked: [],
  },
};

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export const Save = {
  data: clone(DEFAULTS),

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = {
          settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
          progress: { ...DEFAULTS.progress, ...(parsed.progress || {}) },
        };
      }
    } catch {
      this.data = clone(DEFAULTS);
    }
    return this.data;
  },

  persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* private mode / storage blocked: game still works for the session */
    }
  },

  get settings() { return this.data.settings; },
  get progress() { return this.data.progress; },

  setSetting(key, value) {
    this.data.settings[key] = value;
    this.persist();
  },

  checkpoint(run) {
    this.data.progress.run = run ? { ...run } : null;
    this.persist();
  },

  clearCheckpoint() {
    this.data.progress.run = null;
    this.persist();
  },

  recordRun({ score, wave, kills, cleared = false, died = false }) {
    const p = this.data.progress;
    p.bestScore = Math.max(p.bestScore, Math.floor(score));
    p.maxWave = Math.max(p.maxWave, wave);
    p.kills += kills;
    if (died) p.deaths += 1;
    if (cleared) p.cleared = true;
    if (cleared) p.run = null;
    this.persist();
  },

  unlock(...ids) {
    const p = this.data.progress;
    let added = false;
    for (const id of ids) {
      if (!p.unlocked.includes(id)) {
        p.unlocked.push(id);
        added = true;
      }
    }
    if (added) this.persist();
    return added;
  },

  reset() {
    this.data = clone(DEFAULTS);
    this.persist();
  },
};

export const TREASURES = [
  {
    id: 'blades',
    name: 'LAMINAS DO CAOS',
    desc: 'Duas laminas forjadas no inferno. Sempre com voce.',
    always: true,
  },
  {
    id: 'firstblood',
    name: 'PRIMEIRO SANGUE',
    desc: 'Derrame o sangue do primeiro soldado caido.',
  },
  {
    id: 'centurion',
    name: 'CARNIFICINA',
    desc: 'Elimine 25 inimigos no total.',
  },
  {
    id: 'titan',
    name: 'MATADOR DE TITAS',
    desc: 'Derrube o Minotauro de Hades.',
  },
  {
    id: 'unbroken',
    name: 'INQUEBRADO',
    desc: 'Conclua uma onda sem levar dano.',
  },
  {
    id: 'god',
    name: 'DEUS DA GUERRA',
    desc: 'Sobreviva as cinco ondas e vença a arena.',
  },
];
