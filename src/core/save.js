const KEY = 'turbo-strike-save-v1';

export const DEFAULT_SAVE = {
  version: 1,
  name: 'Piloto',
  credits: 1400,
  xp: 0,
  level: 1,
  owned: ['falcon', 'raptor'],
  car: 'falcon',
  online: { mmr: 640, wins: 0, losses: 0, streak: 0, best: 0 },
  offline: { mmr: 600, wins: 0, losses: 0, streak: 0, best: 0 },
  stats: { matches: 0, wins: 0, goals: 0, saves: 0, demolitions: 0, boost: 0, ownGoals: 0 },
  achievements: {},
  settings: {
    volume: 0.75,
    quality: 'high',
    camera: 'ball',
    shake: true,
    qualitySet: false,
  },
  daily: '',
  created: Date.now(),
  tutorialDone: false,
};

export function xpForLevel(level) {
  return 420 + (level - 1) * 260;
}

export function levelProgress(save) {
  const need = xpForLevel(save.level);
  return { need, current: save.xp, progress: Math.min(1, save.xp / need) };
}

export function addXp(save, amount) {
  save.xp += Math.max(0, Math.round(amount));
  let leveled = 0;
  let bonus = 0;
  while (save.xp >= xpForLevel(save.level)) {
    save.xp -= xpForLevel(save.level);
    save.level += 1;
    leveled += 1;
    bonus += 150;
  }
  return { leveled, bonus };
}

export const ACHIEVEMENTS = [
  { id: 'firstBlood', name: 'Primeira Vitória', desc: 'Vença sua primeira partida', reward: 200, check: (s) => s.stats.wins >= 1 },
  { id: 'goalmachine', name: 'Máquina de Gols', desc: 'Marque 10 gols', reward: 250, check: (s) => s.stats.goals >= 10 },
  { id: 'collector', name: 'Colecionador', desc: 'Tenha 5 carros na garagem', reward: 350, check: (s) => s.owned.length >= 5 },
  { id: 'rankedRookie', name: 'Degrau Acima', desc: 'Vença 3 partidas ranqueadas online', reward: 400, check: (s) => s.online.wins >= 3 },
  { id: 'aerial', name: 'Voador', desc: 'Use 1.000 de boost', reward: 150, check: (s) => s.stats.boost >= 1000 },
  { id: 'demolisher', name: 'Demolidor', desc: 'Destrua 5 rivais', reward: 300, check: (s) => s.stats.demolitions >= 5 },
  { id: 'veteran', name: 'Veterano', desc: 'Jogue 15 partidas', reward: 300, check: (s) => s.stats.matches >= 15 },
];

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    const parsed = JSON.parse(raw);
    const merged = structuredClone(DEFAULT_SAVE);
    deepMerge(merged, parsed);
    return merged;
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      deepMerge(target[key], value);
    } else if (value !== undefined) {
      target[key] = value;
    }
  }
  return target;
}

export class SaveStore {
  constructor() {
    this.data = loadSave();
    this._timer = null;
    this.migrate();
  }

  migrate() {
    const s = this.data;
    if (!s.settings.quality) s.settings.quality = 'high';
    if (!Array.isArray(s.owned) || !s.owned.length) s.owned = ['falcon', 'raptor'];
    if (!s.owned.includes('falcon')) s.owned.push('falcon');
    if (!s.owned.includes('raptor')) s.owned.push('raptor');
    if (!s.online) s.online = { mmr: 640, wins: 0, losses: 0, streak: 0, best: 0 };
    if (!s.offline) s.offline = { mmr: 600, wins: 0, losses: 0, streak: 0, best: 0 };
    this.flush();
  }

  save() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 120);
  }

  flush() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage full/blocked */ }
  }

  reset() {
    this.data = structuredClone(DEFAULT_SAVE);
    this.flush();
  }

  addCredits(n) {
    this.data.credits = Math.max(0, Math.round(this.data.credits + n));
    this.save();
  }

  spendCredits(n) {
    if (this.data.credits < n) return false;
    this.data.credits -= n;
    this.save();
    return true;
  }

  ownCar(id) {
    if (!this.data.owned.includes(id)) {
      this.data.owned.push(id);
      this.save();
    }
  }

  claimDaily() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.data.daily === today) return 0;
    this.data.daily = today;
    const amount = 300;
    this.data.credits += amount;
    this.save();
    return amount;
  }

  checkAchievements() {
    const unlocked = [];
    for (const a of ACHIEVEMENTS) {
      if (!this.data.achievements[a.id] && a.check(this.data)) {
        this.data.achievements[a.id] = Date.now();
        this.data.credits += a.reward;
        unlocked.push(a);
      }
    }
    if (unlocked.length) this.save();
    return unlocked;
  }
}
