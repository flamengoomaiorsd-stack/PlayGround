import * as THREE from '../vendor/three.module.js';

/* ============================================================
   Blocks & tiles
   ============================================================ */
export const BLOCKS = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5, LOG: 6,
  LEAVES: 7, PLANKS: 8, WATER: 9, TALLGRASS: 10, POPPY: 11,
  DANDELION: 12, SNOW: 13, BEDROCK: 14
};

export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, COBBLE: 4, SAND: 5,
  LOG_SIDE: 6, LOG_TOP: 7, LEAVES: 8, PLANKS: 9, WATER: 10,
  TALLGRASS: 11, POPPY: 12, DANDELION: 13, SNOW: 14, BEDROCK: 15
};

export const IS_PLANT = b => b === BLOCKS.TALLGRASS || b === BLOCKS.POPPY || b === BLOCKS.DANDELION;
export const IS_SOLID = b => b !== BLOCKS.AIR && b !== BLOCKS.WATER && !IS_PLANT(b);
export const IS_OPAQUE = b => b !== BLOCKS.AIR && b !== BLOCKS.WATER && !IS_PLANT(b);

const TILE_COUNT = 16;
const CELL = 32;          // padded atlas cell (16px art + 8px bleed)
const ART = 16;
const ATLAS_COLS = 8;
const ATLAS_SIZE = CELL * ATLAS_COLS;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function newTile() {
  const c = document.createElement('canvas');
  c.width = ART; c.height = ART;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
}

function px(g, x, y, color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }

function noiseFill(g, colors, rnd, weights) {
  for (let y = 0; y < ART; y++) {
    for (let x = 0; x < ART; x++) {
      let idx;
      if (weights) {
        const r = rnd();
        idx = 0; let acc = 0;
        for (let i = 0; i < weights.length; i++) { acc += weights[i]; if (r < acc) { idx = i; break; } }
      } else idx = Math.floor(rnd() * colors.length);
      px(g, x, y, colors[idx]);
    }
  }
}

function makeTiles() {
  const tiles = [];
  const add = fn => {
    const t = newTile();
    fn(t.g, mulberry32(1234 + tiles.length * 777));
    tiles.push(t.c);
  };

  // 0 grass top
  add((g, rnd) => {
    noiseFill(g, ['#5f9340', '#6ba247', '#548536', '#77b04f', '#4c7c31'], rnd, [0.35, 0.28, 0.18, 0.13, 0.06]);
    for (let i = 0; i < 10; i++) {
      const x = (rnd() * 16) | 0, y = (rnd() * 16) | 0;
      px(g, x, y, rnd() < .5 ? '#86c05d' : '#3f6829');
    }
    for (let i = 0; i < 4; i++) {
      const x = (rnd() * 15) | 0, y = (rnd() * 15) | 0;
      g.fillStyle = 'rgba(38,66,24,.30)';
      g.fillRect(x, y, 2, 1);
    }
  });

  // 1 grass side
  add((g, rnd) => {
    noiseFill(g, ['#8b6243', '#7d5638', '#956b49', '#734d31', '#a0754f'], rnd, [0.32, 0.26, 0.2, 0.16, 0.06]);
    for (let x = 0; x < 16; x++) {
      const edge = 3 + ((x % 4 === 0) ? 1 : 0) + (rnd() < .35 ? 1 : 0);
      for (let y = 0; y < edge; y++) {
        const colors = ['#5d8f3d', '#6a9f46', '#528033', '#76ab4d'];
        px(g, x, y, colors[(rnd() * colors.length) | 0]);
      }
      if (rnd() < .5) px(g, x, edge, '#4d7c30');
    }
    for (let i = 0; i < 8; i++) {
      px(g, (rnd() * 16) | 0, 5 + ((rnd() * 11) | 0), 'rgba(55,38,22,.45)');
    }
  });

  // 2 dirt
  add((g, rnd) => {
    noiseFill(g, ['#8a6142', '#7a5336', '#946a48', '#6f4b30', '#a07750'], rnd, [0.3, 0.26, 0.22, 0.16, 0.06]);
    for (let i = 0; i < 14; i++) {
      const x = (rnd() * 15) | 0, y = (rnd() * 15) | 0;
      g.fillStyle = rnd() < .5 ? 'rgba(52,36,21,.4)' : 'rgba(184,146,106,.23)';
      g.fillRect(x, y, 2, rnd() < .4 ? 2 : 1);
    }
  });

  // 3 stone
  add((g, rnd) => {
    noiseFill(g, ['#8b8b8b', '#7f7f7f', '#969696', '#767676', '#a0a0a0'], rnd, [0.3, 0.26, 0.2, 0.18, 0.06]);
    for (let i = 0; i < 7; i++) {
      const x = (rnd() * 13) | 0, y = (rnd() * 14) | 0;
      g.fillStyle = 'rgba(60,60,60,.42)';
      g.fillRect(x, y, 2 + ((rnd() * 3) | 0), 1);
      if (rnd() < .5) g.fillRect(x + 1, y + 1, 2, 1);
    }
    for (let i = 0; i < 6; i++) px(g, (rnd() * 16) | 0, (rnd() * 16) | 0, 'rgba(220,220,220,.25)');
  });

  // 4 cobblestone
  add((g, rnd) => {
    noiseFill(g, ['#777777', '#8a8a8a', '#6b6b6b', '#969696'], rnd);
    g.fillStyle = 'rgba(43,43,43,.85)';
    g.fillRect(0, 5, 16, 1); g.fillRect(0, 11, 16, 1);
    g.fillRect(5, 0, 1, 5); g.fillRect(11, 0, 1, 5);
    g.fillRect(2, 6, 1, 5); g.fillRect(9, 6, 1, 5); g.fillRect(14, 6, 1, 5);
    g.fillRect(5, 12, 1, 4); g.fillRect(12, 12, 1, 4);
    for (let i = 0; i < 16; i++) {
      const x = (rnd() * 16) | 0, y = (rnd() * 16) | 0;
      px(g, x, y, rnd() < .5 ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.2)');
    }
  });

  // 5 sand
  add((g, rnd) => {
    noiseFill(g, ['#e2d2a2', '#d9c795', '#ecdcac', '#cfbd8b', '#f2e6bd'], rnd, [0.3, 0.26, 0.2, 0.16, 0.08]);
    for (let i = 0; i < 12; i++) {
      const x = (rnd() * 15) | 0, y = (rnd() * 15) | 0;
      g.fillStyle = 'rgba(160,140,95,.3)';
      g.fillRect(x, y, 2, 1);
    }
  });

  // 6 log side
  add((g, rnd) => {
    for (let x = 0; x < 16; x++) {
      const base = ['#6b4e2f', '#7a5837', '#5d4328', '#83613d', '#6f5232'][(rnd() * 5) | 0];
      g.fillStyle = base; g.fillRect(x, 0, 1, 16);
      if (rnd() < .45) { g.fillStyle = 'rgba(40,26,13,.35)'; g.fillRect(x, (rnd() * 13) | 0, 1, 3 + ((rnd() * 3) | 0)); }
      if (rnd() < .3) { g.fillStyle = 'rgba(190,154,110,.18)'; g.fillRect(x, (rnd() * 14) | 0, 1, 2); }
    }
    for (let i = 0; i < 3; i++) {
      const x = (rnd() * 14) | 0, y = (rnd() * 14) | 0;
      g.fillStyle = 'rgba(45,30,16,.55)';
      g.fillRect(x, y, 2, 1); g.fillRect(x, y + 1, 1, 1);
    }
  });

  // 7 log top
  add((g, rnd) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        const ring = Math.floor(d) % 3;
        const col = ['#b08a58', '#9a7648', '#c29c68'][ring];
        px(g, x, y, col);
        if (rnd() < .12) px(g, x, y, '#7d5f39');
      }
    }
    g.fillStyle = 'rgba(80,58,30,.5)';
    g.fillRect(0, 0, 16, 1); g.fillRect(0, 15, 16, 1); g.fillRect(0, 0, 1, 16); g.fillRect(15, 0, 1, 16);
    g.fillStyle = '#5f4527'; g.fillRect(7, 7, 2, 2);
  });

  // 8 leaves
  add((g, rnd) => {
    noiseFill(g, ['#2f6326', '#3a762e', '#28551f', '#44853a', '#356b2a'], rnd, [0.26, 0.26, 0.2, 0.14, 0.14]);
    for (let i = 0; i < 22; i++) {
      const x = (rnd() * 16) | 0, y = (rnd() * 16) | 0;
      px(g, x, y, rnd() < .55 ? 'rgba(16,38,12,.55)' : 'rgba(122,180,92,.35)');
    }
  });

  // 9 planks
  add((g, rnd) => {
    noiseFill(g, ['#b28a57', '#a67e4d', '#bd9561', '#987144', '#c9a06b'], rnd, [0.3, 0.24, 0.2, 0.14, 0.12]);
    for (let y = 3; y < 16; y += 4) {
      g.fillStyle = 'rgba(85,58,30,.62)';
      g.fillRect(0, y, 16, 1);
      for (let x = 0; x < 16; x += 8) {
        g.fillRect(x + (y % 8 === 3 ? 0 : 4), y, 1, 4);
      }
    }
    for (let i = 0; i < 9; i++) {
      g.fillStyle = 'rgba(120,85,47,.35)';
      g.fillRect((rnd() * 14) | 0, (rnd() * 16) | 0, 2 + ((rnd() * 3) | 0), 1);
    }
  });

  // 10 water
  add((g, rnd) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const v = 0.5 + 0.18 * Math.sin((x + y * 1.7) * 0.9) + rnd() * 0.13;
        const r = Math.round(38 + 26 * v), gg = Math.round(92 + 50 * v), b = Math.round(168 + 56 * v);
        px(g, x, y, `rgb(${r},${gg},${b})`);
      }
    }
    for (let i = 0; i < 5; i++) {
      const x = (rnd() * 12) | 0, y = (rnd() * 15) | 0;
      g.fillStyle = 'rgba(224,244,255,.42)';
      g.fillRect(x, y, 3 + ((rnd() * 3) | 0), 1);
    }
  });

  // 11 tall grass
  add((g, rnd) => {
    g.clearRect(0, 0, 16, 16);
    for (let i = 0; i < 8; i++) {
      const bx = 2 + ((rnd() * 12) | 0);
      const h = 5 + ((rnd() * 9) | 0);
      const col = ['#4f8635', '#5f9c40', '#437529', '#6ca84a'][(rnd() * 4) | 0];
      for (let y = 0; y < h; y++) {
        const x = bx + Math.round(Math.sin((y / h) * 2.2) * 0.7);
        if (x >= 0 && x < 16) px(g, x, 15 - y, col);
      }
    }
  });

  // 12 poppy
  add((g, rnd) => {
    g.clearRect(0, 0, 16, 16);
    g.fillStyle = '#3d6b2a';
    g.fillRect(7, 7, 2, 9);
    g.fillRect(8, 11, 3, 1);
    g.fillRect(6, 12, 1, 1);
    g.fillStyle = '#4d7f35'; g.fillRect(9, 9, 2, 1);
    const petals = ['#c8322c', '#e0443c', '#a72420'];
    for (let i = 0; i < 12; i++) {
      const x = 5 + ((rnd() * 6) | 0), y = 2 + ((rnd() * 5) | 0);
      px(g, x, y, petals[(rnd() * 3) | 0]);
    }
    g.fillStyle = '#e8c14a'; g.fillRect(7, 5, 2, 2);
    g.fillStyle = '#2f2013'; g.fillRect(7, 6, 1, 1);
  });

  // 13 dandelion
  add((g, rnd) => {
    g.clearRect(0, 0, 16, 16);
    g.fillStyle = '#3d6b2a';
    g.fillRect(7, 8, 2, 8);
    g.fillRect(9, 12, 2, 1);
    g.fillRect(5, 13, 2, 1);
    for (let i = 0; i < 10; i++) {
      const x = 5 + ((rnd() * 7) | 0), y = 3 + ((rnd() * 5) | 0);
      px(g, x, y, ['#e8cf3c', '#f5e458', '#c9ae27'][(rnd() * 3) | 0]);
    }
    g.fillStyle = '#a88a1c'; g.fillRect(7, 5, 2, 1);
  });

  // 14 snow
  add((g, rnd) => {
    noiseFill(g, ['#f2f7fb', '#e7eef6', '#fbfdff', '#dbe6f0', '#ffffff'], rnd, [0.3, 0.24, 0.2, 0.14, 0.12]);
    for (let i = 0; i < 8; i++) px(g, (rnd() * 16) | 0, (rnd() * 16) | 0, 'rgba(168,196,224,.35)');
  });

  // 15 bedrock
  add((g, rnd) => {
    noiseFill(g, ['#3d3d3d', '#4f4f4f', '#2f2f2f', '#5c5c5c', '#262626'], rnd, [0.28, 0.24, 0.22, 0.16, 0.1]);
    for (let i = 0; i < 18; i++) {
      const x = (rnd() * 15) | 0, y = (rnd() * 15) | 0;
      px(g, x, y, rnd() < .5 ? '#1b1b1b' : '#6b6b6b');
    }
  });

  return tiles.slice(0, TILE_COUNT);
}

let _tiles = null;
export function tiles() {
  if (!_tiles) _tiles = makeTiles();
  return _tiles;
}

function buildAtlasCanvas() {
  const atlas = document.createElement('canvas');
  atlas.width = ATLAS_SIZE; atlas.height = ATLAS_SIZE;
  const g = atlas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const list = tiles();
  for (let i = 0; i < list.length; i++) {
    const col = i % ATLAS_COLS, row = (i / ATLAS_COLS) | 0;
    const cx = col * CELL, cy = row * CELL;
    const ox = cx + (CELL - ART) / 2, oy = cy + (CELL - ART) / 2;
    g.clearRect(cx, cy, CELL, CELL);
    // edge bleed padding (helps mipmaps / filtering)
    g.drawImage(list[i], 0, 0, ART, 1, ox, oy - 8, ART, 8);
    g.drawImage(list[i], 0, ART - 1, ART, 1, ox, oy + ART, ART, 8);
    g.drawImage(list[i], 0, 0, 1, ART, ox - 8, oy, 8, ART);
    g.drawImage(list[i], ART - 1, 0, 1, ART, ox + ART, oy, 8, ART);
    g.fillStyle = '#000';
    g.imageSmoothingEnabled = false;
    g.drawImage(list[i], ox, oy);
    // corners
    g.drawImage(list[i], 0, 0, 1, 1, ox - 8, oy - 8, 8, 8);
    g.drawImage(list[i], ART - 1, 0, 1, 1, ox + ART, oy - 8, 8, 8);
    g.drawImage(list[i], 0, ART - 1, 1, 1, ox - 8, oy + ART, 8, 8);
    g.drawImage(list[i], ART - 1, ART - 1, 1, 1, ox + ART, oy + ART, 8, 8);
  }
  return atlas;
}

let _atlasCanvas = null;
let _atlasTexture = null;
export function atlasTexture() {
  if (!_atlasTexture) {
    if (!_atlasCanvas) _atlasCanvas = buildAtlasCanvas();
    _atlasTexture = new THREE.CanvasTexture(_atlasCanvas);
    _atlasTexture.magFilter = THREE.NearestFilter;
    _atlasTexture.minFilter = THREE.NearestFilter;
    _atlasTexture.generateMipmaps = false;
    _atlasTexture.colorSpace = THREE.SRGBColorSpace;
    _atlasTexture.wrapS = THREE.ClampToEdgeWrapping;
    _atlasTexture.wrapT = THREE.ClampToEdgeWrapping;
  }
  return _atlasTexture;
}

const uvCache = [];
export function tileUV(tile) {
  if (uvCache[tile]) return uvCache[tile];
  const col = tile % ATLAS_COLS, row = (tile / ATLAS_COLS) | 0;
  const px0 = col * CELL + (CELL - ART) / 2;
  const py0 = row * CELL + (CELL - ART) / 2;
  const uv = {
    u0: px0 / ATLAS_SIZE,
    u1: (px0 + ART) / ATLAS_SIZE,
    v0: 1 - (py0 + ART) / ATLAS_SIZE,
    v1: 1 - py0 / ATLAS_SIZE
  };
  uvCache[tile] = uv;
  return uv;
}

const iconCache = new Map();
export function tileDataURL(tile, scale = 4) {
  const key = tile + ':' + scale;
  if (iconCache.has(key)) return iconCache.get(key);
  const src = tiles()[tile];
  const c = document.createElement('canvas');
  c.width = ART * scale; c.height = ART * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/png');
  iconCache.set(key, url);
  return url;
}

let dirtURL = null;
export function dirtBackgroundURL() {
  if (dirtURL) return dirtURL;
  const dirt = tiles()[TILE.DIRT];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const rnd = mulberry32(99);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      g.drawImage(dirt, x * 16, y * 16);
      g.fillStyle = rnd() < .5 ? `rgba(0,0,0,${0.03 + rnd() * .06})` : `rgba(255,235,205,${0.02 + rnd() * .04})`;
      g.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  dirtURL = c.toDataURL('image/png');
  return dirtURL;
}

export function grassIconURL() {
  // small isometric-ish dirt/grass icon for world entries
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const grass = tiles()[TILE.GRASS_TOP];
  const dirt = tiles()[TILE.DIRT];
  const side = tiles()[TILE.GRASS_SIDE];
  g.drawImage(side, 0, 0, 16, 16, 8, 16, 48, 40);
  g.save();
  g.translate(8, 16); g.transform(1, -0.55, 1, 0.55, 0, 0);
  g.drawImage(grass, 0, 0, 16, 16, 0, 0, 24, 24);
  g.restore();
  g.save();
  g.translate(36, 6); g.transform(1, 0.55, -1, 0.55, 0, 0);
  g.drawImage(grass, 0, 0, 16, 16, 0, 0, 24, 24);
  g.restore();
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(8, 52, 48, 4);
  g.drawImage(dirt, 0, 0, 16, 16, 8, 40, 48, 14);
  return c.toDataURL('image/png');
}

export function serverIconURL(hue = 200) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, `hsl(${hue}, 46%, 38%)`);
  grd.addColorStop(1, `hsl(${hue + 30}, 42%, 16%)`);
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(0,0,0,.28)';
  for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 64, 1);
  for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 1, 64);
  g.fillStyle = 'rgba(255,255,255,.18)';
  g.fillRect(8, 8, 20, 20);
  g.fillStyle = 'rgba(255,255,255,.1)';
  g.fillRect(36, 36, 20, 20);
  g.fillStyle = '#eaeaea';
  g.fillRect(20, 27, 24, 3);
  g.fillStyle = 'hsl(' + hue + ', 60%, 62%)';
  g.fillRect(20, 34, 16, 3);
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(0, 58, 64, 6);
  return c.toDataURL('image/png');
}

/* ============================================================
   Noise
   ============================================================ */
function hash2i(x, y, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function noise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2i(xi, yi, seed), b = hash2i(xi + 1, yi, seed);
  const c = hash2i(xi, yi + 1, seed), d = hash2i(xi + 1, yi + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

/* ============================================================
   World
   ============================================================ */
const CHUNK = 16;
const WATER_LEVEL = 8;
const FACE_DEFS = [
  { n: [1, 0, 0], verts: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], axisA: 1, axisB: 2, shade: 0.86 },
  { n: [-1, 0, 0], verts: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], axisA: 1, axisB: 2, shade: 0.73 },
  { n: [0, 1, 0], verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], axisA: 0, axisB: 2, shade: 1.0 },
  { n: [0, -1, 0], verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], axisA: 0, axisB: 2, shade: 0.55 },
  { n: [0, 0, 1], verts: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], axisA: 0, axisB: 1, shade: 0.92 },
  { n: [0, 0, -1], verts: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], axisA: 0, axisB: 1, shade: 0.78 }
];
const AO_LEVELS = [0.56, 0.72, 0.86, 1.0];
const UV_QUAD = [[0, 0], [1, 0], [1, 1], [0, 1]];

function faceTile(block, face) {
  switch (block) {
    case BLOCKS.GRASS:
      return face === 2 ? TILE.GRASS_TOP : face === 3 ? TILE.DIRT : TILE.GRASS_SIDE;
    case BLOCKS.DIRT: return TILE.DIRT;
    case BLOCKS.STONE: return TILE.STONE;
    case BLOCKS.COBBLE: return TILE.COBBLE;
    case BLOCKS.SAND: return TILE.SAND;
    case BLOCKS.LOG:
      return face === 2 || face === 3 ? TILE.LOG_TOP : TILE.LOG_SIDE;
    case BLOCKS.LEAVES: return TILE.LEAVES;
    case BLOCKS.PLANKS: return TILE.PLANKS;
    case BLOCKS.WATER: return TILE.WATER;
    case BLOCKS.SNOW: return TILE.SNOW;
    case BLOCKS.BEDROCK: return TILE.BEDROCK;
    default: return TILE.STONE;
  }
}

export class VoxelWorld {
  constructor({ size = 112, height = 48, seed = 'playground' } = {}) {
    this.size = size;
    this.height = height;
    this.seedString = String(seed);
    this.seed = hashString(this.seedString);
    this.blocks = new Uint8Array(size * size * height);
    this.group = new THREE.Group();
    this.group.name = 'voxel-world';
    this.chunkData = new Map();
    this.materials = {
      opaque: new THREE.MeshBasicMaterial({ map: atlasTexture(), vertexColors: true }),
      water: new THREE.MeshBasicMaterial({
        map: atlasTexture(), vertexColors: true, transparent: true,
        opacity: 0.78, depthWrite: false, side: THREE.FrontSide
      }),
      plants: new THREE.MeshBasicMaterial({
        map: atlasTexture(), vertexColors: true, alphaTest: 0.35,
        side: THREE.DoubleSide
      })
    };
    this.trees = [];
  }

  index(x, y, z) { return (y * this.size + z) * this.size + x; }

  getBlock(x, y, z) {
    if (y < 0) return BLOCKS.BEDROCK;
    if (y >= this.height) return BLOCKS.AIR;
    if (x < 0 || z < 0 || x >= this.size || z >= this.size) return BLOCKS.AIR;
    return this.blocks[(y * this.size + z) * this.size + x];
  }

  setBlock(x, y, z, b) {
    if (x < 0 || z < 0 || y < 0 || x >= this.size || z >= this.size || y >= this.height) return false;
    this.blocks[(y * this.size + z) * this.size + x] = b;
    return true;
  }

  surfaceY(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    if (xi < 0 || zi < 0 || xi >= this.size || zi >= this.size) return 0;
    for (let y = this.height - 1; y >= 0; y--) {
      const b = this.getBlock(xi, y, zi);
      if (IS_SOLID(b) && !IS_PLANT(b)) return y;
    }
    return 0;
  }

  generate() {
    const S = this.size, H = this.height;
    const mountainX = S * 0.30, mountainZ = S * 0.30;
    const lakeX = S * 0.70, lakeZ = S * 0.56;
    const heights = new Int16Array(S * S);

    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        const n1 = noise2(x * 0.028, z * 0.028, this.seed);
        const n2 = noise2(x * 0.075, z * 0.075, this.seed + 17);
        const n3 = noise2(x * 0.19, z * 0.19, this.seed + 39);
        let h = 7.0 + n1 * 8.5 + n2 * 3.6 + n3 * 1.3;

        const mdx = (x - mountainX) / (S * 0.21), mdz = (z - mountainZ) / (S * 0.24);
        h += 15 * Math.exp(-(mdx * mdx + mdz * mdz) * 1.35);
        const ldx = (x - lakeX) / (S * 0.19), ldz = (z - lakeZ) / (S * 0.17);
        h -= 7.4 * Math.exp(-(ldx * ldx + ldz * ldz) * 1.7);

        const edge = Math.min(x, z, S - 1 - x, S - 1 - z);
        if (edge < 18) h -= (18 - edge) * 0.95;
        h = Math.max(2, Math.min(H - 8, Math.round(h)));
        heights[z * S + x] = h;
      }
    }

    // base terrain
    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        const h = heights[z * S + x];
        for (let y = 0; y <= h; y++) {
          let b;
          if (y === 0) b = BLOCKS.BEDROCK;
          else if (y < h - 3) b = BLOCKS.STONE;
          else if (y < h) b = h <= WATER_LEVEL + 1 ? BLOCKS.SAND : BLOCKS.DIRT;
          else {
            if (h <= WATER_LEVEL + 1) b = BLOCKS.SAND;
            else if (h >= 23) b = BLOCKS.SNOW;
            else if (h >= 20) b = BLOCKS.STONE;
            else b = BLOCKS.GRASS;
          }
          this.setBlock(x, y, z, b);
        }
      }
    }

    // water
    for (let z = 0; z < S; z++) {
      for (let x = 0; x < S; x++) {
        const h = heights[z * S + x];
        for (let y = h + 1; y <= WATER_LEVEL; y++) this.setBlock(x, y, z, BLOCKS.WATER);
      }
    }

    // trees (scale with the map area so larger worlds stay forested)
    const treeTarget = Math.round((S * S) / 120);
    const rnd = mulberry32(this.seed ^ 0x9e3779b9);
    let attempts = 0;
    while (this.trees.length < treeTarget && attempts < treeTarget * 48) {
      attempts++;
      const x = 3 + Math.floor(rnd() * (S - 6));
      const z = 3 + Math.floor(rnd() * (S - 6));
      const h = this.surfaceY(x, z);
      if (h <= WATER_LEVEL + 1 || h > 22) continue;
      if (this.getBlock(x, h, z) !== BLOCKS.GRASS) continue;
      if (this.getBlock(x, h + 1, z) !== BLOCKS.AIR) continue;
      let tooClose = false;
      for (const t of this.trees) {
        const dx = t.x - x, dz = t.z - z;
        if (dx * dx + dz * dz < 24) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const trunk = 4 + Math.floor(rnd() * 3);
      for (let i = 1; i <= trunk; i++) this.setBlock(x, h + i, z, BLOCKS.LOG);
      const topY = h + trunk;
      for (let dy = -2; dy <= 1; dy++) {
        const r = dy <= -1 ? 2 : 1;
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (dx === 0 && dz === 0 && dy <= 0) continue;
            if (Math.abs(dx) === r && Math.abs(dz) === r && (dy === 1 || rnd() < .55)) continue;
            const tx = x + dx, ty = topY + dy, tz = z + dz;
            if (this.getBlock(tx, ty, tz) === BLOCKS.AIR) this.setBlock(tx, ty, tz, BLOCKS.LEAVES);
          }
        }
      }
      this.trees.push({ x, z, h, trunk });
    }

    // ground cover
    const rnd2 = mulberry32(this.seed ^ 0x51ed270b);
    for (let z = 1; z < S - 1; z++) {
      for (let x = 1; x < S - 1; x++) {
        const h = this.surfaceY(x, z);
        if (h <= WATER_LEVEL || h > 21) continue;
        if (this.getBlock(x, h, z) !== BLOCKS.GRASS) continue;
        if (this.getBlock(x, h + 1, z) !== BLOCKS.AIR) continue;
        const r = rnd2();
        if (r < 0.055) this.setBlock(x, h + 1, z, BLOCKS.TALLGRASS);
        else if (r < 0.062) this.setBlock(x, h + 1, z, rnd2() < .5 ? BLOCKS.POPPY : BLOCKS.DANDELION);
      }
    }

    this.genHeights = heights;
    this.spawn = this.findSpawn();
    return this;
  }

  findSpawn() {
    const S = this.size;
    const cx = Math.floor(S * 0.5), cz = Math.floor(S * 0.5);
    const maxR = Math.max(34, Math.floor(S * 0.32));
    let best = null;
    for (let r = 0; r <= maxR && !best; r += 2) {
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(ang) * r);
        const z = Math.round(cz + Math.sin(ang) * r);
        if (x < 3 || z < 3 || x >= S - 3 || z >= S - 3) continue;
        const h = this.surfaceY(x, z);
        if (h <= WATER_LEVEL + 1 || h > 23) continue;
        const top = this.getBlock(x, h, z);
        if (top !== BLOCKS.GRASS && top !== BLOCKS.SAND) continue;
        if (this.getBlock(x, h + 1, z) !== BLOCKS.AIR) continue;
        if (this.getBlock(x, h + 2, z) !== BLOCKS.AIR) continue;
        let clear = true;
        for (let dz = -1; dz <= 1 && clear; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (this.getBlock(x + dx, h + 2, z + dz) === BLOCKS.LEAVES) { clear = false; break; }
          }
        }
        if (!clear) continue;
        best = { x: x + 0.5, y: h + 1.02, z: z + 0.5 };
        break;
      }
    }
    if (!best) {
      const x = Math.floor(S / 2), z = Math.floor(S / 2);
      best = { x: x + 0.5, y: this.surfaceY(x, z) + 2, z: z + 0.5 };
    }
    return best;
  }

  /* ---------- meshing ---------- */
  buildChunk(cx, cz) {
    const key = cx + ',' + cz;
    const old = this.chunkData.get(key);
    if (old) {
      for (const m of old.meshes) {
        this.group.remove(m);
        m.geometry.dispose();
      }
      this.chunkData.delete(key);
    }

    const opaque = { pos: [], uv: [], col: [], idx: [] };
    const water = { pos: [], uv: [], col: [], idx: [] };
    const plant = { pos: [], uv: [], col: [], idx: [] };
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const isAO = b => b !== BLOCKS.AIR && b !== BLOCKS.WATER && !IS_PLANT(b);

    for (let z = z0; z < z0 + CHUNK; z++) {
      for (let x = x0; x < x0 + CHUNK; x++) {
        for (let y = 0; y < this.height; y++) {
          const b = this.getBlock(x, y, z);
          if (b === BLOCKS.AIR) continue;

          if (IS_PLANT(b)) {
            const tile = b === BLOCKS.TALLGRASS ? TILE.TALLGRASS : b === BLOCKS.POPPY ? TILE.POPPY : TILE.DANDELION;
            const { u0, u1, v0, v1 } = tileUV(tile);
            const h = b === BLOCKS.TALLGRASS ? 0.95 : 0.85;
            const r = hash2i(x, z, 7);
            const ox = 0.04 + r * 0.08;
            const scale = 0.82 + hash2i(x, z, 11) * 0.2;
            const ax = x + 0.5 - 0.5 * scale, az = z + 0.5 - 0.5 * scale;
            const bx = x + 0.5 + 0.5 * scale, bz = z + 0.5 + 0.5 * scale;
            const quads = [
              [[ax + ox, y, az + ox], [bx, y, bz], [bx, y + h, bz], [ax + ox, y + h, az + ox]],
              [[bx - ox, y, az + ox], [ax, y, bz], [ax, y + h, bz], [bx - ox, y + h, az + ox]]
            ];
            for (const q of quads) {
              const base = plant.pos.length / 3;
              for (let i = 0; i < 4; i++) {
                plant.pos.push(q[i][0], q[i][1], q[i][2]);
                plant.uv.push(i === 0 || i === 3 ? u0 : u1, i < 2 ? v0 : v1);
                plant.col.push(0.93, 0.93, 0.93);
              }
              plant.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
            continue;
          }

          if (b === BLOCKS.WATER) {
            for (let f = 0; f < 6; f++) {
              const def = FACE_DEFS[f];
              const nb = this.getBlock(x + def.n[0], y + def.n[1], z + def.n[2]);
              if (nb === BLOCKS.WATER || isAO(nb)) continue;
              const { u0, u1, v0, v1 } = tileUV(TILE.WATER);
              const base = water.pos.length / 3;
              for (let i = 0; i < 4; i++) {
                const vtx = def.verts[i];
                water.pos.push(x + vtx[0], y + vtx[1], z + vtx[2]);
                water.uv.push(i === 0 || i === 3 ? u0 : u1, i < 2 ? v0 : v1);
                const sh = def.shade * 0.98;
                water.col.push(sh, sh, sh);
              }
              water.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            }
            continue;
          }

          for (let f = 0; f < 6; f++) {
            const def = FACE_DEFS[f];
            const nx = x + def.n[0], ny = y + def.n[1], nz = z + def.n[2];
            const nb = this.getBlock(nx, ny, nz);
            if (isAO(nb)) continue;
            const { u0, u1, v0, v1 } = tileUV(faceTile(b, f));
            const base = opaque.pos.length / 3;
            for (let i = 0; i < 4; i++) {
              const vtx = def.verts[i];
              const signA = vtx[def.axisA] * 2 - 1;
              const signB = vtx[def.axisB] * 2 - 1;
              const oa = [0, 0, 0], ob = [0, 0, 0];
              oa[def.axisA] = signA; ob[def.axisB] = signB;
              const s1 = isAO(this.getBlock(nx + oa[0], ny + oa[1], nz + oa[2])) ? 1 : 0;
              const s2 = isAO(this.getBlock(nx + ob[0], ny + ob[1], nz + ob[2])) ? 1 : 0;
              const cn = isAO(this.getBlock(nx + oa[0] + ob[0], ny + oa[1] + ob[1], nz + oa[2] + ob[2])) ? 1 : 0;
              const ao = (s1 && s2) ? 0 : (3 - (s1 + s2 + cn));
              const sh = def.shade * AO_LEVELS[ao] * (b === BLOCKS.LEAVES ? 0.98 : 1);
              opaque.pos.push(x + vtx[0], y + vtx[1], z + vtx[2]);
              opaque.uv.push(i === 0 || i === 3 ? u0 : u1, i < 2 ? v0 : v1);
              opaque.col.push(sh, sh, sh);
            }
            opaque.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }
    }

    const meshes = [];
    const makeMesh = (data, material, order) => {
      if (!data.idx.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
      geo.setIndex(data.idx);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = true;
      mesh.renderOrder = order;
      this.group.add(mesh);
      meshes.push(mesh);
    };

    makeMesh(opaque, this.materials.opaque, 0);
    makeMesh(water, this.materials.water, 2);
    makeMesh(plant, this.materials.plants, 1);
    this.chunkData.set(key, { meshes });
    return meshes;
  }

  buildAll(onProgress) {
    const chunks = Math.ceil(this.size / CHUNK);
    let done = 0;
    for (let cz = 0; cz < chunks; cz++) {
      for (let cx = 0; cx < chunks; cx++) {
        this.buildChunk(cx, cz);
        done++;
        if (onProgress) onProgress(done / (chunks * chunks));
      }
    }
  }

  async buildAllAsync(onProgress) {
    const chunks = Math.ceil(this.size / CHUNK);
    let done = 0;
    const total = chunks * chunks;
    for (let cz = 0; cz < chunks; cz++) {
      for (let cx = 0; cx < chunks; cx++) {
        this.buildChunk(cx, cz);
        done++;
        if (onProgress) onProgress(done / total);
        if (done % 3 === 0) await new Promise(r => requestAnimationFrame(() => r()));
      }
    }
  }

  markChunkDirty(x, z) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const chunks = Math.ceil(this.size / CHUNK);
    const keys = new Set([cx + ',' + cz]);
    if (x % CHUNK === 0 && cx > 0) keys.add((cx - 1) + ',' + cz);
    if (x % CHUNK === CHUNK - 1 && cx < chunks - 1) keys.add((cx + 1) + ',' + cz);
    if (z % CHUNK === 0 && cz > 0) keys.add(cx + ',' + (cz - 1));
    if (z % CHUNK === CHUNK - 1 && cz < chunks - 1) keys.add(cx + ',' + (cz + 1));
    return keys;
  }

  rebuildAround(x, z) {
    for (const key of this.markChunkDirty(x, z)) {
      const [cx, cz] = key.split(',').map(Number);
      this.buildChunk(cx, cz);
    }
  }

  dispose() {
    for (const { meshes } of this.chunkData.values()) {
      for (const m of meshes) {
        this.group.remove(m);
        m.geometry.dispose();
      }
    }
    this.chunkData.clear();
    this.materials.opaque.dispose();
    this.materials.water.dispose();
    this.materials.plants.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

export { WATER_LEVEL, CHUNK };
