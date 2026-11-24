export const TIERS = [
  { id: 'bronze', name: 'Bronze', min: 0, color: '#c07b4a', color2: '#7a4426', glow: 'rgba(192,123,74,.4)' },
  { id: 'prata', name: 'Prata', min: 300, color: '#d7e1ec', color2: '#8494a6', glow: 'rgba(215,225,236,.4)' },
  { id: 'ouro', name: 'Ouro', min: 600, color: '#ffd76a', color2: '#d99a1e', glow: 'rgba(255,215,106,.45)' },
  { id: 'platina', name: 'Platina', min: 900, color: '#a9f2ff', color2: '#3fa7c4', glow: 'rgba(169,242,255,.45)' },
  { id: 'diamante', name: 'Diamante', min: 1200, color: '#b1c0ff', color2: '#5564ff', glow: 'rgba(177,192,255,.45)' },
  { id: 'campeao', name: 'Campeão', min: 1500, color: '#dcaaff', color2: '#7a35dd', glow: 'rgba(220,170,255,.45)' },
  { id: 'gc', name: 'Grande Campeão', min: 1800, color: '#ffb35c', color2: '#e8471a', glow: 'rgba(255,179,92,.5)' },
  { id: 'lenda', name: 'Lenda Supersônica', min: 2100, color: '#8bf7ff', color2: '#ff5f8f', glow: 'rgba(139,247,255,.55)' },
];

const DIVISION_LABELS = ['I', 'II', 'III'];

export function getRank(mmr = 0) {
  const value = Math.max(0, Math.round(mmr));
  let index = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (value >= TIERS[i].min) { index = i; break; }
  }
  const tier = TIERS[index];
  const nextTier = TIERS[index + 1] || null;
  const span = 300;
  const intoTier = Math.min(value - tier.min, span - 1);
  const division = Math.min(2, Math.floor(intoTier / 100));
  const intoDivision = intoTier - division * 100;
  return {
    tier,
    tierIndex: index,
    division,
    divisionLabel: DIVISION_LABELS[division],
    name: index >= 6 ? tier.name : `${tier.name} ${DIVISION_LABELS[division]}`,
    shortName: tier.name,
    color: tier.color,
    color2: tier.color2,
    progress: Math.min(1, intoDivision / 100),
    mmr: value,
    nextTier: nextTier ? nextTier.name : null,
    mmrToNext: nextTier ? nextTier.min - value : 0,
  };
}

export function rankEmblem(rank, size = 64) {
  const tier = rank.tier || rank;
  const idx = TIERS.findIndex((t) => t.id === tier.id);
  const uid = `rg-${tier.id}-${Math.random().toString(36).slice(2, 8)}`;
  const chevrons = Math.min(5, idx + 1);
  const shine = idx >= 5;
  let marks = '';
  for (let i = 0; i < chevrons; i++) {
    const y = 62 + i * 7;
    marks += `<path d="M${50 - 9 - i * 0.6} ${y} L50 ${y + 5} L${50 + 9 + i * 0.6} ${y} L50 ${y + 2} Z" fill="${i % 2 === 0 ? 'rgba(255,255,255,.82)' : 'rgba(255,255,255,.42)'}"/>`;
  }
  if (idx >= 6) {
    marks += `<path d="M50 26 l3.1 6.6 7.2 1-5.2 5.1 1.2 7.2L50 42.5l-6.3 3.4 1.2-7.2-5.2-5.1 7.2-1z" fill="rgba(255,255,255,.92)"/>`;
  } else if (idx >= 4) {
    marks += `<path d="M50 30 l5.5 5.5L50 41l-5.5-5.5z" fill="rgba(255,255,255,.85)"/>`;
  } else {
    marks += `<circle cx="50" cy="36" r="5" fill="rgba(255,255,255,.75)"/>`;
  }
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <defs>
      <linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${tier.color}"/><stop offset="1" stop-color="${tier.color2}"/>
      </linearGradient>
      <linearGradient id="${uid}-b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(255,255,255,.30)"/><stop offset="1" stop-color="rgba(0,0,0,.35)"/>
      </linearGradient>
      <filter id="${uid}-f"><feDropShadow dx="0" dy="0" stdDeviation="2.4" flood-color="${tier.color}" flood-opacity="${shine ? 0.8 : 0.45}"/></filter>
    </defs>
    <g filter="url(#${uid}-f)">
      <path d="M50 3 L87 16 L85 56 Q82 81 50 97 Q18 81 15 56 L13 16 Z" fill="url(#${uid})" stroke="rgba(255,255,255,.35)" stroke-width="1.6"/>
      <path d="M50 8 L82 19 L80 55 Q78 76 50 91 Q22 76 20 55 L18 19 Z" fill="url(#${uid}-b)"/>
      <path d="M50 8 L82 19 L80 55 Q78 76 50 91" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/>
    </g>
    <path d="M27 21 L50 15 L73 21" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.4"/>
    ${marks}
  </svg>`;
}

export function divisionUpset(mmr, delta) {
  const before = getRank(mmr);
  const after = getRank(mmr + delta);
  const changed = before.tier.id !== after.tier.id || before.division !== after.division;
  return { before, after, changed };
}

export const BOT_NAMES = [
  'TurboLucas', 'DriftKing', 'NitroZé', 'BolaDeFogo', 'AyrtonAI', 'Kickflip',
  'GolContra', 'AsaDelta', 'PneuFurado', 'Missil', 'RocketRafa', 'DribleMestre',
  'CapitaoBoost', 'Fogueteiro', 'SniperDoGol', 'Muralha', 'PernaDePau', 'PiqueTa',
  'Vortex', 'CavaloDeAco', 'ZebraElétrica', 'ManoDoDrift', 'OFormiga', 'Trovão',
];

export const LEADERBOARD_NAMES = [
  'NitroWolf', 'Kaximbo', 'SkyDrift', 'ViniRL', 'PulseFire', 'ZéDoBoost', 'AerialAce',
  'MuralhaBR', 'TurboTico', 'GolDePlaca', 'Foguete_77', 'DriftNinja',
];

export function buildLeaderboard(playerMmr, playerName, online = true) {
  const base = [
    { mmr: 2412, wins: 412 }, { mmr: 2240, wins: 366 }, { mmr: 2108, wins: 341 },
    { mmr: 1974, wins: 302 }, { mmr: 1842, wins: 287 }, { mmr: 1716, wins: 254 },
    { mmr: 1598, wins: 231 }, { mmr: 1470, wins: 198 }, { mmr: 1333, wins: 176 },
    { mmr: 1180, wins: 153 }, { mmr: 1024, wins: 129 }, { mmr: 887, wins: 104 },
    { mmr: 742, wins: 87 },
  ];
  const rows = base.map((row, i) => ({
    name: LEADERBOARD_NAMES[i % LEADERBOARD_NAMES.length],
    mmr: row.mmr,
    wins: row.wins,
    tier: getRank(row.mmr),
    you: false,
  }));
  rows.push({ name: playerName || 'Você', mmr: Math.round(playerMmr), wins: 0, tier: getRank(playerMmr), you: true });
  rows.sort((a, b) => b.mmr - a.mmr);
  return rows.slice(0, 20).map((row, i) => ({ ...row, pos: i + 1 }));
}
