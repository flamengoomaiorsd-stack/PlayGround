'use strict';

/* ============================================================
   GTA VI: PIXEL VICE — fan-made pixel tribute
   ============================================================ */

/* ----------------------------- helpers ----------------------------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
const randInt = (a, b) => Math.floor(rand(b + 1, a));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const dist2 = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const TAU = Math.PI * 2;
function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function fmtMoney(n) { return '$' + Math.max(0, Math.round(n)).toLocaleString('pt-BR'); }
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
function nightFactor(tod) {
  const sun = Math.sin((tod - 0.25) * TAU);
  return clamp(-sun * 1.55 + 0.12, 0, 0.86);
}
function sunsetFactor(tod) {
  return clamp(1 - Math.abs(tod - 0.745) * 11, 0, 1);
}

/* ----------------------------- world constants ----------------------------- */
const T = 16;
const MW = 120, MH = 100;
const WORLD_W = MW * T, WORLD_H = MH * T;
const W = 640, H = 360;

const TILE = {
  WATER: 0, SAND: 1, GRASS: 2, ROAD: 3, SIDEWALK: 4, BUILDING: 5,
  PARK: 6, PARKING: 7, PLAZA: 8, PIER: 9, BOARDWALK: 10
};

const VROADS = [[8, 10], [28, 30], [48, 50], [68, 70], [88, 90]];
const HROADS = [[6, 8], [26, 28], [46, 48], [66, 68], [86, 88]];
const VCENTERS = VROADS.map(r => (r[0] + r[1]) / 2);
const HCENTERS = HROADS.map(r => (r[0] + r[1]) / 2);
const ROAD_CENTERS = [];
for (const vx of VCENTERS) for (const hy of HCENTERS) ROAD_CENTERS.push({ x: (vx + 0.5) * T, y: (hy + 0.5) * T });

const tiles = new Uint8Array(MW * MH);
const solid = new Uint8Array(MW * MH);
const roadOrient = new Uint8Array(MW * MH);
const buildings = [];
const props = [];
const lights = [];
const signs = [];
const specials = [];
const parkingLots = [];
const pois = [];
const glows = [];
const landmarks = {
  club: { x: 19.5 * T, y: 42.6 * T },
  brief: { x: 108 * T, y: 50.6 * T },
  garage: { x: 59 * T, y: 23 * T },
  marina: { x: 104 * T, y: 77 * T },
  helipad: { x: 79 * T, y: 57 * T },
  spawn: { x: 16 * T, y: 61 * T }
};

const BUILDING_PALETTES = [
  { wall: '#c76a7a', wall2: '#984b5c', roof: '#e39aa7', trim: '#f3c0c8', window: '#ffe6a3' },
  { wall: '#3c8f8b', wall2: '#286a68', roof: '#63b8b1', trim: '#a7e1da', window: '#c9fff4' },
  { wall: '#c9a06a', wall2: '#9c7749', roof: '#e7c28d', trim: '#f7dfb2', window: '#fff1c2' },
  { wall: '#7a6db5', wall2: '#574b8d', roof: '#a396d8', trim: '#cfc5f2', window: '#e8deff' },
  { wall: '#c95d9b', wall2: '#9a3f76', roof: '#ea8bc0', trim: '#ffc2e2', window: '#ffd9f0' },
  { wall: '#6e8291', wall2: '#4e606d', roof: '#97a9b6', trim: '#c7d6df', window: '#d9f3ff' },
  { wall: '#b56a4b', wall2: '#884a32', roof: '#db9676', trim: '#f4b99e', window: '#ffe0bd' },
  { wall: '#4f7f5b', wall2: '#355b3e', roof: '#79a985', trim: '#b2d7ba', window: '#ddffd9' }
];

/* ----------------------------- tile helpers ----------------------------- */
function inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < MW && ty < MH; }
function tileAt(tx, ty) { return inBounds(tx, ty) ? tiles[ty * MW + tx] : TILE.WATER; }
function setTile(tx, ty, t, isSolid) {
  if (!inBounds(tx, ty)) return;
  tiles[ty * MW + tx] = t;
  solid[ty * MW + tx] = isSolid === undefined ? (t === TILE.WATER || t === TILE.BUILDING ? 1 : 0) : (isSolid ? 1 : 0);
}
function fillTiles(x1, y1, x2, y2, t, isSolid) {
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) setTile(x, y, t, isSolid);
}
function isSolidTile(tx, ty) { return !inBounds(tx, ty) || solid[ty * MW + tx] === 1; }
function isSolidAt(x, y) { return isSolidTile(Math.floor(x / T), Math.floor(y / T)); }
function canStand(x, y, r = 6) {
  if (x < r || y < r || x > WORLD_W - r || y > WORLD_H - r) return false;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    if (isSolidAt(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false;
  }
  return !isSolidAt(x, y);
}
function inRoad(tx, ty) { return tileAt(tx, ty) === TILE.ROAD; }

/* ----------------------------- world generation ----------------------------- */
function addBuilding(x, y, w, h, palIndex, opts = {}) {
  if (w < 2 || h < 2) return;
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) setTile(tx, ty, TILE.BUILDING, true);
  const b = {
    x, y, w, h,
    pal: BUILDING_PALETTES[palIndex % BUILDING_PALETTES.length],
    seed: hash2(x * 3 + 1, y * 5 + 2),
    name: opts.name || null,
    neon: opts.neon || null,
    club: !!opts.club,
    garage: !!opts.garage,
    pool: !!opts.pool
  };
  buildings.push(b);
  if (opts.name && opts.neon) signs.push({ x: x + w / 2, y: y + h - 0.2, text: opts.name, color: opts.neon, building: b });
  return b;
}

function addPalm(tx, ty, scale = 1) { props.push({ type: 'palm', x: tx * T + 8 + rand(4, -4), y: ty * T + 12, scale, seed: Math.random() * 100 }); }
function addLamp(tx, ty) {
  const x = tx * T + 8, y = ty * T + 12;
  props.push({ type: 'lamp', x, y, seed: Math.random() * 100 });
  lights.push({ x, y: y - 10, r: 54, color: '255,190,110', intensity: 0.55 });
}
function addBench(tx, ty) { props.push({ type: 'bench', x: tx * T + 8, y: ty * T + 12, seed: Math.random() }); }
function addHydrant(tx, ty) { props.push({ type: 'hydrant', x: tx * T + 8, y: ty * T + 10 }); }
function addUmbrella(tx, ty, color) { props.push({ type: 'umbrella', x: tx * T + 8, y: ty * T + 12, color }); }
function addBoat(x, y, color) { props.push({ type: 'boat', x, y, color, seed: Math.random() * 10 }); }
function addCrate(x, y) { props.push({ type: 'crate', x, y }); }
function addBush(tx, ty, color) { props.push({ type: 'bush', x: tx * T + 8 + rand(3, -3), y: ty * T + 11, color: color || '#2f7d4f', seed: Math.random() * 100 }); }
function addFlowers(tx, ty, color) { props.push({ type: 'flowers', x: tx * T + 8 + rand(4, -4), y: ty * T + 11, color: color || pick(['#ff2d95', '#ffd166', '#ff8a2b', '#b98cff', '#f3f0e6']) }); }
function addTrash(tx, ty) { props.push({ type: 'trash', x: tx * T + 8, y: ty * T + 11 }); }
function addStreetSign(tx, ty, color) { props.push({ type: 'streetSign', x: tx * T + 8, y: ty * T + 11, color: color || '#24e0ff' }); }
function addMailbox(tx, ty) { props.push({ type: 'mailbox', x: tx * T + 8, y: ty * T + 11 }); }
function addPlanter(tx, ty) { props.push({ type: 'planter', x: tx * T + 8, y: ty * T + 11, seed: Math.random() * 100 }); }
function addScooter(tx, ty) { props.push({ type: 'scooter', x: tx * T + 8, y: ty * T + 11, color: pick(['#ff2d95', '#24e0ff', '#ffd166', '#4ade80']) }); }
function addCone(tx, ty) { props.push({ type: 'cone', x: tx * T + 8 + rand(4, -4), y: ty * T + 11 }); }
function addBarrier(tx, ty) { props.push({ type: 'barrier', x: tx * T + 8, y: ty * T + 11 }); }
function addStall(tx, ty, color) { props.push({ type: 'stall', x: tx * T + 8, y: ty * T + 12, color: color || pick(['#ff2d95', '#24e0ff', '#ffd166', '#4ade80']), seed: Math.random() * 10 }); }
function addGazebo(tx, ty) { props.push({ type: 'gazebo', x: tx * T + 8, y: ty * T + 13 }); }
function addTiki(tx, ty) { props.push({ type: 'tiki', x: tx * T + 8, y: ty * T + 12, seed: Math.random() * 10 }); }
function addLifeguard(tx, ty) { props.push({ type: 'lifeguard', x: tx * T + 8, y: ty * T + 12 }); }
function addTowels(tx, ty, color) { props.push({ type: 'towel', x: tx * T + 8 + rand(3, -3), y: ty * T + 12, color: color || pick(['#ff2d95', '#24e0ff', '#ffd166', '#f3f0e6']) }); }
function addScooterRow(tx, ty, n) { for (let i = 0; i < n; i++) addScooter(tx + i * .6, ty); }
function addPOI(name, tx, ty, color = '#ffd166') {
  const poi = { name, x: tx * T, y: ty * T, color };
  pois.push(poi);
  return poi;
}
function addGlow(x, y, r, color, a = .35) { glows.push({ x, y, r, color, a }); }
function addProp(type, x, y, opts = {}) { props.push(Object.assign({ type, x, y }, opts)); }
function addGateSign(tx, ty, text, color) { props.push({ type: 'gateSign', x: tx * T + 8, y: ty * T + 13, text, color: color || '#ffd166' }); }
function furnishStreet(tx, ty) {
  if (!inBounds(tx, ty) || tileAt(tx, ty) !== TILE.SIDEWALK) return;
  const h = hash2(tx * 3 + 1, ty * 5 + 2);
  if (h > .88) addBench(tx, ty);
  else if (h > .76) addTrash(tx, ty);
  else if (h > .64) addStreetSign(tx, ty, h > .78 ? '#ffd166' : '#24e0ff');
  else if (h > .53) addHydrant(tx, ty);
  else if (h > .43) addPlanter(tx, ty);
  else if (h > .34) addBush(tx, ty);
  else if (h > .27) addFlowers(tx, ty, '#f3f0e6');
}

function buildBlock(x1, y1, x2, y2, bx, by) {
  const ix1 = x1 + 1, ix2 = x2 - 1, iy1 = y1 + 1, iy2 = y2 - 1;
  const roll = hash2(bx * 13 + 7, by * 17 + 3);
  let kind = 'buildings';
  if (bx >= 4) kind = roll < 0.42 ? 'park' : roll < 0.72 ? 'parking' : 'plaza';
  else if (roll < 0.16) kind = 'park';
  else if (roll < 0.3) kind = 'parking';
  else if (roll < 0.4) kind = 'plaza';

  if (kind === 'park') {
    fillTiles(ix1, iy1, ix2, iy2, TILE.PARK);
    const mx = Math.floor((ix1 + ix2) / 2), my = Math.floor((iy1 + iy2) / 2);
    fillTiles(mx, iy1, mx, iy2, TILE.PLAZA);
    fillTiles(ix1, my, ix2, my, TILE.PLAZA);
    specials.push({ type: 'fountain', x: (mx + 0.5) * T, y: (my + 0.5) * T, r: 13 });
    specials.push({ type: 'medallion', x: (mx + 0.5) * T, y: (my + 0.5) * T, r: 26 });
    addPalm(ix1 + 1, iy1 + 1, 1.05); addPalm(ix2 - 1, iy1 + 1, .95);
    addPalm(ix1 + 1, iy2 - 1, 1.1); addPalm(ix2 - 1, iy2 - 1, .9);
    addBench(mx - 2, my + 1); addBench(mx + 2, my - 1);
    addBush(ix1 + 2, iy2 - 1, '#357a4a'); addBush(ix2 - 2, iy1 + 1, '#3d8653');
    addFlowers(mx - 3, my - 2, '#ff2d95'); addFlowers(mx + 3, my + 2, '#ffd166');
    addTrash(mx - 3, my + 2); addStreetSign(mx + 3, my - 2, '#24e0ff');
    return;
  }
  if (kind === 'parking') {
    fillTiles(ix1, iy1, ix2, iy2, TILE.PARKING);
    parkingLots.push({ x1: ix1, y1: iy1, x2: ix2, y2: iy2, dir: (bx + by) % 2 });
    specials.push({ type: 'parking', x1: ix1, y1: iy1, x2: ix2, y2: iy2 });
    if (roll > 0.55) addPalm(ix1, iy2, .9);
    addCone(ix2 - 1, iy2 - 1); addCone(ix1 + 1, iy1 + 1);
    if (roll > 0.4) addTrash(ix2, iy2);
    if (roll > 0.6) addScooterRow(ix1 + 2, iy2 - 1, 3);
    return;
  }
  if (kind === 'plaza') {
    fillTiles(ix1, iy1, ix2, iy2, TILE.PLAZA);
    addPalm(ix1 + 1, iy1 + 1, 1); addPalm(ix2 - 1, iy2 - 1, 1.05);
    addBench(ix1 + 2, iy2 - 1);
    addPlanter(ix1 + 1, iy2 - 1); addPlanter(ix2 - 1, iy1 + 1);
    addTrash(ix2 - 2, iy2 - 1); addFlowers(ix1 + 3, iy1 + 1, '#ff8a2b');
    specials.push({ type: 'medallion', x: ((ix1 + ix2) / 2 + .5) * T, y: ((iy1 + iy2) / 2 + .5) * T, r: 22 });
    return;
  }

  fillTiles(ix1, iy1, ix2, iy2, TILE.SIDEWALK);
  const count = roll > 0.52 ? 3 : 2;
  const total = iy2 - iy1 + 1;
  const strip = Math.floor((total - (count - 1)) / count);
  let yy = iy1;
  const names = ['HOTEL', 'BAR', 'CLUB', 'TATTOO', 'VINIL', 'SURF', 'LIQUOR', 'CAFÉ', 'PAWN', 'MOTEL', 'SUSHI', 'BODEGA', 'TACOS', 'ARCADE'];
  for (let i = 0; i < count; i++) {
    const h = i === count - 1 ? (iy2 - yy + 1) : strip;
    if (h >= 3) {
      const pad = hash2(bx * 31 + i, by * 37 + 5) > 0.78 ? 1 : 0;
      const bw = (ix2 - ix1 - 1) - pad;
      const b = addBuilding(ix1 + 1, yy, bw, Math.max(2, h - 1), Math.floor(hash2(bx + i * 7, by + i * 11) * 8));
      if (hash2(bx * 5 + i, by * 9 + 2) > 0.55) {
        b.name = names[Math.floor(hash2(bx + i, by + i * 3) * names.length)];
        b.neon = pick(['#ff2d95', '#24e0ff', '#ffd166', '#ff8a2b', '#b98cff']);
        signs.push({ x: b.x + b.w / 2, y: b.y + b.h - 0.15, text: b.name, color: b.neon, building: b });
      }
    }
    yy += h + 1;
    if (yy > iy2) break;
  }
  if (roll > 0.45) addLamp(x1, y1);
  if (roll > 0.68) addLamp(x2, y2);
  if (roll > 0.6) addHydrant(ix1, iy2);
  if (roll > 0.72) addPalm(ix2, iy1, .95);
  if (roll > 0.32) addTrash(ix2, iy2);
  if (roll > 0.44) addStreetSign(ix1, iy1, roll > .7 ? '#ffd166' : '#24e0ff');
  if (roll > 0.5) addPlanter(ix2, iy2 - 1);
  if (roll > 0.58) addBush(ix1 + 1, iy2, '#2f7d4f');
  if (roll > 0.66) addMailbox(ix1, iy1 + 1);
  if (roll > 0.74) addScooterRow(ix2 - 2, iy2 - 1, 2);
  if (roll > 0.82) addFlowers(ix1 + 2, iy2 - 1, '#b98cff');
}

function buildClub(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PLAZA);
  addBuilding(14, 31, 12, 9, 4, { name: 'NEON PALACE', neon: '#ff2d95', club: true });
  specials.push({ type: 'carpet', x: 19.5 * T, y: 41 * T, w: 26, h: 42 });
  specials.push({ type: 'clubSign', x: 19.5 * T, y: 40.2 * T, w: 150 });
  addPalm(12, 30, 1.1); addPalm(26, 30, 1.1); addPalm(12, 44, 1); addPalm(26, 44, 1);
  addLamp(13, 44); addLamp(25, 44);
  props.push({ type: 'neonPillar', x: 15 * T, y: 42 * T, color: '#ff2d95' });
  props.push({ type: 'neonPillar', x: 24 * T, y: 42 * T, color: '#24e0ff' });
  addPOI('NEON PALACE', 19.5, 40.5, '#ff2d95');
}

function buildMotel(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PARKING);
  addBuilding(13, 50, 12, 5, 0, { name: 'MOTEL VICE', neon: '#24e0ff' });
  fillTiles(24, 59, 25, 60, TILE.WATER, true);
  specials.push({ type: 'pool', x1: 23, y1: 58, x2: 26, y2: 61 });
  parkingLots.push({ x1: x1 + 1, y1: y1 + 1, x2: x2 - 1, y2: y2 - 1, dir: 0 });
  specials.push({ type: 'parking', x1: x1 + 1, y1: y1 + 1, x2: x2 - 1, y2: y2 - 1 });
  addPalm(12, 63, 1.1); addPalm(26, 63, 1.1);
  addLamp(12, 56); addLamp(26, 56);
  addPOI('MOTEL VICE', 19, 57, '#24e0ff');
}

function buildGarage(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PARKING);
  addBuilding(54, 11, 11, 6, 5, { name: 'GARAGE', neon: '#ffd166', garage: true });
  parkingLots.push({ x1: x1 + 1, y1: y1 + 1, x2: x2 - 1, y2: y2 - 1, dir: 0 });
  specials.push({ type: 'parking', x1: x1 + 1, y1: y1 + 1, x2: x2 - 1, y2: y2 - 1 });
  addCrate(54 * T, 21 * T); addCrate(56 * T, 21 * T); addCrate(66 * T, 22 * T);
  addLamp(52, 24); addLamp(66, 12);
  addPalm(51, 10, .95);
  addPOI('GARAGEM', 59.5, 19, '#ffd166');
}

function buildHelipad(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PLAZA);
  specials.push({ type: 'helipad', x: 79 * T, y: 57 * T, r: 46 });
  addPalm(72, 50, 1.05); addPalm(86, 50, 1.05); addPalm(72, 64, 1); addPalm(86, 64, 1);
  addLamp(73, 56); addLamp(85, 56);
  addPOI('HELIPONTO', 79, 57, '#ffd166');
}

function buildMarina(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PLAZA);
  addBuilding(92, 70, 6, 4, 1, { name: 'MARINA', neon: '#24e0ff' });
  fillTiles(100, 76, 118, 79, TILE.PIER, false);
  specials.push({ type: 'pier', x1: 100, y1: 76, x2: 118, y2: 79 });
  addBoat(113 * T, 73.2 * T, '#f3f0e6');
  addCrate(101 * T, 78 * T); addCrate(102 * T, 78 * T);
  addLamp(101, 75); addLamp(108, 75);
  addPalm(91, 84, 1); addPalm(99, 84, 1);
  addPOI('MARINA', 104, 77, '#24e0ff');
}

function buildBeachPier() {
  fillTiles(100, 49, 117, 52, TILE.PIER, false);
  specials.push({ type: 'pier', x1: 100, y1: 49, x2: 117, y2: 52 });
  addBoat(114 * T, 46 * T, '#ff5fb5');
  addCrate(104 * T, 51 * T); addCrate(112 * T, 51 * T);
  addLamp(101, 48); addLamp(109, 48);
  addUmbrella(106, 56, '#ff2d95'); addUmbrella(109, 59, '#24e0ff'); addUmbrella(105, 62, '#ffd166');
  addPOI('PÍER DE VICE', 108, 50, '#ff2d95');
}

/* ---------------- new districts & landmarks ---------------- */

function buildHotel(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PLAZA);
  addBuilding(13, 11, 13, 7, 2, { name: 'VICE BEACH HOTEL', neon: '#ff8a2b' });
  fillTiles(15, 20, 19, 22, TILE.WATER, true);
  specials.push({ type: 'pool', x1: 15, y1: 20, x2: 20, y2: 23 });
  addUmbrella(14, 24, '#ff2d95'); addUmbrella(21, 24, '#24e0ff'); addUmbrella(17, 24, '#ffd166');
  addPalm(12, 19, 1.05); addPalm(25, 19, 1.05); addPalm(12, 25, .95); addPalm(25, 25, .95);
  addLamp(13, 25); addLamp(24, 25);
  addBench(22, 20); addTrash(22, 21);
  specials.push({ type: 'medallion', x: 19.5 * T, y: 16 * T, r: 20 });
  addPOI('HOTEL VICE BEACH', 19.5, 15, '#ff8a2b');
}

function buildHospital(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.SIDEWALK);
  addBuilding(93, 12, 6, 9, 5, { name: 'HOSPITAL', neon: '#ff3b3b' });
  specials.push({ type: 'cross', x: 96 * T, y: 24 * T, r: 14, color: 'rgba(255,59,91,.75)' });
  parkingLots.push({ x1: 92, y1: 22, x2: 98, y2: 25, dir: 1 });
  specials.push({ type: 'parking', x1: 92, y1: 22, x2: 98, y2: 25 });
  addLamp(92, 21); addLamp(98, 21);
  addTrash(98, 22); addBench(92, 23);
  addPOI('HOSPITAL CENTRAL', 96, 18, '#ff3b3b');
}

function buildPolice(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PARKING);
  addBuilding(74, 11, 11, 6, 5, { name: 'POLICE HQ', neon: '#24a9ff' });
  parkingLots.push({ x1: 72, y1: 18, x2: 86, y2: 24, dir: 0, police: true });
  specials.push({ type: 'parking', x1: 72, y1: 18, x2: 86, y2: 24 });
  addBarrier(73, 19); addBarrier(76, 19); addCone(84, 23);
  addLamp(72, 17); addLamp(86, 17);
  addGlow(79.5 * T, 15 * T, 70, '36,169,255', .3);
  addPOI('DELEGACIA DE VICE', 79, 17, '#24a9ff');
}

function buildStadium(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PLAZA);
  specials.push({ type: 'track', x: 39.5 * T, y: 17.5 * T, rx: 112, ry: 104 });
  addStall(33, 24, '#ff2d95'); addStall(46, 24, '#24e0ff');
  addProp('floodlight', 32 * T, 10 * T); addProp('floodlight', 47 * T, 10 * T);
  addProp('floodlight', 32 * T, 25 * T); addProp('floodlight', 47 * T, 25 * T);
  addBarrier(33, 25); addBarrier(46, 25);
  addPalm(32, 11, 1); addPalm(47, 11, 1);
  addPOI('VICE STADIUM', 39.5, 17, '#4ade80');
}

function buildMall(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PLAZA);
  addBuilding(33, 31, 13, 8, 3, { name: 'GALLERIA', neon: '#ff2d95' });
  specials.push({ type: 'medallion', x: 39.5 * T, y: 41.5 * T, r: 28 });
  specials.push({ type: 'fountain', x: 39.5 * T, y: 41.5 * T, r: 11 });
  addPalm(32, 40, 1.05); addPalm(47, 40, 1.05);
  addBench(35, 43); addBench(44, 43);
  addPlanter(33, 43); addPlanter(46, 43);
  addTrash(37, 43); addTrash(42, 43);
  addStreetSign(32, 42, '#ff2d95');
  addPOI('GALLERIA MALL', 39.5, 39, '#ff2d95');
}

function buildSkatepark(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PARKING);
  specials.push({ type: 'skate', x1: 52, y1: 30, x2: 66, y2: 44 });
  addProp('skateRamp', 55 * T, 34 * T, { flip: 0 });
  addProp('skateRamp', 62 * T, 34 * T, { flip: 1 });
  addProp('skateRamp', 55 * T, 40 * T, { flip: 0 });
  addProp('skateRamp', 62 * T, 40 * T, { flip: 1 });
  addProp('rail', 58 * T, 37 * T, { w: 46 });
  addProp('rail', 58 * T, 43 * T, { w: 40 });
  addTrash(66, 43); addCone(52, 43); addScooterRow(64, 30, 2);
  addLamp(52, 31); addLamp(66, 31);
  addPOI('SKATEPARK VICE', 59, 37, '#b98cff');
}

function buildConstruction(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.GRASS);
  specials.push({ type: 'dirt', x1: 72, y1: 30, x2: 86, y2: 44 });
  specials.push({ type: 'pit', x1: 75, y1: 33, x2: 83, y2: 39 });
  addProp('crane', 84 * T, 41 * T);
  addBarrier(72, 31); addBarrier(76, 31); addBarrier(80, 31);
  addCone(73, 43); addCone(77, 42); addCone(81, 43); addCone(85, 42);
  addCrate(74 * T, 42 * T); addCrate(75.5 * T, 43 * T); addCrate(80 * T, 43 * T);
  addBush(86, 31, '#4a6b32'); addTrash(86, 43);
  addPOI('OBRA DE VICE', 79, 37, '#ffd166');
}

function buildBeachClub(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PLAZA);
  addBuilding(92, 31, 6, 4, 1, { name: 'BEACH CLUB', neon: '#24e0ff' });
  fillTiles(92, 37, 96, 40, TILE.WATER, true);
  specials.push({ type: 'pool', x1: 92, y1: 37, x2: 97, y2: 41 });
  addUmbrella(92, 43, '#24e0ff'); addUmbrella(95, 43, '#ffd166'); addUmbrella(98, 43, '#ff2d95');
  addTiki(97, 36); addBench(92, 44);
  addLamp(92, 36); addLamp(98, 36);
  addPOI('BEACH CLUB', 95, 36, '#24e0ff');
}

function buildGarden(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PARK);
  fillTiles(38, 56, 41, 59, TILE.WATER, true);
  specials.push({ type: 'pond', x1: 38, y1: 56, x2: 42, y2: 60 });
  fillTiles(35, 53, 44, 53, TILE.PLAZA);
  fillTiles(39, 53, 40, 60, TILE.PLAZA);
  addGazebo(36 * T, 52 * T);
  addPalm(32, 51, 1.05); addPalm(46, 51, 1); addPalm(32, 63, 1); addPalm(46, 63, 1.1);
  for (let i = 0; i < 10; i++) addFlowers(33 + (i % 5) * 3, 55 + (i / 5 | 0) * 6, pick(['#ff2d95', '#ffd166', '#ff8a2b', '#b98cff', '#f3f0e6']));
  addBush(33, 54); addBush(45, 54); addBush(33, 62); addBush(45, 62);
  addBench(35, 55); addBench(44, 58); addBench(35, 61);
  addLamp(32, 55); addLamp(46, 55);
  addPOI('JARDIM BOTÂNICO', 39, 56, '#4ade80');
}

function buildDriveIn(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PARKING);
  specials.push({ type: 'parking', x1: 52, y1: 50, x2: 66, y2: 64 });
  parkingLots.push({ x1: 52, y1: 56, x2: 66, y2: 64, dir: 0 });
  addProp('driveScreen', 59 * T, 51 * T);
  addStall(53, 64, '#ff2d95'); addStall(65, 64, '#ffd166');
  addCone(54, 57); addCone(64, 57); addTrash(66, 50);
  addLamp(52, 55); addLamp(66, 55);
  addGlow(59 * T, 51 * T, 80, '255,209,102', .22);
  addPOI('DRIVE-IN VICE', 59, 57, '#ffd166');
}

function buildLighthouse(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PARK);
  specials.push({ type: 'rock', x: 95 * T, y: 55 * T, r: 34 });
  addProp('lighthouse', 95 * T, 55 * T);
  addBush(92, 52); addBush(98, 52); addBush(92, 58); addBush(98, 58);
  addPalm(92, 62, 1); addPalm(98, 62, 1);
  addBench(92, 60); addBench(98, 60);
  addLamp(92, 50); addLamp(98, 50);
  addGlow(95 * T, 45 * T, 90, '255,240,190', .3);
  addPOI('FAROL DE VICE', 95, 55, '#f3f0e6');
}

function buildMarket(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PLAZA);
  specials.push({ type: 'medallion', x: 19 * T, y: 77 * T, r: 24 });
  const cols = ['#ff2d95', '#24e0ff', '#ffd166', '#4ade80', '#ff8a2b'];
  for (let i = 0; i < 5; i++) addStall(14 + i * 2.4, 72, cols[i]);
  for (let i = 0; i < 5; i++) addStall(14 + i * 2.4, 82, cols[(i + 2) % 5]);
  addCrate(12 * T, 76 * T); addCrate(13 * T, 79 * T); addCrate(25 * T, 76 * T);
  addTrash(12, 73); addTrash(26, 81);
  addPalm(12, 71, 1); addPalm(26, 71, 1); addPalm(12, 84, 1); addPalm(26, 84, 1);
  addLamp(13, 77); addLamp(25, 77);
  addPOI('FEIRA DE VICE', 19, 77, '#ff8a2b');
}

function buildGasStation(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PARKING);
  addBuilding(42, 72, 5, 4, 5, { name: 'POSTO 24H', neon: '#4ade80' });
  specials.push({ type: 'parking', x1: 32, y1: 70, x2: 46, y2: 84 });
  parkingLots.push({ x1: 33, y1: 78, x2: 45, y2: 84, dir: 0 });
  addProp('canopy', 38 * T, 77 * T, { w: 90, h: 38 });
  addProp('pump', 36 * T, 77 * T); addProp('pump', 40 * T, 77 * T);
  addTrash(32, 71); addCone(46, 84);
  addLamp(32, 76); addLamp(46, 76);
  addGlow(38 * T, 77 * T, 80, '74,222,128', .22);
  addPOI('POSTO 24H', 38, 77, '#4ade80');
}

function buildRadioTower(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.GRASS);
  specials.push({ type: 'medallion', x: 59 * T, y: 77 * T, r: 30 });
  addProp('radioTower', 59 * T, 77 * T);
  addBarrier(54, 82); addBarrier(58, 82); addBarrier(62, 82);
  addCrate(52 * T, 82 * T); addCrate(53.5 * T, 83 * T);
  addBush(53, 71); addBush(65, 71); addBush(53, 83); addBush(65, 83);
  addTrash(65, 82);
  addGlow(59 * T, 58 * T, 100, '255,59,91', .3);
  addPOI('RÁDIO VICE', 59, 77, '#ff3b3b');
}

function buildArcade(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PLAZA);
  addBuilding(72, 71, 7, 4, 4, { name: 'ARCADE', neon: '#ff2d95' });
  addProp('ferris', 82 * T, 79 * T);
  addStall(73, 83, '#24e0ff'); addStall(76, 83, '#ffd166');
  addPalm(72, 83, 1); addPalm(86, 83, 1);
  addTrash(86, 76); addBench(72, 79);
  addProp('neonPillar', 74 * T, 82 * T, { color: '#ff2d95' });
  addProp('neonPillar', 78 * T, 82 * T, { color: '#24e0ff' });
  addGlow(82 * T, 79 * T, 90, '255,45,149', .25);
  addPOI('PIER ARCADE', 79, 78, '#ff2d95');
}

function buildSunsetPark(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PARK);
  fillTiles(19, 93, 22, 96, TILE.WATER, true);
  specials.push({ type: 'pond', x1: 19, y1: 93, x2: 23, y2: 97 });
  addGazebo(15 * T, 92 * T);
  addPalm(13, 91, 1); addPalm(25, 91, 1); addPalm(13, 97, 1); addPalm(25, 97, 1);
  addBench(16, 95); addBench(23, 91);
  addBush(14, 96); addBush(24, 96);
  addFlowers(15, 94, '#ff8a2b'); addFlowers(23, 94, '#ff2d95');
  addLamp(13, 94); addLamp(25, 94);
  addPOI('PARQUE SUNSET', 19, 94, '#ff8a2b');
}

function buildSpeedway(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PARKING);
  specials.push({ type: 'track', x: 39 * T, y: 94 * T, rx: 108, ry: 56, small: true });
  addBarrier(32, 90); addBarrier(36, 90); addBarrier(40, 90); addBarrier(44, 90);
  addCone(33, 98); addCone(45, 98);
  parkingLots.push({ x1: 34, y1: 96, x2: 44, y2: 98, dir: 0 });
  addPalm(32, 98, 1); addPalm(46, 98, 1);
  addLamp(32, 93); addLamp(46, 93);
  addPOI('AUTÓDROMO VICE', 39, 94, '#ffd166');
}

function buildCourts(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PLAZA);
  specials.push({ type: 'court', x: 56 * T, y: 93 * T, w: 70, h: 46, color: '#c2543c' });
  specials.push({ type: 'court', x: 64 * T, y: 93 * T, w: 70, h: 46, color: '#3c7ac2' });
  addProp('net', 56 * T, 93 * T, { w: 56, h: 30 });
  addProp('net', 64 * T, 93 * T, { w: 56, h: 30 });
  addBench(52, 97); addBench(58, 97); addBench(62, 97);
  addTrash(52, 90); addTrash(66, 90);
  addLamp(52, 96); addLamp(66, 96);
  addPOI('QUADRAS DE VICE', 59, 93, '#24e0ff');
}

function buildTikiBar(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.PLAZA);
  addTiki(75 * T, 92 * T); addTiki(79 * T, 92 * T); addTiki(83 * T, 92 * T);
  addStall(72, 96, '#ff8a2b'); addStall(86, 96, '#ffd166');
  addUmbrella(74, 95, '#ff2d95'); addUmbrella(78, 96, '#24e0ff'); addUmbrella(82, 95, '#ffd166');
  addPalm(72, 97, 1); addPalm(86, 97, 1);
  addTrash(72, 91); addLamp(75, 96); addLamp(83, 96);
  addPOI('TIKI BAR', 79, 94, '#ff8a2b');
}

function buildOceanDrive(x1, y1, x2, y2) {
  fillTiles(x1 + 1, y1 + 1, x2 - 1, y2 - 1, TILE.BOARDWALK);
  addStall(93, 92, '#24e0ff'); addStall(97, 92, '#ff2d95');
  addPalm(92, 90, 1); addPalm(98, 90, 1); addPalm(92, 97, 1); addPalm(98, 97, 1);
  addBench(94, 95); addBench(97, 95);
  addLamp(92, 94); addLamp(98, 94);
  addTrash(92, 96);
  addPOI('OCEAN DRIVE', 95, 94, '#24e0ff');
}

function generateWorld() {
  buildings.length = 0; props.length = 0; lights.length = 0; signs.length = 0;
  specials.length = 0; parkingLots.length = 0; pois.length = 0; glows.length = 0;
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      if (x >= 112) setTile(x, y, TILE.WATER, true);
      else if (x >= 104) setTile(x, y, TILE.SAND, false);
      else if (x >= 100) setTile(x, y, TILE.BOARDWALK, false);
      else setTile(x, y, TILE.GRASS, false);
    }
  }
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const v = VROADS.some(r => x >= r[0] && x <= r[1]);
      const h = HROADS.some(r => y >= r[0] && y <= r[1]);
      if (v && h) { setTile(x, y, TILE.ROAD, false); roadOrient[y * MW + x] = 3; }
      else if (v) { setTile(x, y, TILE.ROAD, false); roadOrient[y * MW + x] = 2; }
      else if (h) { setTile(x, y, TILE.ROAD, false); roadOrient[y * MW + x] = 1; }
    }
  }
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < 100; x++) {
      if (tileAt(x, y) !== TILE.GRASS) continue;
      if (inRoad(x - 1, y) || inRoad(x + 1, y) || inRoad(x, y - 1) || inRoad(x, y + 1)) setTile(x, y, TILE.SIDEWALK, false);
    }
  }
  for (let by = 0; by < 5; by++) {
    for (let bx = 0; bx < 5; bx++) {
      const x1 = 11 + bx * 20;
      const x2 = bx === 4 ? 99 : x1 + 16;
      const y1 = 9 + by * 20;
      const y2 = by === 4 ? 99 : y1 + 16;
      if (bx === 0 && by === 0) buildHotel(x1, y1, x2, y2);
      else if (bx === 1 && by === 0) buildStadium(x1, y1, x2, y2);
      else if (bx === 2 && by === 0) buildGarage(x1, y1, x2, y2);
      else if (bx === 3 && by === 0) buildPolice(x1, y1, x2, y2);
      else if (bx === 4 && by === 0) buildHospital(x1, y1, x2, y2);
      else if (bx === 0 && by === 1) buildClub(x1, y1, x2, y2);
      else if (bx === 1 && by === 1) buildMall(x1, y1, x2, y2);
      else if (bx === 2 && by === 1) buildSkatepark(x1, y1, x2, y2);
      else if (bx === 3 && by === 1) buildConstruction(x1, y1, x2, y2);
      else if (bx === 4 && by === 1) buildBeachClub(x1, y1, x2, y2);
      else if (bx === 0 && by === 2) buildMotel(x1, y1, x2, y2);
      else if (bx === 1 && by === 2) buildGarden(x1, y1, x2, y2);
      else if (bx === 2 && by === 2) buildDriveIn(x1, y1, x2, y2);
      else if (bx === 3 && by === 2) buildHelipad(x1, y1, x2, y2);
      else if (bx === 4 && by === 2) buildLighthouse(x1, y1, x2, y2);
      else if (bx === 0 && by === 3) buildMarket(x1, y1, x2, y2);
      else if (bx === 1 && by === 3) buildGasStation(x1, y1, x2, y2);
      else if (bx === 2 && by === 3) buildRadioTower(x1, y1, x2, y2);
      else if (bx === 3 && by === 3) buildArcade(x1, y1, x2, y2);
      else if (bx === 4 && by === 3) buildMarina(x1, y1, x2, y2);
      else if (bx === 0 && by === 4) buildSunsetPark(x1, y1, x2, y2);
      else if (bx === 1 && by === 4) buildSpeedway(x1, y1, x2, y2);
      else if (bx === 2 && by === 4) buildCourts(x1, y1, x2, y2);
      else if (bx === 3 && by === 4) buildTikiBar(x1, y1, x2, y2);
      else if (bx === 4 && by === 4) buildOceanDrive(x1, y1, x2, y2);
      else buildBlock(x1, y1, x2, y2, bx, by);
    }
  }
  buildBeachPier();
  // district entrance signs
  const gateSigns = [
    [19, 25, 'HOTEL VICE', '#ff8a2b'],
    [39, 25, 'VICE STADIUM', '#4ade80'],
    [79, 25, 'POLICE HQ', '#24a9ff'],
    [95, 25, 'HOSPITAL', '#ff3b5b'],
    [39, 45, 'GALLERIA', '#ff2d95'],
    [59, 45, 'SKATEPARK', '#b98cff'],
    [79, 45, 'CONSTRUÇÃO', '#ffd166'],
    [95, 45, 'BEACH CLUB', '#24e0ff'],
    [39, 65, 'JARDIM', '#4ade80'],
    [59, 65, 'DRIVE-IN', '#ffd166'],
    [95, 65, 'FAROL', '#f3f0e6'],
    [19, 85, 'FEIRA', '#ff8a2b'],
    [39, 85, 'POSTO 24H', '#4ade80'],
    [59, 85, 'RÁDIO', '#ff3b5b'],
    [79, 85, 'ARCADE', '#ff2d95'],
    [19, 89, 'PARQUE', '#ff8a2b'],
    [39, 89, 'AUTÓDROMO', '#ffd166'],
    [59, 89, 'QUADRAS', '#24e0ff'],
    [79, 89, 'TIKI BAR', '#ff8a2b'],
    [95, 89, 'OCEAN DR', '#24e0ff']
  ];
  for (const g of gateSigns) addGateSign(g[0], g[1], g[2], g[3]);
  // landmark "VICE CITY" gateway signs
  addProp('citySign', 101 * T + 8, 52 * T + 14);
  addProp('citySign', 60 * T + 8, 8 * T + 14);
  addProp('citySign', 20 * T + 8, 96 * T + 14);
  addProp('citySign', 96 * T + 8, 70 * T + 14);
  // street furniture along the avenues
  for (const [a, b] of VROADS) {
    for (let y = 10; y < 97; y += 12) {
      furnishStreet(a - 1, y);
      furnishStreet(b + 1, y + 6);
    }
  }
  for (const [a, b] of HROADS) {
    for (let x = 10; x < 97; x += 13) {
      furnishStreet(x, a - 1);
      furnishStreet(x + 6, b + 1);
    }
  }
  // beach: lifeguards, volleyball, kiosks, towels, palms
  for (let y = 10; y < MH; y += 7) addPalm(101, y, .9 + hash2(y, 3) * .25);
  for (let y = 8; y < MH; y += 6) addLamp(100, y);
  for (const y of [14, 32, 50, 68, 86]) addLifeguard(106, y);
  addLifeguard(109, 24);
  specials.push({ type: 'court', x: 107 * T, y: 59 * T, w: 58, h: 42, color: '#d8b46a' });
  addProp('net', 107 * T, 59 * T, { w: 52, h: 30 });
  for (const y of [20, 40, 62, 80]) addStall(101, y, pick(['#ff2d95', '#24e0ff', '#ffd166', '#4ade80']));
  for (let i = 0; i < 26; i++) {
    const tx = randInt(105, 110), ty = randInt(6, 96);
    if (!isSolidAt(tx * T, ty * T) && tileAt(tx, ty) === TILE.SAND) {
      if (i % 4 === 0) addUmbrella(tx, ty, pick(['#ff2d95', '#24e0ff', '#ffd166', '#b98cff']));
      else if (i % 4 === 1) addTowels(tx, ty, pick(['#ff2d95', '#24e0ff', '#ffd166', '#f3f0e6']));
      else if (i % 4 === 2) addFlowers(tx, ty, '#f3f0e6');
      else addPalm(tx, ty, .65 + rand(.4));
    }
  }
  for (let i = 0; i < 7; i++) addBoat(rand(114 * T, 126 * T), rand(10 * T, 92 * T), pick(['#f3f0e6', '#ff5fb5', '#24e0ff']));
  for (let y = 4; y < MH; y += 9) addPalm(2, y, .85);
  for (let x = 4; x < 96; x += 17) addLamp(x, 3);
  for (const cx of VCENTERS) for (const cy of HCENTERS) specials.push({ type: 'crosswalk', cx, cy });
  // manholes & street decals at some intersections
  for (const cx of VCENTERS) for (const cy of HCENTERS) {
    if (hash2(cx * 7, cy * 11) > .45) specials.push({ type: 'manhole', x: (cx + .5) * T + 10, y: (cy + .5) * T + 8 });
    if (hash2(cx * 3, cy * 5) > .6) specials.push({ type: 'skid', x: (cx + .5) * T, y: (cy + .5) * T, seed: hash2(cx, cy) });
  }
  addPOI('PRAIA DE VICE', 107, 44, '#24e0ff');
}

/* ----------------------------- pre-rendered world ----------------------------- */
const worldCanvas = document.createElement('canvas');
worldCanvas.width = WORLD_W; worldCanvas.height = WORLD_H;
const nightCanvas = document.createElement('canvas');
nightCanvas.width = WORLD_W; nightCanvas.height = WORLD_H;
const minimapCanvas = document.createElement('canvas');
minimapCanvas.width = MW * 2; minimapCanvas.height = MH * 2;

function drawGround(c) {
  for (let ty = 0; ty < MH; ty++) {
    for (let tx = 0; tx < MW; tx++) {
      const t = tileAt(tx, ty);
      const x = tx * T, y = ty * T;
      const h = hash2(tx, ty);
      const h2 = hash2(tx * 7 + 3, ty * 11 + 5);
      const h3 = hash2(tx * 13 + 1, ty * 17 + 9);
      if (t === TILE.WATER) {
        c.fillStyle = (tx + ty) % 7 === 0 ? '#1a6280' : '#175a76';
        c.fillRect(x, y, T, T);
        c.fillStyle = 'rgba(90,190,225,.10)';
        c.fillRect(x, y + (h * 12 | 0), T, 1);
        if (h2 > .55) {
          c.fillStyle = 'rgba(150,235,255,.14)';
          c.fillRect(x + (h2 * 10 | 0), y + (h3 * 12 | 0), 5 + (h3 * 6 | 0), 1);
        }
        if (h3 > .82) { c.fillStyle = 'rgba(220,250,255,.22)'; c.fillRect(x + 3, y + 4, 1, 1); }
      } else if (t === TILE.SAND) {
        c.fillStyle = h > .5 ? '#e3c589' : '#dcbd7f'; c.fillRect(x, y, T, T);
        // wind ripples
        c.fillStyle = 'rgba(190,155,100,.22)';
        if (h2 > .35) c.fillRect(x + 1, y + 3 + (h2 * 8 | 0), 7, 1);
        if (h3 > .55) c.fillRect(x + 8, y + 9 + (h3 * 4 | 0), 6, 1);
        // grains / shells
        if (h > .7) { c.fillStyle = '#cdae73'; c.fillRect(x + (h * 12 | 0), y + (h2 * 9 | 0), 2, 1); }
        if (h2 > .88) { c.fillStyle = '#fff2d0'; c.fillRect(x + 5, y + 7, 2, 1); c.fillRect(x + 6, y + 8, 1, 1); }
        if (h3 > .92) { c.fillStyle = '#e88a6a'; c.fillRect(x + 9, y + 5, 2, 2); }
        // footprints
        if (h > .82 && h2 > .5) {
          c.fillStyle = 'rgba(150,120,80,.35)';
          c.fillRect(x + 4, y + 6, 2, 3); c.fillRect(x + 7, y + 10, 2, 3);
        }
        // wet band near the ocean
        if (tx === 111) {
          c.fillStyle = 'rgba(120,170,180,.20)'; c.fillRect(x + 10, y, 6, T);
          c.fillStyle = 'rgba(230,250,255,.35)'; c.fillRect(x + 14, y + (h * 12 | 0), 2, 4);
        }
      } else if (t === TILE.GRASS) {
        c.fillStyle = (ty % 4 < 2) ? (h > .5 ? '#3b7447' : '#396f44') : (h > .5 ? '#376d43' : '#356a41');
        c.fillRect(x, y, T, T);
        if (h > .62) { c.fillStyle = '#4f8c5b'; c.fillRect(x + (h * 11 | 0), y + 3 + (h2 * 7 | 0), 1, 3); }
        if (h2 > .74) { c.fillStyle = '#2c5c39'; c.fillRect(x + (h3 * 12 | 0), y + 10, 2, 1); }
        if (h3 > .93) { c.fillStyle = pick(['#ffd166', '#ff8a2b', '#f3f0e6']); c.fillRect(x + 6, y + 6, 1, 1); }
      } else if (t === TILE.PARK) {
        c.fillStyle = h > .5 ? '#39784a' : '#347043'; c.fillRect(x, y, T, T);
        c.fillStyle = 'rgba(255,255,255,.03)'; c.fillRect(x, y, T, 1);
        if (h > .55) { c.fillStyle = '#4d925d'; c.fillRect(x + (h * 10 | 0), y + 5 + (h2 * 6 | 0), 2, 2); }
        if (h2 > .78) { c.fillStyle = pick(['#ff2d95', '#ffd166', '#f3f0e6', '#b98cff']); c.fillRect(x + 3 + (h3 * 9 | 0), y + 4 + (h * 8 | 0), 1, 1); }
        if (h3 > .86) { c.fillStyle = 'rgba(120,90,40,.4)'; c.fillRect(x + 8, y + 11, 3, 1); }
      } else if (t === TILE.ROAD) {
        c.fillStyle = (h > .6) ? '#2b2c38' : '#292a36'; c.fillRect(x, y, T, T);
        // asphalt aggregate
        if (h > .45) { c.fillStyle = '#333445'; c.fillRect(x + (h * 12 | 0), y + (h2 * 12 | 0), 2, 1); }
        if (h2 > .6) { c.fillStyle = '#242531'; c.fillRect(x + (h3 * 13 | 0), y + (h * 13 | 0), 3, 1); }
        // tar seams
        if (h3 > .9) { c.fillStyle = '#1f2029'; c.fillRect(x + 2, y + (h * 12 | 0), 12, 1); }
        // cracks
        if (h2 > .93) {
          c.strokeStyle = 'rgba(18,18,26,.7)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(x + 3, y + 3); c.lineTo(x + 8, y + 8); c.lineTo(x + 6, y + 13); c.stroke();
        }
        // oil stain
        if (h > .9) { c.fillStyle = 'rgba(12,12,20,.4)'; c.beginPath(); c.ellipse(x + 8, y + 9, 4, 2, .4, 0, TAU); c.fill(); }
      } else if (t === TILE.SIDEWALK) {
        c.fillStyle = ((tx + ty) & 1)
          ? (h > .5 ? '#bab4ab' : '#b3ada4')
          : (h > .5 ? '#aca69d' : '#a6a097');
        c.fillRect(x, y, T, T);
        // slab joints
        c.fillStyle = 'rgba(70,64,62,.30)'; c.fillRect(x, y, T, 1); c.fillRect(x, y, 1, T);
        c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(x + 1, y + 1, T - 2, 1);
        // cracks & gum
        if (h2 > .8) { c.strokeStyle = 'rgba(90,84,82,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 4, y + 2); c.lineTo(x + 7, y + 7); c.lineTo(x + 5, y + 12); c.stroke(); }
        if (h3 > .86) { c.fillStyle = 'rgba(60,55,55,.45)'; c.fillRect(x + 10, y + 9, 2, 2); }
      } else if (t === TILE.PARKING) {
        c.fillStyle = h > .5 ? '#343541' : '#31323e'; c.fillRect(x, y, T, T);
        if (h > .8) { c.fillStyle = '#3d3e4b'; c.fillRect(x + 3, y + 6, 7, 1); }
        if (h2 > .7) { c.fillStyle = 'rgba(15,15,22,.35)'; c.beginPath(); c.ellipse(x + 7, y + 10, 3, 2, 0, 0, TAU); c.fill(); }
        if (h3 > .9) { c.strokeStyle = 'rgba(200,200,210,.12)'; c.beginPath(); c.moveTo(x + 2, y + 13); c.lineTo(x + 13, y + 2); c.stroke(); }
      } else if (t === TILE.PLAZA) {
        c.fillStyle = ((tx + ty) & 1)
          ? (h > .5 ? '#c3a4a4' : '#bd9e9e')
          : (h > .5 ? '#b59494' : '#af8e8e');
        c.fillRect(x, y, T, T);
        // Portuguese-pavement motif
        c.fillStyle = 'rgba(255,255,255,.08)';
        c.fillRect(x, y, T, 1); c.fillRect(x, y, 1, T);
        c.fillStyle = 'rgba(110,75,85,.14)';
        c.fillRect(x + 4, y + 4, 8, 8);
        if (((tx + ty) & 1) && h2 > .5) {
          c.fillStyle = 'rgba(255,255,255,.06)';
          c.beginPath(); c.moveTo(x + 8, y + 3); c.lineTo(x + 13, y + 8); c.lineTo(x + 8, y + 13); c.lineTo(x + 3, y + 8); c.closePath(); c.fill();
        }
        if (h2 > .86) { c.fillStyle = 'rgba(90,60,70,.14)'; c.fillRect(x + 2, y + 11, 6, 2); }
      } else if (t === TILE.BOARDWALK) {
        c.fillStyle = h > .5 ? '#a9774e' : '#9f6d46'; c.fillRect(x, y, T, T);
        // vertical planks
        c.fillStyle = 'rgba(60,30,15,.28)';
        c.fillRect(x + 4, y, 1, T); c.fillRect(x + 10, y, 1, T);
        c.fillStyle = 'rgba(255,220,180,.06)'; c.fillRect(x + 5, y, 4, T);
        if (h2 > .8) { c.fillStyle = 'rgba(50,25,12,.4)'; c.fillRect(x + 6, y + 5, 1, 1); }
      } else if (t === TILE.PIER) {
        c.fillStyle = h > .5 ? '#7f5233' : '#754a2d'; c.fillRect(x, y, T, T);
        // horizontal planks
        c.fillStyle = 'rgba(40,20,10,.32)'; c.fillRect(x, y + 4, T, 1); c.fillRect(x, y + 11, T, 1);
        c.fillStyle = 'rgba(255,210,160,.05)'; c.fillRect(x, y + 5, T, 1);
        if (h2 > .82) { c.fillStyle = '#3a2a1a'; c.fillRect(x + 3, y + 6, 1, 1); c.fillRect(x + 12, y + 13, 1, 1); }
      } else if (t === TILE.BUILDING) {
        c.fillStyle = '#22202b'; c.fillRect(x, y, T, T);
      }
    }
  }
  // road markings
  for (let ty = 0; ty < MH; ty++) {
    for (let tx = 0; tx < MW; tx++) {
      if (tileAt(tx, ty) !== TILE.ROAD) continue;
      const o = roadOrient[ty * MW + tx];
      if (o === 2) {
        if (VCENTERS.includes(tx)) {
          c.fillStyle = 'rgba(255,209,102,.5)';
          if (ty % 2 === 0) c.fillRect(tx * T + 7, ty * T + 2, 2, 8);
        }
        c.fillStyle = 'rgba(255,255,255,.09)'; c.fillRect(tx * T + 2, ty * T, 1, T);
        c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(tx * T + 13, ty * T, 1, T);
      } else if (o === 1) {
        if (HCENTERS.includes(ty)) {
          c.fillStyle = 'rgba(255,209,102,.5)';
          if (tx % 2 === 0) c.fillRect(tx * T + 2, ty * T + 7, 8, 2);
        }
        c.fillStyle = 'rgba(255,255,255,.09)'; c.fillRect(tx * T, ty * T + 2, T, 1);
        c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(tx * T, ty * T + 13, T, 1);
      } else if (o === 3) {
        // intersection corner wear
        c.fillStyle = 'rgba(0,0,0,.10)'; c.fillRect(tx * T + 2, ty * T + 2, T - 4, T - 4);
      }
    }
  }
  // curbs and drains
  for (let ty = 0; ty < MH; ty++) {
    for (let tx = 0; tx < 100; tx++) {
      if (tileAt(tx, ty) !== TILE.SIDEWALK) continue;
      c.fillStyle = 'rgba(50,45,45,.35)';
      if (inRoad(tx + 1, ty)) c.fillRect(tx * T + T - 2, ty * T, 2, T);
      if (inRoad(tx - 1, ty)) c.fillRect(tx * T, ty * T, 2, T);
      if (inRoad(tx, ty + 1)) c.fillRect(tx * T, ty * T + T - 2, T, 2);
      if (inRoad(tx, ty - 1)) c.fillRect(tx * T, ty * T, T, 2);
      const h = hash2(tx, ty);
      if (h > .9 && (inRoad(tx + 1, ty) || inRoad(tx - 1, ty))) {
        c.fillStyle = 'rgba(30,30,38,.55)';
        c.fillRect(tx * T + (inRoad(tx + 1, ty) ? 11 : 2), ty * T + 5, 3, 6);
      }
    }
  }
  // park path edging
  for (let ty = 0; ty < MH; ty++) {
    for (let tx = 0; tx < 100; tx++) {
      if (tileAt(tx, ty) !== TILE.PLAZA) continue;
      const nearPark = tileAt(tx + 1, ty) === TILE.PARK || tileAt(tx - 1, ty) === TILE.PARK || tileAt(tx, ty + 1) === TILE.PARK || tileAt(tx, ty - 1) === TILE.PARK;
      if (!nearPark) continue;
      c.fillStyle = 'rgba(90,70,60,.22)';
      if (tileAt(tx + 1, ty) === TILE.PARK) c.fillRect(tx * T + T - 2, ty * T, 2, T);
      if (tileAt(tx - 1, ty) === TILE.PARK) c.fillRect(tx * T, ty * T, 2, T);
      if (tileAt(tx, ty + 1) === TILE.PARK) c.fillRect(tx * T, ty * T + T - 2, T, 2);
      if (tileAt(tx, ty - 1) === TILE.PARK) c.fillRect(tx * T, ty * T, T, 2);
    }
  }
}

function drawSpecials(c) {
  for (const s of specials) {
    if (s.type === 'parking') {
      c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1;
      for (let x = s.x1 + 2; x < s.x2; x += 3) {
        c.beginPath(); c.moveTo(x * T + 8, s.y1 * T + 8); c.lineTo(x * T + 8, s.y2 * T - 8); c.stroke();
      }
    } else if (s.type === 'crosswalk') {
      const cx = s.cx, cy = s.cy;
      c.fillStyle = 'rgba(245,245,235,.65)';
      for (let i = -2; i <= 2; i++) {
        c.fillRect((cx + i * 0.4) * T + 2, (cy - 1) * T + 2, 3, 7);
        c.fillRect((cx + i * 0.4) * T + 2, (cy + 1) * T + 7, 3, 7);
        c.fillRect((cx - 1) * T + 2, (cy + i * 0.4) * T + 2, 7, 3);
        c.fillRect((cx + 1) * T + 7, (cy + i * 0.4) * T + 2, 7, 3);
      }
    } else if (s.type === 'helipad') {
      c.save();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3;
      c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,209,102,.75)'; c.lineWidth = 2;
      c.beginPath(); c.arc(s.x, s.y, s.r - 7, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.65)';
      c.fillRect(s.x - 13, s.y - 16, 6, 32); c.fillRect(s.x + 7, s.y - 16, 6, 32);
      c.fillRect(s.x - 7, s.y - 3, 14, 6);
      c.restore();
    } else if (s.type === 'fountain') {
      c.fillStyle = '#2b5f74'; c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fill();
      c.strokeStyle = '#c7b7a7'; c.lineWidth = 4; c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(150,230,255,.5)'; c.beginPath(); c.arc(s.x, s.y, s.r - 6, 0, TAU); c.fill();
      c.fillStyle = '#d7c9b8'; c.fillRect(s.x - 2, s.y - 12, 4, 24);
    } else if (s.type === 'pool') {
      c.fillStyle = '#2a8f9f'; c.fillRect(s.x1 * T, s.y1 * T, (s.x2 - s.x1) * T, (s.y2 - s.y1) * T);
      c.strokeStyle = '#e8e1d4'; c.lineWidth = 2; c.strokeRect(s.x1 * T, s.y1 * T, (s.x2 - s.x1) * T, (s.y2 - s.y1) * T);
      c.fillStyle = 'rgba(180,245,255,.28)';
      for (let i = 0; i < 4; i++) c.fillRect(s.x1 * T + 4 + i * 12, s.y1 * T + 6 + (i % 2) * 10, 8, 1);
    } else if (s.type === 'pier') {
      c.fillStyle = 'rgba(45,22,10,.45)';
      for (let x = s.x1; x <= s.x2; x += 4) {
        c.fillRect(x * T, s.y1 * T, 2, (s.y2 - s.y1 + 1) * T);
        c.fillRect(x * T, s.y1 * T, 3, 3); c.fillRect(x * T, s.y2 * T + 12, 3, 3);
      }
    } else if (s.type === 'carpet') {
      c.fillStyle = 'rgba(180,20,75,.45)'; c.fillRect(s.x - s.w / 2, s.y - s.h, s.w, s.h);
      c.fillStyle = 'rgba(255,209,102,.35)';
      c.fillRect(s.x - s.w / 2, s.y - s.h, 2, s.h); c.fillRect(s.x + s.w / 2 - 2, s.y - s.h, 2, s.h);
    } else if (s.type === 'clubSign') {
      c.fillStyle = '#1b0a18'; c.fillRect(s.x - s.w / 2, s.y - 9, s.w, 18);
      c.strokeStyle = '#ff2d95'; c.lineWidth = 1; c.strokeRect(s.x - s.w / 2, s.y - 9, s.w, 18);
    } else if (s.type === 'medallion') {
      c.save(); c.translate(s.x, s.y);
      c.strokeStyle = 'rgba(255,209,102,.28)'; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, s.r, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(120,80,90,.25)'; c.lineWidth = 1;
      c.beginPath(); c.arc(0, 0, s.r - 5, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(255,209,102,.18)';
      for (let i = 0; i < 8; i++) {
        c.save(); c.rotate(i * TAU / 8);
        c.beginPath(); c.moveTo(0, -s.r + 6); c.lineTo(4, 0); c.lineTo(0, s.r - 6); c.lineTo(-4, 0); c.closePath(); c.fill();
        c.restore();
      }
      c.restore();
    } else if (s.type === 'cross') {
      c.fillStyle = s.color || 'rgba(255,59,91,.7)';
      c.fillRect(s.x - 5, s.y - s.r, 10, s.r * 2);
      c.fillRect(s.x - s.r, s.y - 5, s.r * 2, 10);
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1;
      c.strokeRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    } else if (s.type === 'court') {
      c.save(); c.translate(s.x, s.y);
      c.fillStyle = s.color || '#c2543c'; c.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
      c.fillStyle = 'rgba(0,0,0,.10)';
      for (let i = -s.w / 2; i < s.w / 2; i += 8) c.fillRect(i, -s.h / 2, 1, s.h);
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5;
      c.strokeRect(-s.w / 2 + 2, -s.h / 2 + 2, s.w - 4, s.h - 4);
      c.beginPath(); c.moveTo(0, -s.h / 2 + 2); c.lineTo(0, s.h / 2 - 2); c.stroke();
      c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.stroke();
      c.strokeRect(-s.w / 2 + 2, -s.h / 4, 12, s.h / 2);
      c.strokeRect(s.w / 2 - 14, -s.h / 4, 12, s.h / 2);
      c.restore();
    } else if (s.type === 'track') {
      c.save(); c.translate(s.x, s.y);
      // outer stadium ring
      c.fillStyle = '#8a5a3a';
      c.beginPath(); c.ellipse(0, 0, s.rx, s.ry, 0, 0, TAU); c.fill();
      c.fillStyle = '#b4674b';
      c.beginPath(); c.ellipse(0, 0, s.rx - 5, s.ry - 5, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1;
      for (let i = 1; i <= 3; i++) { c.beginPath(); c.ellipse(0, 0, s.rx - 5 - i * 7, s.ry - 5 - i * 7, 0, 0, TAU); c.stroke(); }
      // field
      const fx = s.rx * .58, fy = s.ry * .5;
      c.fillStyle = s.small ? '#3d6b45' : '#3f7d4a';
      c.fillRect(-fx, -fy, fx * 2, fy * 2);
      c.fillStyle = 'rgba(255,255,255,.10)';
      for (let i = 0; i < 8; i++) c.fillRect(-fx + i * (fx * 2 / 8), -fy, 1, fy * 2);
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1;
      c.strokeRect(-fx, -fy, fx * 2, fy * 2);
      c.beginPath(); c.moveTo(0, -fy); c.lineTo(0, fy); c.stroke();
      c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.stroke();
      c.restore();
    } else if (s.type === 'skate') {
      c.save();
      c.fillStyle = 'rgba(120,118,126,.55)';
      c.fillRect(s.x1 * T, s.y1 * T, (s.x2 - s.x1) * T, (s.y2 - s.y1) * T);
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
      for (let x = s.x1; x <= s.x2; x += 3) { c.beginPath(); c.moveTo(x * T, s.y1 * T); c.lineTo(x * T, s.y2 * T); c.stroke(); }
      // bowls
      for (let i = 0; i < 3; i++) {
        const bx = (s.x1 + 3 + i * 4.4) * T, by = (s.y1 + 4 + (i % 2) * 5) * T;
        c.fillStyle = 'rgba(45,44,52,.55)'; c.beginPath(); c.ellipse(bx, by, 22, 13, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(220,220,230,.25)'; c.lineWidth = 2; c.stroke();
        c.fillStyle = 'rgba(150,230,255,.10)'; c.beginPath(); c.ellipse(bx, by, 16, 8, 0, 0, TAU); c.fill();
      }
      c.restore();
    } else if (s.type === 'dirt') {
      c.save();
      c.fillStyle = '#6b5436';
      c.fillRect(s.x1 * T, s.y1 * T, (s.x2 - s.x1) * T, (s.y2 - s.y1) * T);
      for (let i = 0; i < 40; i++) {
        const h = hash2(i, s.x1);
        c.fillStyle = h > .5 ? '#7a6040' : '#5c472e';
        c.fillRect(s.x1 * T + h * (s.x2 - s.x1) * T, s.y1 * T + hash2(i, s.y2) * (s.y2 - s.y1) * T, 3, 2);
      }
      c.strokeStyle = 'rgba(40,30,20,.35)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(s.x1 * T + 6, s.y2 * T - 8); c.bezierCurveTo(s.x1 * T + 40, s.y1 * T + 20, s.x2 * T - 50, s.y2 * T - 20, s.x2 * T - 6, s.y1 * T + 10); c.stroke();
      c.restore();
    } else if (s.type === 'pit') {
      c.save();
      c.fillStyle = '#2a2018';
      c.fillRect(s.x1 * T, s.y1 * T, (s.x2 - s.x1) * T, (s.y2 - s.y1) * T);
      c.fillStyle = '#1a1410';
      c.fillRect(s.x1 * T + 5, s.y1 * T + 5, (s.x2 - s.x1) * T - 10, (s.y2 - s.y1) * T - 10);
      c.strokeStyle = 'rgba(255,209,102,.5)'; c.lineWidth = 2;
      c.setLineDash([6, 4]); c.strokeRect(s.x1 * T + 2, s.y1 * T + 2, (s.x2 - s.x1) * T - 4, (s.y2 - s.y1) * T - 4); c.setLineDash([]);
      c.strokeStyle = 'rgba(160,150,140,.35)'; c.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const rx = s.x1 * T + 10 + i * 12, ry = s.y1 * T + 10 + (i % 3) * 14;
        c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx + 6, ry + 10); c.stroke();
      }
      c.restore();
    } else if (s.type === 'pond') {
      const x = s.x1 * T, y = s.y1 * T, w = (s.x2 - s.x1) * T, h = (s.y2 - s.y1) * T;
      c.save();
      c.fillStyle = '#2b6a6f';
      c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(230,235,220,.5)'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w / 2 - 2, h / 2 - 2, 0, 0, TAU); c.stroke();
      c.fillStyle = 'rgba(150,230,255,.20)';
      for (let i = 0; i < 5; i++) c.fillRect(x + 8 + i * 9, y + 8 + (i % 3) * 7, 6, 1);
      c.fillStyle = '#4ade80';
      for (let i = 0; i < 4; i++) c.beginPath(), c.ellipse(x + 10 + i * 13, y + 10 + (i % 2) * 10, 3, 2, 0, 0, TAU), c.fill();
      c.restore();
    } else if (s.type === 'manhole') {
      c.save(); c.translate(s.x, s.y);
      c.fillStyle = '#1d1e27'; c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(150,150,160,.4)'; c.lineWidth = 1;
      c.beginPath(); c.arc(0, 0, 5, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(-3, 0); c.lineTo(3, 0); c.moveTo(0, -3); c.lineTo(0, 3); c.stroke();
      c.restore();
    } else if (s.type === 'skid') {
      c.save(); c.translate(s.x, s.y); c.rotate(s.seed * TAU);
      c.strokeStyle = 'rgba(12,12,18,.45)'; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 16, .2, 2.2); c.stroke();
      c.beginPath(); c.arc(0, 4, 13, .4, 2.4); c.stroke();
      c.restore();
    } else if (s.type === 'rock') {
      c.save(); c.translate(s.x, s.y);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + .3, d = s.r * (.6 + hash2(i, 3) * .5);
        c.fillStyle = i % 2 ? '#6f6a72' : '#5c5860';
        c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, 7, 5, a, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.12)';
        c.beginPath(); c.ellipse(Math.cos(a) * d - 1, Math.sin(a) * d - 2, 3, 2, a, 0, TAU); c.fill();
      }
      c.restore();
    }
  }
}

function drawBuildings(c) {
  for (const b of buildings) {
    const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
    const p = b.pal;
    const seed = b.seed;
    // cast shadow
    c.fillStyle = 'rgba(8,6,18,.42)'; c.fillRect(x + 8, y + 9, w, h);
    // outer wall / parapet
    c.fillStyle = p.wall2; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x, y, w, 2);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, y + h - 3, w, 3);
    // roof slab
    c.fillStyle = p.roof; c.fillRect(x + 3, y + 3, w - 6, h - 6);
    // roof panel grid
    c.fillStyle = 'rgba(0,0,0,.055)';
    for (let ry = y + 3; ry < y + h - 6; ry += 9) c.fillRect(x + 3, ry, w - 6, 1);
    for (let rx = x + 3; rx < x + w - 6; rx += 9) c.fillRect(rx, y + 3, 1, h - 6);
    // parapet trim
    c.strokeStyle = p.trim; c.lineWidth = 1; c.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
    c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(x + 4, y + 4, w - 8, 1);

    // rooftop grime
    c.fillStyle = 'rgba(40,34,50,.22)';
    c.fillRect(x + 8 + (seed * 23 | 0), y + 9 + (seed * 15 | 0), 12, 8);
    c.fillStyle = 'rgba(40,34,50,.14)';
    c.fillRect(x + w - 30 - (seed * 12 | 0), y + h - 26, 10, 9);

    // rooftop AC units
    const acN = (w > 78 && h > 64) ? 2 : 1;
    for (let i = 0; i < acN; i++) {
      const ax = x + 8 + ((seed * 37 + i * 53) % Math.max(12, w - 32)) | 0;
      const ay = y + 9 + ((seed * 29 + i * 41) % Math.max(12, h - 42)) | 0;
      c.fillStyle = 'rgba(20,18,28,.28)'; c.fillRect(ax + 2, ay + 2, 15, 11);
      c.fillStyle = '#8a8f9a'; c.fillRect(ax, ay, 15, 11);
      c.fillStyle = '#b9bec7'; c.fillRect(ax + 1, ay + 1, 13, 3);
      c.strokeStyle = '#5c6069'; c.lineWidth = 1;
      c.beginPath(); c.arc(ax + 7, ay + 7, 3, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(ax + 7, ay + 4); c.lineTo(ax + 7, ay + 10); c.stroke();
      c.beginPath(); c.moveTo(ax + 4, ay + 7); c.lineTo(ax + 10, ay + 7); c.stroke();
    }

    // water tank / antenna / solar / skylight
    if (seed > .58 && w > 56 && h > 56) {
      const tx = x + w - 26 - (seed * 10 | 0), ty = y + 16 + (seed * 9 | 0);
      c.fillStyle = 'rgba(20,18,28,.25)'; c.fillRect(tx + 2, ty + 2, 14, 12);
      c.fillStyle = '#7d6a58'; c.fillRect(tx, ty, 14, 12);
      c.fillStyle = '#9c8770'; c.fillRect(tx + 2, ty + 1, 10, 4);
      c.strokeStyle = '#4e4034'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(tx + 3, ty + 12); c.lineTo(tx + 3, ty + 16); c.moveTo(tx + 11, ty + 12); c.lineTo(tx + 11, ty + 16); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(tx + 4, ty + 3, 6, 1);
    } else if (seed < .38 && w > 46) {
      const ax = x + 12 + (seed * 18 | 0), ay = y + h - 24;
      c.strokeStyle = '#4a4652'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax, ay - 16); c.stroke();
      c.beginPath(); c.moveTo(ax - 4, ay - 16); c.lineTo(ax + 4, ay - 16); c.stroke();
      c.beginPath(); c.moveTo(ax, ay - 8); c.lineTo(ax + 5, ay - 12); c.moveTo(ax, ay - 12); c.lineTo(ax - 5, ay - 16); c.stroke();
      c.fillStyle = '#ff3b5b'; c.fillRect(ax - 1, ay - 18, 2, 2);
    }
    if (seed > .46 && w > 64 && h > 48) {
      const sx = x + 14 + (seed * 15 | 0), sy = y + h - 30 - (seed * 8 | 0);
      c.fillStyle = '#22384f'; c.fillRect(sx, sy, 18, 10);
      c.strokeStyle = 'rgba(150,220,255,.35)'; c.lineWidth = 1; c.strokeRect(sx, sy, 18, 10);
      c.beginPath(); c.moveTo(sx + 6, sy); c.lineTo(sx + 6, sy + 10); c.moveTo(sx + 12, sy); c.lineTo(sx + 12, sy + 10); c.stroke();
    }
    if (seed > .82 && h > 64) {
      c.fillStyle = '#4a7d52'; c.fillRect(x + 10, y + 12, 20, 12);
      c.fillStyle = '#5d9663'; c.fillRect(x + 12, y + 14, 7, 4); c.fillRect(x + 20, y + 16, 6, 4);
    }

    // rooftop access hut, pipe run and vents on larger roofs
    if (w > 70 && h > 55) {
      const sx = x + 12 + ((seed * 21) | 0), sy = y + 14 + ((seed * 17) | 0);
      c.fillStyle = 'rgba(20,18,28,.25)'; c.fillRect(sx + 2, sy + 2, 18, 13);
      c.fillStyle = '#6f6a78'; c.fillRect(sx, sy, 18, 13);
      c.fillStyle = '#8f8a98'; c.fillRect(sx + 1, sy + 1, 16, 3);
      c.fillStyle = '#38343f'; c.fillRect(sx + 7, sy + 6, 5, 7);
      c.fillStyle = '#b9bec7'; c.fillRect(sx + 13, sy + 6, 2, 2);
      c.fillStyle = '#5c5765'; c.fillRect(x + 6, y + 7, w - 12, 2);
      c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x + 6, y + 7, w - 12, 1);
      for (let i = 0; i < 3; i++) {
        const vx = x + 10 + i * ((w - 22) / 3), vy = y + h - 21;
        c.fillStyle = '#4a4654'; c.fillRect(vx, vy, 5, 5);
        c.fillStyle = '#6b6674'; c.fillRect(vx + 1, vy + 1, 3, 1);
      }
    }
    if (w > 110 && h > 70) {
      const ax2 = x + w - 44, ay2 = y + 12;
      c.fillStyle = 'rgba(20,18,28,.25)'; c.fillRect(ax2 + 2, ay2 + 2, 14, 10);
      c.fillStyle = '#9a9fa9'; c.fillRect(ax2, ay2, 14, 10);
      c.fillStyle = '#c2c7cf'; c.fillRect(ax2 + 1, ay2 + 1, 12, 2);
      c.strokeStyle = '#5c6069'; c.lineWidth = 1;
      c.beginPath(); c.arc(ax2 + 7, ay2 + 6, 2.5, 0, TAU); c.stroke();
    }

    // side windows (vertical edges)
    for (let wy = y + 10; wy < y + h - 16; wy += 13) {
      const litA = hash2(y, wy) > .55, litB = hash2(wy, x) > .55;
      c.fillStyle = litA ? 'rgba(255,232,168,.85)' : '#2b2736'; c.fillRect(x + 1, wy, 2, 6);
      c.fillStyle = litB ? 'rgba(255,232,168,.7)' : '#2b2736'; c.fillRect(x + w - 3, wy, 2, 6);
    }

    // facade strip along the bottom
    const fh = 12;
    c.fillStyle = p.wall2; c.fillRect(x, y + h - fh, w, fh);
    c.fillStyle = p.wall; c.fillRect(x + 1, y + h - fh + 1, w - 2, fh - 2);
    c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(x + 1, y + h - 2, w - 2, 2);
    c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(x + 1, y + h - fh + 1, w - 2, 1);

    // storefront windows
    for (let wx = x + 6; wx < x + w - 9; wx += 12) {
      const lit = hash2(wx, y) > .42;
      c.fillStyle = lit ? '#ffe8a8' : '#302c3b';
      c.fillRect(wx, y + h - fh + 3, 7, 5);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(wx, y + h - fh + 3, 7, 1);
      c.fillStyle = p.trim; c.fillRect(wx - 1, y + h - fh + 8, 9, 1);
      if (lit && hash2(wx, y * 3) > .6) {
        c.fillStyle = 'rgba(255,232,168,.10)'; c.fillRect(wx - 2, y + h - fh + 9, 11, 3);
      }
    }

    // door + stoop
    c.fillStyle = '#1d1626'; c.fillRect(x + w / 2 - 6, y + h - 8, 12, 8);
    c.fillStyle = 'rgba(255,232,168,.35)'; c.fillRect(x + w / 2 - 4, y + h - 7, 8, 1);
    c.fillStyle = p.trim; c.fillRect(x + w / 2 - 10, y + h - 11, 20, 3);
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x + w / 2 - 10, y + h - 11, 20, 1);

    // awning for shops
    if (b.name && w > 52) {
      const aw = Math.min(w - 16, 46), ax = x + w / 2 - aw / 2, ay = y + h - fh + 2;
      c.fillStyle = 'rgba(20,14,26,.35)'; c.fillRect(ax, ay, aw, 5);
      for (let i = 0; i < aw; i += 6) {
        c.fillStyle = i % 12 === 0 ? p.trim : '#2a2233';
        c.fillRect(ax + i, ay, 6, 4);
      }
      c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(ax, ay, aw, 1);
    }

    // neon underglow / sign glow
    if (b.neon) {
      c.fillStyle = b.neon + '55'; c.fillRect(x + 2, y + h - 1, w - 4, 1);
      c.fillStyle = b.neon + '22'; c.fillRect(x + 4, y + h, w - 8, 2);
    }

    // balconies for taller buildings
    if (h > 88) {
      for (let by2 = y + 18; by2 < y + h - 26; by2 += 20) {
        c.fillStyle = 'rgba(30,26,40,.45)'; c.fillRect(x + w - 12, by2, 9, 2);
        c.fillStyle = p.trim; c.fillRect(x + w - 12, by2 - 1, 9, 1);
      }
    }

    // special uses
    if (b.pool) { c.fillStyle = '#2a8f9f'; c.fillRect(x + 8, y + 8, 18, 12); c.strokeStyle = '#e8e1d4'; c.lineWidth = 1; c.strokeRect(x + 8, y + 8, 18, 12); }
    if (b.garage) {
      c.fillStyle = '#191622'; c.fillRect(x + w / 2 - 20, y + h - 13, 40, 13);
      c.fillStyle = 'rgba(255,209,102,.42)';
      for (let i = 0; i < 4; i++) c.fillRect(x + w / 2 - 18, y + h - 11 + i * 2, 36, 1);
      c.fillStyle = '#2a2433'; c.fillRect(x + w / 2 - 20, y + h - 13, 40, 1);
    }
    if (b.club) {
      c.fillStyle = '#ff2d95'; c.fillRect(x + 2, y + h - fh, w - 4, 1);
      c.fillStyle = 'rgba(255,45,149,.30)'; c.fillRect(x + 6, y + h - 1, w - 12, 3);
      c.fillStyle = '#24e0ff'; c.fillRect(x + 2, y + h - fh - 2, 10, 1);
    }
  }
}

function drawSigns(c) {
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const s of signs) {
    const w = Math.max(28, s.text.length * 6 + 10);
    c.fillStyle = 'rgba(12,8,18,.82)';
    c.fillRect(s.x - w / 2, s.y - 10, w, 13);
    c.strokeStyle = s.color; c.lineWidth = 1;
    c.strokeRect(s.x - w / 2 + .5, s.y - 9.5, w - 1, 12);
    c.font = '6px PressStart, monospace';
    c.fillStyle = s.color;
    c.fillText(s.text, s.x, s.y - 3.5);
    c.fillStyle = 'rgba(255,255,255,.18)';
    c.fillRect(s.x - w / 2 + 2, s.y - 9, w - 4, 1);
  }
  c.restore();
}

function drawProps(c) {
  const sorted = props.slice().sort((a, b) => a.y - b.y);
  for (const p of sorted) {
    if (p.type === 'palm') {
      const s = p.scale || 1;
      c.save(); c.translate(p.x, p.y);
      c.fillStyle = 'rgba(8,6,16,.28)'; c.beginPath(); c.ellipse(5, 3, 12 * s, 4 * s, .2, 0, TAU); c.fill();
      c.strokeStyle = '#6d4a2c'; c.lineWidth = 3 * s;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-2 * s, -10 * s, 2 * s, -22 * s); c.stroke();
      c.fillStyle = '#2e6b43';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + p.seed;
        c.save(); c.translate(2 * s, -22 * s); c.rotate(a);
        c.beginPath(); c.ellipse(9 * s, 0, 10 * s, 3 * s, 0, 0, TAU); c.fill(); c.restore();
      }
      c.fillStyle = '#3d8653'; c.beginPath(); c.arc(2 * s, -23 * s, 3.5 * s, 0, TAU); c.fill();
      c.restore();
    } else if (p.type === 'lamp') {
      c.fillStyle = 'rgba(8,6,16,.25)'; c.beginPath(); c.ellipse(p.x + 3, p.y + 2, 7, 2.5, 0, 0, TAU); c.fill();
      c.strokeStyle = '#5b5b6a'; c.lineWidth = 2; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x, p.y - 15); c.stroke();
      c.fillStyle = '#ffd166'; c.fillRect(p.x - 3, p.y - 18, 6, 4);
    } else if (p.type === 'bench') {
      c.fillStyle = '#6f4b32'; c.fillRect(p.x - 8, p.y - 3, 16, 5);
      c.fillStyle = '#4a3020'; c.fillRect(p.x - 8, p.y + 2, 2, 4); c.fillRect(p.x + 6, p.y + 2, 2, 4);
    } else if (p.type === 'hydrant') {
      c.fillStyle = '#c43b3b'; c.fillRect(p.x - 2, p.y - 6, 4, 6); c.fillRect(p.x - 4, p.y - 4, 8, 2);
    } else if (p.type === 'umbrella') {
      c.fillStyle = 'rgba(8,6,16,.22)'; c.beginPath(); c.ellipse(p.x + 3, p.y + 1, 10, 3, 0, 0, TAU); c.fill();
      c.strokeStyle = '#d8d1c2'; c.lineWidth = 1; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x, p.y - 10); c.stroke();
      c.fillStyle = p.color;
      c.beginPath(); c.moveTo(p.x - 11, p.y - 9); c.lineTo(p.x + 11, p.y - 9); c.lineTo(p.x + 6, p.y - 15); c.lineTo(p.x - 6, p.y - 15); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(p.x - 1, p.y - 15, 2, 6);
    } else if (p.type === 'boat') {
      c.save(); c.translate(p.x, p.y);
      c.fillStyle = 'rgba(0,30,45,.28)'; c.beginPath(); c.ellipse(3, 4, 18, 6, 0, 0, TAU); c.fill();
      c.fillStyle = p.color; c.beginPath(); c.moveTo(-16, 0); c.lineTo(14, -2); c.lineTo(9, 5); c.lineTo(-12, 5); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-9, -1, 13, 2);
      c.fillStyle = '#2c3a4a'; c.fillRect(0, -5, 5, 5); c.restore();
    } else if (p.type === 'crate') {
      c.fillStyle = '#8a5a35'; c.fillRect(p.x - 5, p.y - 8, 10, 8);
      c.strokeStyle = '#5c3a20'; c.lineWidth = 1; c.strokeRect(p.x - 5, p.y - 8, 10, 8);
      c.beginPath(); c.moveTo(p.x - 5, p.y - 8); c.lineTo(p.x + 5, p.y); c.stroke();
    } else if (p.type === 'neonPillar') {
      c.fillStyle = '#211126'; c.fillRect(p.x - 3, p.y - 18, 6, 18);
      c.fillStyle = p.color; c.fillRect(p.x - 1, p.y - 17, 2, 13);
    } else if (p.type === 'bush') {
      c.fillStyle = 'rgba(8,6,16,.22)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 2, 9, 3.5, 0, 0, TAU); c.fill();
      c.fillStyle = '#2c623c'; c.beginPath(); c.arc(p.x - 4, p.y - 3, 5, 0, TAU); c.arc(p.x + 3, p.y - 4, 6, 0, TAU); c.arc(p.x, p.y - 8, 5, 0, TAU); c.fill();
      c.fillStyle = p.color; c.beginPath(); c.arc(p.x - 3, p.y - 5, 3.5, 0, TAU); c.arc(p.x + 3, p.y - 6, 3.5, 0, TAU); c.arc(p.x, p.y - 9, 3, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(p.x - 4, p.y - 9, 2, 1); c.fillRect(p.x + 2, p.y - 7, 2, 1);
      if (p.seed > 60) { c.fillStyle = '#ff2d95'; c.fillRect(p.x - 2, p.y - 7, 1, 1); c.fillRect(p.x + 4, p.y - 4, 1, 1); }
    } else if (p.type === 'flowers') {
      c.fillStyle = '#2f6b41'; c.fillRect(p.x, p.y - 3, 1, 3); c.fillRect(p.x + 3, p.y - 4, 1, 4);
      c.fillStyle = p.color; c.fillRect(p.x - 1, p.y - 5, 3, 2); c.fillRect(p.x + 2, p.y - 6, 3, 2);
      c.fillStyle = '#ffd166'; c.fillRect(p.x, p.y - 5, 1, 1); c.fillRect(p.x + 3, p.y - 6, 1, 1);
    } else if (p.type === 'trash') {
      c.fillStyle = 'rgba(8,6,16,.22)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 1, 5, 2, 0, 0, TAU); c.fill();
      c.fillStyle = '#2f3a3d'; c.fillRect(p.x - 4, p.y - 9, 8, 9);
      c.fillStyle = '#465356'; c.fillRect(p.x - 4, p.y - 9, 8, 2);
      c.fillStyle = '#1d2528'; c.fillRect(p.x - 5, p.y - 10, 10, 2);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(p.x - 3, p.y - 7, 1, 5);
      c.fillStyle = '#4ade80'; c.fillRect(p.x + 1, p.y - 6, 2, 1);
    } else if (p.type === 'streetSign') {
      c.fillStyle = 'rgba(8,6,16,.22)'; c.beginPath(); c.ellipse(p.x + 1, p.y + 1, 4, 2, 0, 0, TAU); c.fill();
      c.fillStyle = '#6b6f7c'; c.fillRect(p.x - 1, p.y - 16, 2, 16);
      c.fillStyle = p.color; c.fillRect(p.x - 6, p.y - 17, 12, 5);
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.strokeRect(p.x - 5.5, p.y - 16.5, 11, 4);
      c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(p.x - 4, p.y - 15, 5, 1);
      c.fillStyle = p.color; c.fillRect(p.x + 1, p.y - 11, 5, 3);
    } else if (p.type === 'gateSign') {
      c.fillStyle = 'rgba(8,6,16,.28)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 1, 30, 4, 0, 0, TAU); c.fill();
      c.fillStyle = '#2a2633'; c.fillRect(p.x - 26, p.y - 30, 3, 30); c.fillRect(p.x + 23, p.y - 30, 3, 30);
      c.fillStyle = '#120b1a'; c.fillRect(p.x - 33, p.y - 38, 66, 14);
      c.strokeStyle = p.color; c.lineWidth = 1; c.strokeRect(p.x - 32.5, p.y - 37.5, 65, 13);
      c.save();
      c.font = '5px PressStart, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = p.color; c.shadowColor = p.color; c.shadowBlur = 6;
      c.fillText(p.text, p.x, p.y - 31);
      c.restore();
      c.fillStyle = p.color; c.globalAlpha = .55; c.fillRect(p.x - 30, p.y - 24, 60, 1); c.globalAlpha = 1;
      c.fillStyle = '#ffd166'; c.fillRect(p.x - 33, p.y - 38, 3, 2); c.fillRect(p.x + 30, p.y - 38, 3, 2);
    } else if (p.type === 'citySign') {
      c.fillStyle = 'rgba(8,6,16,.3)'; c.beginPath(); c.ellipse(p.x + 3, p.y + 1, 46, 6, 0, 0, TAU); c.fill();
      c.fillStyle = '#2a2633'; c.fillRect(p.x - 38, p.y - 40, 5, 40); c.fillRect(p.x + 33, p.y - 40, 5, 40);
      c.fillStyle = '#120b1a'; c.fillRect(p.x - 46, p.y - 54, 92, 28);
      c.strokeStyle = '#ff2d95'; c.lineWidth = 1; c.strokeRect(p.x - 45.5, p.y - 53.5, 91, 27);
      c.strokeStyle = 'rgba(36,224,255,.5)'; c.strokeRect(p.x - 43.5, p.y - 51.5, 87, 23);
      c.save();
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '11px PressStart, monospace';
      c.fillStyle = '#ff2d95'; c.shadowColor = '#ff2d95'; c.shadowBlur = 10;
      c.fillText('VICE', p.x, p.y - 45);
      c.fillStyle = '#24e0ff'; c.shadowColor = '#24e0ff'; c.shadowBlur = 10;
      c.fillText('CITY', p.x, p.y - 34);
      c.restore();
      c.fillStyle = '#ffd166'; c.fillRect(p.x - 46, p.y - 54, 4, 3); c.fillRect(p.x + 42, p.y - 54, 4, 3);
      c.fillStyle = 'rgba(255,209,102,.35)';
      c.fillRect(p.x - 30, p.y - 56, 18, 1); c.fillRect(p.x + 12, p.y - 56, 18, 1);
    } else if (p.type === 'mailbox') {
      c.fillStyle = '#3b4f8a'; c.fillRect(p.x - 4, p.y - 8, 8, 6);
      c.fillStyle = '#5570b8'; c.fillRect(p.x - 4, p.y - 8, 8, 2);
      c.fillStyle = '#1d2a4a'; c.fillRect(p.x - 2, p.y - 6, 4, 1);
      c.fillStyle = '#6b6f7c'; c.fillRect(p.x - 1, p.y - 2, 2, 2);
    } else if (p.type === 'planter') {
      c.fillStyle = 'rgba(8,6,16,.22)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 1, 9, 3, 0, 0, TAU); c.fill();
      c.fillStyle = '#8c8580'; c.fillRect(p.x - 7, p.y - 7, 14, 7);
      c.fillStyle = '#a8a19a'; c.fillRect(p.x - 7, p.y - 7, 14, 2);
      c.fillStyle = '#4a3a2c'; c.fillRect(p.x - 5, p.y - 7, 10, 2);
      c.fillStyle = '#3d8653'; c.beginPath(); c.arc(p.x - 2, p.y - 8, 3, 0, TAU); c.arc(p.x + 3, p.y - 8, 3, 0, TAU); c.fill();
      if (p.seed > 50) { c.fillStyle = '#ff2d95'; c.fillRect(p.x - 3, p.y - 9, 1, 1); c.fillRect(p.x + 2, p.y - 10, 1, 1); }
    } else if (p.type === 'scooter') {
      c.fillStyle = 'rgba(8,6,16,.25)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 1, 8, 2.5, 0, 0, TAU); c.fill();
      c.fillStyle = '#16141d'; c.fillRect(p.x - 7, p.y - 3, 3, 3); c.fillRect(p.x + 4, p.y - 3, 3, 3);
      c.fillStyle = p.color; c.fillRect(p.x - 5, p.y - 6, 10, 4);
      c.fillStyle = '#d8d1c2'; c.fillRect(p.x - 3, p.y - 8, 6, 2);
      c.fillStyle = '#3a3444'; c.fillRect(p.x + 3, p.y - 10, 2, 5);
      c.fillStyle = '#ffe6a3'; c.fillRect(p.x + 4, p.y - 11, 3, 2);
    } else if (p.type === 'cone') {
      c.fillStyle = 'rgba(8,6,16,.2)'; c.beginPath(); c.ellipse(p.x + 1, p.y + 1, 4, 1.5, 0, 0, TAU); c.fill();
      c.fillStyle = '#ff8a2b'; c.beginPath(); c.moveTo(p.x, p.y - 9); c.lineTo(p.x + 4, p.y); c.lineTo(p.x - 4, p.y); c.closePath(); c.fill();
      c.fillStyle = '#f3f0e6'; c.fillRect(p.x - 2, p.y - 5, 4, 2);
    } else if (p.type === 'barrier') {
      c.fillStyle = 'rgba(8,6,16,.22)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 1, 10, 2.5, 0, 0, TAU); c.fill();
      c.fillStyle = '#5b5f6a'; c.fillRect(p.x - 8, p.y - 2, 2, 3); c.fillRect(p.x + 6, p.y - 2, 2, 3);
      c.fillStyle = '#d8d1c2'; c.fillRect(p.x - 10, p.y - 8, 20, 6);
      for (let i = 0; i < 20; i += 6) { c.fillStyle = '#ff3b3b'; c.fillRect(p.x - 10 + i, p.y - 8, 3, 6); }
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(p.x - 10, p.y - 8, 20, 1);
    } else if (p.type === 'stall') {
      c.fillStyle = 'rgba(8,6,16,.26)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 1, 12, 3.5, 0, 0, TAU); c.fill();
      c.fillStyle = '#5a3a22'; c.fillRect(p.x - 10, p.y - 7, 20, 7);
      c.fillStyle = '#7a5230'; c.fillRect(p.x - 10, p.y - 7, 20, 2);
      // awning
      c.fillStyle = p.color; c.fillRect(p.x - 12, p.y - 18, 24, 5);
      c.fillStyle = 'rgba(255,255,255,.55)';
      for (let i = 0; i < 24; i += 8) c.fillRect(p.x - 12 + i, p.y - 18, 4, 5);
      c.fillStyle = '#3a2a1a';
      for (let i = 0; i < 4; i++) c.fillRect(p.x - 11 + i * 7, p.y - 13, 2, 6);
      c.fillStyle = '#ffd166'; c.fillRect(p.x - 4, p.y - 10, 3, 2); c.fillRect(p.x + 2, p.y - 10, 3, 2);
      c.fillStyle = '#4ade80'; c.fillRect(p.x - 1, p.y - 11, 2, 2);
      if (p.seed > 5) { c.fillStyle = '#ff2d95'; c.fillRect(p.x + 6, p.y - 9, 2, 1); }
    } else if (p.type === 'gazebo') {
      c.fillStyle = 'rgba(8,6,16,.25)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 1, 14, 4, 0, 0, TAU); c.fill();
      c.fillStyle = '#d8d1c2'; c.fillRect(p.x - 12, p.y - 6, 24, 4);
      c.fillStyle = '#b9b0a0'; c.fillRect(p.x - 12, p.y - 2, 24, 2);
      c.fillStyle = '#f3f0e6';
      c.beginPath(); c.moveTo(p.x, p.y - 24); c.lineTo(p.x + 15, p.y - 8); c.lineTo(p.x - 15, p.y - 8); c.closePath(); c.fill();
      c.fillStyle = '#e2dccd';
      for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(p.x, p.y - 24); c.lineTo(p.x + i * 9, p.y - 8); c.lineTo(p.x + i * 9 + 4, p.y - 8); c.closePath(); c.fill(); }
      c.fillStyle = '#8a7f70'; c.fillRect(p.x - 11, p.y - 8, 2, 6); c.fillRect(p.x + 9, p.y - 8, 2, 6);
      c.fillStyle = '#ffd166'; c.fillRect(p.x - 1, p.y - 26, 2, 2);
    } else if (p.type === 'tiki') {
      c.fillStyle = 'rgba(8,6,16,.25)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 1, 11, 3, 0, 0, TAU); c.fill();
      c.fillStyle = '#7a5230'; c.fillRect(p.x - 9, p.y - 6, 2, 6); c.fillRect(p.x + 7, p.y - 6, 2, 6);
      c.fillStyle = '#5a3a22'; c.fillRect(p.x - 8, p.y - 9, 16, 4);
      c.fillStyle = '#c9a06a';
      c.beginPath(); c.moveTo(p.x - 12, p.y - 9); c.lineTo(p.x, p.y - 22); c.lineTo(p.x + 12, p.y - 9); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(90,58,34,.5)'; c.lineWidth = 1;
      for (let i = -8; i <= 8; i += 4) { c.beginPath(); c.moveTo(p.x, p.y - 21); c.lineTo(p.x + i, p.y - 9); c.stroke(); }
      c.fillStyle = '#ff8a2b'; c.fillRect(p.x - 11, p.y - 12, 2, 3); c.fillRect(p.x + 9, p.y - 12, 2, 3);
      c.fillStyle = '#ffd166'; c.fillRect(p.x - 11, p.y - 13, 2, 1); c.fillRect(p.x + 9, p.y - 13, 2, 1);
    } else if (p.type === 'lifeguard') {
      c.fillStyle = 'rgba(8,6,16,.25)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 1, 12, 3.5, 0, 0, TAU); c.fill();
      c.fillStyle = '#8a6a45'; c.fillRect(p.x - 9, p.y - 4, 2, 4); c.fillRect(p.x + 7, p.y - 4, 2, 4);
      c.fillStyle = '#f3f0e6'; c.fillRect(p.x - 11, p.y - 14, 22, 10);
      c.fillStyle = '#ff3b3b'; c.fillRect(p.x - 11, p.y - 14, 22, 3);
      c.fillStyle = '#24e0ff'; c.fillRect(p.x - 7, p.y - 10, 5, 4);
      c.fillStyle = '#8a6a45'; c.fillRect(p.x - 1, p.y - 4, 2, 4);
      c.fillStyle = '#d8d1c2'; c.fillRect(p.x - 1, p.y - 24, 2, 10);
      c.fillStyle = '#ff3b3b'; c.beginPath(); c.moveTo(p.x + 1, p.y - 24); c.lineTo(p.x + 8, p.y - 21); c.lineTo(p.x + 1, p.y - 18); c.closePath(); c.fill();
    } else if (p.type === 'towel') {
      c.save(); c.translate(p.x, p.y); c.rotate((hash2(p.x, p.y) - .5) * .5);
      c.fillStyle = 'rgba(8,6,16,.14)'; c.fillRect(-7, -2, 16, 8);
      c.fillStyle = p.color; c.fillRect(-8, -3, 16, 8);
      c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-8, -1, 16, 1); c.fillRect(-8, 2, 16, 1);
      c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(-8, -3, 16, 1);
      c.restore();
    } else if (p.type === 'skateRamp') {
      c.fillStyle = 'rgba(8,6,16,.22)'; c.beginPath(); c.ellipse(p.x + 3, p.y + 2, 15, 4, 0, 0, TAU); c.fill();
      c.fillStyle = '#7c7a84'; c.beginPath();
      if (p.flip) { c.moveTo(p.x - 14, p.y); c.lineTo(p.x + 14, p.y); c.lineTo(p.x + 14, p.y - 12); c.closePath(); }
      else { c.moveTo(p.x - 14, p.y); c.lineTo(p.x + 14, p.y); c.lineTo(p.x - 14, p.y - 12); c.closePath(); }
      c.fill();
      c.fillStyle = '#9b98a3'; c.fillRect(p.x - 14, p.y - 3, 28, 3);
      c.strokeStyle = 'rgba(40,40,50,.4)'; c.lineWidth = 1;
      for (let i = -10; i <= 10; i += 5) { c.beginPath(); c.moveTo(p.x + i, p.y - 1); c.lineTo(p.x + i, p.y - 5); c.stroke(); }
      c.fillStyle = '#ffd166'; c.fillRect(p.x - 2, p.y - 13, 4, 2);
    } else if (p.type === 'rail') {
      const w = p.w || 40;
      c.fillStyle = 'rgba(8,6,16,.2)'; c.fillRect(p.x - w / 2 + 2, p.y + 1, w, 3);
      c.fillStyle = '#6b6f7c'; c.fillRect(p.x - w / 2, p.y - 8, 2, 8); c.fillRect(p.x + w / 2 - 2, p.y - 8, 2, 8);
      c.fillStyle = '#b9bec7'; c.fillRect(p.x - w / 2, p.y - 9, w, 2);
      c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(p.x - w / 2, p.y - 9, w, 1);
    } else if (p.type === 'crane') {
      c.fillStyle = 'rgba(8,6,16,.3)'; c.beginPath(); c.ellipse(p.x + 4, p.y + 2, 16, 5, 0, 0, TAU); c.fill();
      // base
      c.fillStyle = '#4a4a52'; c.fillRect(p.x - 9, p.y - 6, 18, 6);
      c.fillStyle = '#5f5f68'; c.fillRect(p.x - 7, p.y - 8, 14, 2);
      // mast
      c.fillStyle = '#ffd166';
      for (let i = 0; i < 78; i += 6) {
        c.fillRect(p.x - 3, p.y - 8 - i, 6, 2);
        c.fillRect(p.x - 3, p.y - 8 - i, 2, 6);
      }
      // jib
      c.fillRect(p.x - 2, p.y - 86, 54, 3);
      c.fillRect(p.x - 30, p.y - 86, 32, 3);
      c.fillStyle = '#b98a2f'; c.fillRect(p.x - 2, p.y - 89, 54, 1);
      // counterweight
      c.fillStyle = '#3a3a42'; c.fillRect(p.x - 30, p.y - 92, 8, 8);
      // cable + hook
      c.strokeStyle = 'rgba(230,230,240,.55)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(p.x + 44, p.y - 83); c.lineTo(p.x + 44, p.y - 40); c.stroke();
      c.fillStyle = '#ff8a2b'; c.fillRect(p.x + 42, p.y - 40, 5, 4);
      c.fillStyle = '#ff3b3b'; c.fillRect(p.x - 3, p.y - 89, 2, 2);
    } else if (p.type === 'driveScreen') {
      c.fillStyle = 'rgba(8,6,16,.32)'; c.beginPath(); c.ellipse(p.x + 4, p.y + 2, 28, 6, 0, 0, TAU); c.fill();
      c.fillStyle = '#2a2633'; c.fillRect(p.x - 26, p.y - 54, 52, 30);
      c.fillStyle = '#101018'; c.fillRect(p.x - 24, p.y - 52, 48, 26);
      // pixel art on screen
      c.fillStyle = '#ff2d95'; c.fillRect(p.x - 18, p.y - 46, 12, 8);
      c.fillStyle = '#ffd166'; c.fillRect(p.x - 4, p.y - 46, 8, 8);
      c.fillStyle = '#24e0ff'; c.fillRect(p.x + 6, p.y - 46, 12, 8);
      c.fillStyle = '#3b2a4a'; c.fillRect(p.x - 20, p.y - 36, 40, 6);
      c.fillStyle = '#ff2d95'; c.fillRect(p.x - 20, p.y - 56, 40, 2);
      c.strokeStyle = 'rgba(255,45,149,.55)'; c.lineWidth = 1; c.strokeRect(p.x - 26, p.y - 54, 52, 30);
      c.fillStyle = '#4a4652'; c.fillRect(p.x - 20, p.y - 24, 3, 24); c.fillRect(p.x + 17, p.y - 24, 3, 24);
      c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(p.x - 24, p.y - 52, 48, 1);
    } else if (p.type === 'lighthouse') {
      c.fillStyle = 'rgba(8,6,16,.28)'; c.beginPath(); c.ellipse(p.x + 4, p.y + 2, 14, 5, 0, 0, TAU); c.fill();
      // tower
      c.fillStyle = '#f3f0e6'; c.beginPath();
      c.moveTo(p.x - 7, p.y); c.lineTo(p.x - 4, p.y - 44); c.lineTo(p.x + 4, p.y - 44); c.lineTo(p.x + 7, p.y); c.closePath(); c.fill();
      c.fillStyle = '#ff3b3b';
      for (let i = 0; i < 3; i++) {
        const yy = p.y - 8 - i * 12, hw = 7 - (i * 12 / 44) * 3;
        c.fillRect(p.x - hw, yy, hw * 2, 5);
      }
      c.fillStyle = '#d8d1c2'; c.fillRect(p.x - 6, p.y - 46, 12, 3);
      c.fillStyle = '#2a2633'; c.fillRect(p.x - 5, p.y - 55, 10, 9);
      c.fillStyle = '#ffe6a3'; c.fillRect(p.x - 3, p.y - 53, 6, 5);
      c.fillStyle = '#2a2633'; c.beginPath(); c.moveTo(p.x - 7, p.y - 55); c.lineTo(p.x, p.y - 60); c.lineTo(p.x + 7, p.y - 55); c.closePath(); c.fill();
      c.fillStyle = '#ff3b3b'; c.fillRect(p.x - 1, p.y - 62, 2, 2);
      // light beams
      c.fillStyle = 'rgba(255,240,190,.10)';
      c.beginPath(); c.moveTo(p.x, p.y - 50); c.lineTo(p.x - 30, p.y - 62); c.lineTo(p.x - 30, p.y - 44); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(p.x, p.y - 50); c.lineTo(p.x + 30, p.y - 62); c.lineTo(p.x + 30, p.y - 44); c.closePath(); c.fill();
      c.fillStyle = '#4a4652'; c.fillRect(p.x - 5, p.y - 3, 10, 3);
    } else if (p.type === 'canopy') {
      const w = p.w || 80, h = p.h || 34;
      c.fillStyle = 'rgba(8,6,16,.25)'; c.fillRect(p.x - w / 2 + 4, p.y + 3, w, h);
      c.fillStyle = '#4a4652';
      c.fillRect(p.x - w / 2 + 4, p.y - 6, 4, 8); c.fillRect(p.x + w / 2 - 8, p.y - 6, 4, 8);
      c.fillStyle = '#f3f0e6'; c.fillRect(p.x - w / 2, p.y - 12, w, 8);
      c.fillStyle = '#ff3b3b'; c.fillRect(p.x - w / 2, p.y - 12, w, 2);
      c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(p.x - w / 2, p.y - 4, w, 1);
      c.fillStyle = '#4ade80'; c.fillRect(p.x - w / 2 + 2, p.y - 6, w - 4, 2);
      c.fillStyle = 'rgba(255,255,255,.6)';
      for (let i = 0; i < w; i += 12) c.fillRect(p.x - w / 2 + i, p.y - 10, 6, 1);
    } else if (p.type === 'pump') {
      c.fillStyle = 'rgba(8,6,16,.22)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 1, 6, 2, 0, 0, TAU); c.fill();
      c.fillStyle = '#d8d1c2'; c.fillRect(p.x - 4, p.y - 12, 8, 12);
      c.fillStyle = '#4ade80'; c.fillRect(p.x - 4, p.y - 12, 8, 3);
      c.fillStyle = '#1d2528'; c.fillRect(p.x - 2, p.y - 8, 4, 3);
      c.fillStyle = '#ffd166'; c.fillRect(p.x - 2, p.y - 7, 3, 1);
      c.strokeStyle = '#2a2633'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(p.x + 4, p.y - 10); c.quadraticCurveTo(p.x + 8, p.y - 6, p.x + 6, p.y - 2); c.stroke();
    } else if (p.type === 'radioTower') {
      c.fillStyle = 'rgba(8,6,16,.28)'; c.beginPath(); c.ellipse(p.x + 3, p.y + 2, 15, 5, 0, 0, TAU); c.fill();
      c.strokeStyle = '#b9bec7'; c.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const hw = 12 - i * 2.5;
        c.beginPath(); c.moveTo(p.x - hw, p.y - i * 20); c.lineTo(p.x + hw, p.y - i * 20); c.stroke();
        c.beginPath(); c.moveTo(p.x - hw, p.y - i * 20); c.lineTo(p.x + hw - 4, p.y - (i + 1) * 20); c.stroke();
        c.beginPath(); c.moveTo(p.x + hw, p.y - i * 20); c.lineTo(p.x - hw + 4, p.y - (i + 1) * 20); c.stroke();
      }
      c.beginPath(); c.moveTo(p.x - 2, p.y - 80); c.lineTo(p.x, p.y - 94); c.lineTo(p.x + 2, p.y - 80); c.stroke();
      c.fillStyle = '#ff3b3b'; c.fillRect(p.x - 1, p.y - 96, 2, 2);
      c.fillStyle = '#4a4652'; c.fillRect(p.x - 10, p.y - 2, 20, 2);
    } else if (p.type === 'ferris') {
      const R = 34;
      c.fillStyle = 'rgba(8,6,16,.28)'; c.beginPath(); c.ellipse(p.x + 4, p.y + 2, 16, 5, 0, 0, TAU); c.fill();
      // supports
      c.strokeStyle = '#6b6f7c'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(p.x - 12, p.y); c.lineTo(p.x, p.y - 36); c.lineTo(p.x + 12, p.y); c.stroke();
      c.strokeStyle = 'rgba(36,224,255,.7)'; c.lineWidth = 2;
      c.beginPath(); c.arc(p.x, p.y - 40, R, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,45,149,.55)'; c.lineWidth = 1;
      c.beginPath(); c.arc(p.x, p.y - 40, R - 4, 0, TAU); c.stroke();
      // spokes
      c.strokeStyle = 'rgba(220,225,240,.35)'; c.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        c.beginPath(); c.moveTo(p.x, p.y - 40); c.lineTo(p.x + Math.cos(a) * R, p.y - 40 + Math.sin(a) * R); c.stroke();
      }
      // gondolas
      const cols = ['#ff2d95', '#24e0ff', '#ffd166', '#4ade80', '#b98cff'];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + .3;
        const gx = p.x + Math.cos(a) * R, gy = p.y - 40 + Math.sin(a) * R;
        c.fillStyle = cols[i % cols.length]; c.fillRect(gx - 2, gy + 1, 5, 4);
        c.fillStyle = '#2a2633'; c.fillRect(gx - 1, gy, 3, 1);
      }
      c.fillStyle = '#ffe6a3'; c.fillRect(p.x - 2, p.y - 42, 4, 4);
    } else if (p.type === 'floodlight') {
      c.fillStyle = 'rgba(8,6,16,.25)'; c.beginPath(); c.ellipse(p.x + 2, p.y + 1, 5, 2, 0, 0, TAU); c.fill();
      c.fillStyle = '#5b5b6a'; c.fillRect(p.x - 1, p.y - 34, 2, 34);
      c.fillStyle = '#2a2633'; c.fillRect(p.x - 7, p.y - 38, 14, 6);
      c.fillStyle = '#ffe6a3'; c.fillRect(p.x - 6, p.y - 37, 4, 3); c.fillRect(p.x + 2, p.y - 37, 4, 3);
      c.fillStyle = '#ffd166'; c.fillRect(p.x - 1, p.y - 30, 2, 2);
    } else if (p.type === 'net') {
      const w = p.w || 50, h = p.h || 28;
      c.fillStyle = 'rgba(8,6,16,.2)'; c.fillRect(p.x - w / 2 + 2, p.y + 1, w, 3);
      c.fillStyle = '#6b6f7c'; c.fillRect(p.x - w / 2, p.y - 16, 2, 16); c.fillRect(p.x + w / 2 - 2, p.y - 16, 2, 16);
      c.fillStyle = 'rgba(240,240,245,.55)'; c.fillRect(p.x - w / 2, p.y - 16, w, 1);
      c.strokeStyle = 'rgba(240,240,245,.22)'; c.lineWidth = 1;
      for (let i = -w / 2; i <= w / 2; i += 4) { c.beginPath(); c.moveTo(p.x + i, p.y - 15); c.lineTo(p.x + i, p.y - 6); c.stroke(); }
      for (let i = 0; i < h; i += 4) { c.beginPath(); c.moveTo(p.x - w / 2, p.y - 15 + i); c.lineTo(p.x + w / 2, p.y - 15 + i); c.stroke(); }
    }
  }
}

function buildNightLayer() {
  const c = nightCanvas.getContext('2d');
  c.clearRect(0, 0, WORLD_W, WORLD_H);
  for (const b of buildings) {
    const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T;
    for (let wx = x + 8; wx < x + w - 10; wx += 11) {
      if (hash2(wx, y) > .45) { c.fillStyle = 'rgba(255,222,150,.65)'; c.fillRect(wx, y + h - 9, 6, 5); }
    }
    for (let wy = y + 9; wy < y + h - 12; wy += 12) {
      if (hash2(y, wy) > .6) { c.fillStyle = 'rgba(255,210,130,.35)'; c.fillRect(x + w - 4, wy, 2, 6); }
    }
  }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const s of signs) {
    c.save();
    c.font = '6px PressStart, monospace';
    c.fillStyle = s.color; c.shadowColor = s.color; c.shadowBlur = 10;
    c.fillText(s.text, s.x, s.y - 3.5);
    c.globalAlpha = .45; c.fillRect(s.x - 30, s.y - 8, 60, 1);
    c.restore();
  }
  for (const l of lights) {
    const g = c.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
    g.addColorStop(0, `rgba(${l.color},.35)`);
    g.addColorStop(.45, `rgba(${l.color},.13)`);
    g.addColorStop(1, `rgba(${l.color},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(l.x, l.y, l.r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,240,200,.9)'; c.fillRect(l.x - 3, l.y - 4, 6, 3);
  }
  for (const g of glows) {
    const gr = c.createRadialGradient(g.x, g.y, 2, g.x, g.y, g.r);
    gr.addColorStop(0, `rgba(${g.color},${g.a})`);
    gr.addColorStop(.5, `rgba(${g.color},${g.a * .35})`);
    gr.addColorStop(1, `rgba(${g.color},0)`);
    c.fillStyle = gr; c.beginPath(); c.arc(g.x, g.y, g.r, 0, TAU); c.fill();
  }
  // beach string lights
  for (let y = 6 * T; y < 98 * T; y += 9 * T) {
    for (let i = 0; i < 5; i++) {
      const bx = (100.6 + i * .5) * T, by = y + Math.sin(i * 1.4) * 6;
      c.fillStyle = 'rgba(255,232,168,.75)';
      c.fillRect(bx, by, 2, 2);
    }
  }
  // warm spill from shop fronts
  for (const b of buildings) {
    if (!b.name) continue;
    const bx = (b.x + b.w / 2) * T, by = (b.y + b.h) * T;
    const g = c.createRadialGradient(bx, by, 2, bx, by, 46);
    g.addColorStop(0, 'rgba(255,209,120,.18)');
    g.addColorStop(1, 'rgba(255,209,120,0)');
    c.fillStyle = g; c.beginPath(); c.arc(bx, by, 46, 0, TAU); c.fill();
  }
  c.save(); c.shadowBlur = 26; c.shadowColor = '#ff2d95';
  c.fillStyle = 'rgba(255,45,149,.35)'; c.fillRect(15 * T, 38 * T, 10 * T, 5);
  c.restore();
}

function buildMinimap() {
  const c = minimapCanvas.getContext('2d');
  c.clearRect(0, 0, MW * 2, MH * 2);
  for (let ty = 0; ty < MH; ty++) {
    for (let tx = 0; tx < MW; tx++) {
      const t = tileAt(tx, ty);
      let col = '#1b2a2c';
      if (t === TILE.WATER) col = '#174c66';
      else if (t === TILE.SAND) col = '#c9ac74';
      else if (t === TILE.GRASS) col = '#2c5937';
      else if (t === TILE.PARK) col = '#2f633d';
      else if (t === TILE.ROAD) col = '#555767';
      else if (t === TILE.SIDEWALK) col = '#8b877f';
      else if (t === TILE.BUILDING) col = '#17151f';
      else if (t === TILE.PARKING) col = '#3d3e4a';
      else if (t === TILE.PLAZA) col = '#8d7373';
      else if (t === TILE.BOARDWALK) col = '#8b603d';
      else if (t === TILE.PIER) col = '#70452a';
      c.fillStyle = col; c.fillRect(tx * 2, ty * 2, 2, 2);
    }
  }
  for (const key of ['club', 'brief', 'garage', 'marina', 'helipad']) {
    const m = landmarks[key];
    c.fillStyle = '#ffd166';
    c.fillRect((m.x / T) * 2 - 2, (m.y / T) * 2 - 2, 4, 4);
  }
  for (const p of pois) {
    const mx = (p.x / T) * 2, my = (p.y / T) * 2;
    c.fillStyle = '#0b0a12'; c.fillRect(mx - 3, my - 3, 6, 6);
    c.fillStyle = p.color; c.fillRect(mx - 2, my - 2, 4, 4);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(mx - 2, my - 2, 2, 1);
  }
}

function buildWorld() {
  generateWorld();
  const c = worldCanvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  drawGround(c); drawSpecials(c); drawBuildings(c); drawSigns(c); drawProps(c);
  buildNightLayer(); buildMinimap();
}

/* ============================================================
   DOM / canvas
   ============================================================ */
const $ = sel => document.querySelector(sel);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const radarCanvas = $('#radar');
const radarCtx = radarCanvas.getContext('2d');
radarCtx.imageSmoothingEnabled = false;
const phoneMapCanvas = $('#phoneMap');
const phoneMapCtx = phoneMapCanvas.getContext('2d');
phoneMapCtx.imageSmoothingEnabled = false;
const portraitCanvas = $('#portrait');
const portraitCtx = portraitCanvas.getContext('2d');
portraitCtx.imageSmoothingEnabled = false;

/* ============================================================
   Game state
   ============================================================ */
const game = {
  mode: 'title',          // title | cutscene | play | paused | phone | wasted | victory
  time: 0,
  tod: 0.70,
  freeze: false,
  dialogue: null,
  marker: null,
  stage: 0,
  missionCooldown: 0,
  missionDone: false,
  freeRoam: false,
  crimeTimer: 0,
  policeSpawn: 0,
  footSpawn: 0,
  ambush: false,
  gangTotal: 0,
  heli: null,
  stats: { kills: 0, copKills: 0, cashEarned: 0, distance: 0, startTime: 0, shots: 0 },
  best: 0,
  toastId: 0,
  phoneOpen: false,
  lastHud: '',
  titleTime: 0,
  cutsceneTime: 0,
  started: false,
  wastedReason: ''
};

const player = {
  x: landmarks.spawn.x,
  y: landmarks.spawn.y,
  angle: -Math.PI / 2,
  health: 100,
  maxHealth: 100,
  armor: 0,
  cash: 0,
  wanted: 0,
  weapon: 'pistol',
  mag: 12,
  magSize: 12,
  reserve: 96,
  fireCooldown: 0,
  reloadTimer: 0,
  inCar: null,
  hasCase: false,
  walkPhase: 0,
  moving: false,
  invuln: 0,
  damageFlash: 0,
  lastDamage: 99,
  kills: 0
};

const cam = { x: 0, y: 0, shake: 0, shakeX: 0, shakeY: 0 };

let vehicles = [];
let npcs = [];
let bullets = [];
let particles = [];
let pickups = [];
let corpses = [];
let timeAcc = 0;

/* ============================================================
   Audio — tiny synthwave engine + SFX, no files needed
   ============================================================ */
const audio = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  muted: false,
  noiseBuf: null,
  musicStarted: false,
  nextNote: 0,
  step: 0,
  timer: null,
  sirenOsc: null,
  sirenGain: null,
  sirenLfo: null,
  engineOsc: null,
  engineOsc2: null,
  engineGain: null,
  engineFilter: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.62;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.master);
      const len = Math.floor(this.ctx.sampleRate * 1);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.62, this.ctx.currentTime, 0.03);
    const b1 = $('#btnMute'), b2 = $('#muteBtn2');
    if (b1) b1.textContent = m ? '×' : '♪';
    if (b2) b2.textContent = 'SOM: ' + (m ? 'DESLIGADO' : 'LIGADO');
  },

  tone(freq, when, dur, type = 'sine', vol = 0.1, dest = null, slide = null, filterFreq = null) {
    if (!this.ctx) return;
    const t = when ?? this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filterFreq) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filterFreq;
      o.connect(f); node = f;
    }
    node.connect(g).connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  },

  noise(dur = 0.1, vol = 0.1, filter = 'highpass', freq = 1000, when = null, dest = null) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = when ?? this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filter; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest || this.sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  },

  shoot(weapon = 'pistol') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (weapon === 'smg') {
      this.noise(0.055, 0.16, 'highpass', 900, t);
      this.tone(210, t, 0.06, 'square', 0.07, this.sfxGain, 80, 1200);
    } else {
      this.noise(0.09, 0.26, 'highpass', 600, t);
      this.tone(160, t, 0.09, 'square', 0.12, this.sfxGain, 55, 900);
    }
  },
  explosion() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(0.6, 0.42, 'lowpass', 620, t);
    this.tone(95, t, 0.55, 'sine', 0.28, this.sfxGain, 28);
    this.tone(58, t + 0.03, 0.5, 'triangle', 0.18, this.sfxGain, 20);
  },
  hit() { this.noise(0.05, 0.13, 'highpass', 1600); },
  hurt() { this.tone(120, null, 0.12, 'sawtooth', 0.12, this.sfxGain, 60); },
  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(880, t, 0.09, 'square', 0.06);
    this.tone(1320, t + 0.07, 0.14, 'square', 0.05);
  },
  cash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(1046, t, 0.07, 'triangle', 0.06);
    this.tone(1568, t + 0.06, 0.12, 'triangle', 0.05);
  },
  reload() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(0.04, 0.1, 'highpass', 2200, t);
    this.noise(0.05, 0.09, 'highpass', 1700, t + 0.18);
  },
  ui() { this.tone(660, null, 0.05, 'square', 0.04); },
  win() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * 0.12, 0.3, 'triangle', 0.09));
  },
  lose() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [330, 262, 196, 130].forEach((f, i) => this.tone(f, t + i * 0.16, 0.4, 'sawtooth', 0.07, this.sfxGain, f * .7, 500));
  },

  startMusic() {
    if (!this.ctx || this.musicStarted) return;
    this.musicStarted = true;
    this.nextNote = this.ctx.currentTime + 0.12;
    this.step = 0;
    this.timer = setInterval(() => this.schedule(), 60);
  },

  schedule() {
    if (!this.ctx) return;
    while (this.nextNote < this.ctx.currentTime + 0.28) {
      this.playStep(this.step, this.nextNote);
      this.nextNote += 0.15;
      this.step = (this.step + 1) % 64;
    }
  },

  playStep(step, t) {
    if (this.muted) return;
    const bar = Math.floor(step / 16);
    const roots = [110, 87.31, 130.81, 98];
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [261.63, 329.63, 392],
      [196, 246.94, 293.66]
    ];
    const root = roots[bar];
    const s = step % 16;
    // kick
    if (s === 0 || s === 8) this.tone(130, t, 0.18, 'sine', 0.24, this.musicGain, 42);
    // snare
    if (s === 4 || s === 12) this.noise(0.12, 0.09, 'highpass', 1400, t, this.musicGain);
    // hats
    if (s % 2 === 1) this.noise(0.025, 0.035, 'highpass', 6200, t, this.musicGain);
    // bass
    if (s % 4 === 0) {
      const bassNotes = [0, 0, 12, 7];
      this.tone(root * Math.pow(2, bassNotes[(s / 4) | 0] / 12), t, 0.3, 'square', 0.055, this.musicGain, null, 420);
    }
    // pad
    if (s === 0) {
      for (const n of chords[bar]) this.tone(n, t, 2.2, 'triangle', 0.022, this.musicGain, null, 900);
    }
    // arp
    if (s % 2 === 0) {
      const arp = [0, 7, 12, 15, 12, 7, 3, 7];
      const n = chords[bar][(s / 2) % 3] * 2 * Math.pow(2, arp[(s / 2) % 8] / 12);
      this.tone(n, t + 0.01, 0.11, 'square', 0.012, this.musicGain, null, 2800);
    }
  },

  sirenOn() {
    if (!this.ctx || this.sirenOsc) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 720;
    g.gain.value = 0.018;
    lfo.type = 'sine'; lfo.frequency.value = 0.75;
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain).connect(o.frequency);
    o.connect(g).connect(this.sfxGain);
    o.start(); lfo.start();
    this.sirenOsc = o; this.sirenGain = g; this.sirenLfo = lfo;
  },
  sirenOff() {
    if (!this.sirenOsc) return;
    try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
    this.sirenOsc = null; this.sirenGain = null; this.sirenLfo = null;
  },
  engineOn() {
    if (!this.ctx || this.engineOsc) return;
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = 55; o2.frequency.value = 82;
    f.type = 'lowpass'; f.frequency.value = 420;
    g.gain.value = 0.025;
    o.connect(f); o2.connect(f); f.connect(g).connect(this.sfxGain);
    o.start(); o2.start();
    this.engineOsc = o; this.engineOsc2 = o2; this.engineGain = g; this.engineFilter = f;
  },
  engineUpdate(speed) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    const rpm = 45 + Math.min(230, Math.abs(speed)) * 0.62;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 1.51, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + Math.abs(speed) * 3.2, t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.016 + Math.min(0.03, Math.abs(speed) * 0.00018), t, 0.1);
  },
  engineOff() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); this.engineOsc2.stop(); } catch (e) {}
    this.engineOsc = null; this.engineOsc2 = null; this.engineGain = null; this.engineFilter = null;
  }
};

/* ============================================================
   Toasts / notifications
   ============================================================ */
function notify(text, cls = '') {
  const wrap = $('#toasts');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.textContent = text;
  wrap.appendChild(el);
  while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2600);
}

/* ============================================================
   Entity factories
   ============================================================ */
const CAR_COLORS = ['#ff2d95', '#24e0ff', '#ffd166', '#ff8a2b', '#b98cff', '#f3f0e6', '#4ade80', '#ff5b5b', '#38bdf8', '#f472b6'];
const PED_SHIRTS = ['#ff5fb5', '#24e0ff', '#ffd166', '#ff8a2b', '#b98cff', '#4ade80', '#f3f0e6', '#ff5b5b', '#38bdf8', '#e879f9', '#facc15'];
const PED_PANTS = ['#2b2d42', '#3f3f5a', '#1f2937', '#4a3728', '#334155', '#5b21b6'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a86b3c'];

function makeCar(x, y, angle, opts = {}) {
  const car = {
    x, y, angle,
    speed: 0,
    health: opts.health ?? 100,
    maxHealth: opts.health ?? 100,
    color: opts.color || pick(CAR_COLORS),
    w: 29, h: 14,
    driver: opts.driver ?? null,
    parked: !!opts.parked,
    police: !!opts.police,
    gang: !!opts.gang,
    wreck: false,
    ai: opts.ai || null,
    siren: false,
    steer: 0,
    throttle: 0,
    smokeTimer: 0,
    hitCooldown: 0,
    enterCooldown: 0
  };
  vehicles.push(car);
  return car;
}

function laneOffset(dir) {
  // screen coords: dir 0 right, 1 down, 2 left, 3 up. keep right-hand lane
  if (dir === 0) return { x: 0, y: 8 };
  if (dir === 1) return { x: -8, y: 0 };
  if (dir === 2) return { x: 0, y: -8 };
  return { x: 8, y: 0 };
}

function spawnTrafficCar() {
  const ix = randInt(0, 4), iy = randInt(0, 4);
  let dir = randInt(0, 3);
  const center = { x: (VCENTERS[ix] + 0.5) * T, y: (HCENTERS[iy] + 0.5) * T };
  const off = laneOffset(dir);
  const car = makeCar(center.x + off.x, center.y + off.y, 0, {
    color: pick(CAR_COLORS),
    parked: false,
    driver: 'npc'
  });
  car.ai = { mode: 'traffic', ix, iy, dir, targetX: 0, targetY: 0 };
  pickTrafficTarget(car);
  return car;
}

function pickTrafficTarget(car) {
  const ai = car.ai;
  const options = [];
  if (ai.ix < 4) options.push(0);
  if (ai.iy < 4) options.push(1);
  if (ai.ix > 0) options.push(2);
  if (ai.iy > 0) options.push(3);
  const reverse = (ai.dir + 2) % 4;
  let choices = options.filter(d => d !== reverse);
  if (!choices.length) choices = options;
  // favor going straight
  if (choices.includes(ai.dir) && Math.random() < 0.55) {
    ai.dir = ai.dir;
  } else {
    ai.dir = pick(choices);
  }
  const nix = ai.ix + (ai.dir === 0 ? 1 : ai.dir === 2 ? -1 : 0);
  const niy = ai.iy + (ai.dir === 1 ? 1 : ai.dir === 3 ? -1 : 0);
  ai.targetIx = nix; ai.targetIy = niy;
  const off = laneOffset(ai.dir);
  ai.targetX = (VCENTERS[nix] + 0.5) * T + off.x;
  ai.targetY = (HCENTERS[niy] + 0.5) * T + off.y;
}

function spawnPed(x, y, kind = 'ped') {
  const npc = {
    kind,
    x, y,
    homeX: x, homeY: y,
    angle: rand(TAU),
    speed: kind === 'cop' ? 58 : kind === 'gang' ? 72 : 28 + rand(10),
    health: kind === 'cop' ? 70 : kind === 'gang' ? 55 : 20,
    maxHealth: kind === 'cop' ? 70 : kind === 'gang' ? 55 : 20,
    dead: false,
    deathTimer: 0,
    shirt: kind === 'cop' ? '#2d5b8f' : kind === 'gang' ? '#7d1626' : pick(PED_SHIRTS),
    pants: kind === 'cop' ? '#1b2740' : kind === 'gang' ? '#1a1014' : pick(PED_PANTS),
    skin: pick(SKINS),
    walk: rand(10),
    target: null,
    flee: 0,
    fireTimer: rand(1.2, 0.3),
    searchTimer: 0,
    hitFlash: 0,
    isCop: kind === 'cop',
    isGang: kind === 'gang'
  };
  npcs.push(npc);
  return npc;
}

function addPickup(type, x, y, amount = 0, respawn = 0) {
  pickups.push({ type, x, y, amount, respawn, timer: 0, active: true, phase: rand(TAU) });
}

function dropCash(x, y, amount) {
  addPickup('cash', x, y, amount, 0);
}
function dropAmmo(x, y, amount = 18) {
  addPickup('ammo', x, y, amount, 0);
}

function spawnWorldEntities() {
  vehicles = [];
  npcs = [];
  bullets = [];
  particles = [];
  pickups = [];
  corpses = [];

  // parked cars in lots
  for (const lot of parkingLots) {
    const n = 1 + (Math.random() < 0.55 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const tx = randInt(lot.x1 + 2, lot.x2 - 2);
      const ty = randInt(lot.y1 + 2, lot.y2 - 2);
      const x = tx * T + 8, y = ty * T + 8;
      if (!canStand(x, y, 12)) continue;
      if (vehicles.some(v => dist2(v.x, v.y, x, y) < 34)) continue;
      if (dist2(x, y, landmarks.spawn.x, landmarks.spawn.y) < 60) continue;
      makeCar(x, y, lot.dir ? Math.PI / 2 : 0, lot.police
        ? { parked: true, police: true, color: '#f3f0e6' }
        : { parked: true, color: pick(CAR_COLORS) });
    }
  }
  // parked cars on the street
  let tries = 0;
  while (vehicles.length < 18 && tries++ < 300) {
    const road = Math.random() < 0.5;
    let x, y, angle;
    if (road) {
      const r = pick(VROADS);
      x = (r[0] + 0.5) * T + 2;
      y = rand(4, MH - 4) * T;
      angle = Math.PI / 2;
    } else {
      const r = pick(HROADS);
      y = (r[0] + 0.5) * T + 2;
      x = rand(4, MW - 4) * T;
      angle = 0;
    }
    if (!canStand(x, y, 10)) continue;
    if (vehicles.some(v => dist2(v.x, v.y, x, y) < 46)) continue;
    if (dist2(x, y, landmarks.spawn.x, landmarks.spawn.y) < 50) continue;
    makeCar(x, y, angle, { parked: true, color: pick(CAR_COLORS) });
  }
  // traffic
  for (let i = 0; i < 7; i++) {
    const c = spawnTrafficCar();
    if (dist2(c.x, c.y, landmarks.spawn.x, landmarks.spawn.y) < 120) {
      c.x += 140;
    }
  }
  // pedestrians around the city and beach
  tries = 0;
  while (npcs.length < 34 && tries++ < 600) {
    const tx = randInt(2, 109);
    const ty = randInt(2, 97);
    const t = tileAt(tx, ty);
    if (t === TILE.BUILDING || t === TILE.WATER) continue;
    if (!canStand(tx * T + 8, ty * T + 8, 6)) continue;
    if (dist2(tx * T + 8, ty * T + 8, landmarks.spawn.x, landmarks.spawn.y) < 40) continue;
    spawnPed(tx * T + 8, ty * T + 8);
  }
  // beach crowd
  for (let i = 0; i < 7; i++) {
    const tx = randInt(104, 110), ty = randInt(8, 92);
    if (tileAt(tx, ty) === TILE.SAND) spawnPed(tx * T + 8, ty * T + 8);
  }
  // fixed pickups
  addPickup('health', 12.5 * T, 57.5 * T, 40, 45);
  addPickup('armor', 60.5 * T, 21.5 * T, 50, 60);
  addPickup('ammo', 57.5 * T, 21.5 * T, 24, 40);
  addPickup('health', 22 * T, 43 * T, 35, 50);
  addPickup('ammo', 26 * T, 43 * T, 18, 45);
  addPickup('cash', 106 * T, 60 * T, 120, 90);
  addPickup('health', 101.5 * T, 74.5 * T, 30, 55);
}

/* ============================================================
   Reset / start run
   ============================================================ */
function resetRun() {
  game.stage = 0;
  game.marker = null;
  game.freeze = false;
  game.dialogue = null;
  game.missionDone = false;
  game.freeRoam = false;
  game.crimeTimer = 0;
  game.policeSpawn = 0;
  game.footSpawn = 0;
  game.ambush = false;
  game.gangTotal = 0;
  game.heli = null;
  game.tod = 0.70;
  game.time = 0;
  game.stats = { kills: 0, copKills: 0, cashEarned: 0, distance: 0, startTime: 0, shots: 0 };
  game.wastedReason = '';
  player.x = landmarks.spawn.x;
  player.y = landmarks.spawn.y;
  player.angle = -Math.PI / 2;
  player.health = 100;
  player.armor = 0;
  player.cash = 0;
  player.wanted = 0;
  player.weapon = 'pistol';
  player.magSize = 12;
  player.mag = 12;
  player.reserve = 96;
  player.fireCooldown = 0;
  player.reloadTimer = 0;
  player.inCar = null;
  player.hasCase = false;
  player.walkPhase = 0;
  player.moving = false;
  player.invuln = 0;
  player.damageFlash = 0;
  player.lastDamage = 99;
  player.kills = 0;
  audio.sirenOff();
  audio.engineOff();
  spawnWorldEntities();
  cam.x = clamp(player.x - W / 2, 0, WORLD_W - W);
  cam.y = clamp(player.y - H / 2, 0, WORLD_H - H);
  cam.shake = 0;
  setStage(0);
  $('#hud').classList.remove('hidden');
  $('#touch').classList.toggle('hidden', !document.body.classList.contains('touch'));
  updateHUD(true);
}

function startGameplay() {
  game.mode = 'play';
  game.freeze = false;
  game.started = true;
  game.stats.startTime = game.time;
  $('#title').classList.add('hidden');
  $('#dialogue').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  $('#touch').classList.toggle('hidden', !document.body.classList.contains('touch'));
  audio.init();
  audio.startMusic();
  notify('BEM-VINDO A VICE CITY, RICO.', 'gold');
  setTimeout(() => { if (game.mode === 'play') notify('SIGA O MARCADOR DOURADO. TAB ABRE O CELULAR.', ''); }, 2400);
}

/* ============================================================
   Input
   ============================================================ */
const input = {
  keys: {},
  joystick: { x: 0, y: 0, active: false },
  sprint: false,
  fire: false,
  mouse: { x: W / 2, y: H / 2, down: false, inside: false },
  touch: false
};

function fitCanvas() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const aspect = W / H;
  let cw = vw, ch = vw / aspect;
  if (ch > vh) { ch = vh; cw = vh * aspect; }
  canvas.style.width = Math.floor(cw) + 'px';
  canvas.style.height = Math.floor(ch) + 'px';
  document.body.classList.toggle('portrait', vh > vw);
}
function updateRotateHint() {
  const hint = $('#rotateHint');
  if (!hint) return;
  const ingame = game.mode === 'play' || game.mode === 'cutscene' || game.mode === 'phone' || game.mode === 'paused';
  const show = document.body.classList.contains('touch') && document.body.classList.contains('portrait') && ingame;
  hint.classList.toggle('hidden', !show);
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 120));

function canvasPoint(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (clientX - r.left) * (W / r.width),
    y: (clientY - r.top) * (H / r.height)
  };
}

window.addEventListener('keydown', e => {
  const code = e.code;
  input.keys[code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(code)) e.preventDefault();

  if (code === 'Enter') {
    if (game.mode === 'title') startFromTitle();
    else if (game.dialogue) advanceDialogue();
    else if (game.mode === 'wasted') respawnPlayer();
  }
  if (code === 'Space' && game.dialogue) { advanceDialogue(); return; }
  if (code === 'Space' && game.mode === 'play' && !game.freeze) tryFire();
  if (code === 'Escape' || code === 'KeyP') togglePause();
  if (code === 'Tab') { e.preventDefault(); togglePhone(); }
  if (code === 'KeyE') toggleCar();
  if (code === 'KeyR') startReload();
  if (code === 'KeyM') toggleMute();
  if (code === 'ShiftLeft' || code === 'ShiftRight') input.sprint = true;
});
window.addEventListener('keyup', e => {
  input.keys[e.code] = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = false;
});
window.addEventListener('blur', () => {
  input.keys = {}; input.fire = false; input.mouse.down = false; input.sprint = false;
  if (game.mode === 'play' && !game.freeze) togglePause(true);
});

canvas.addEventListener('mousemove', e => {
  const p = canvasPoint(e.clientX, e.clientY);
  input.mouse.x = p.x; input.mouse.y = p.y; input.mouse.inside = true;
});
canvas.addEventListener('mouseleave', () => { input.mouse.inside = false; });
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  audio.init();
  if (game.dialogue) { advanceDialogue(); return; }
  if (game.mode === 'title') { startFromTitle(); return; }
  if (game.mode === 'play' && !game.freeze) {
    input.mouse.down = true;
    tryFire();
  }
});
window.addEventListener('mouseup', () => { input.mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

/* ----------------------------- touch controls ----------------------------- */
function setupTouch() {
  const coarse = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
  input.touch = coarse;
  if (coarse) document.body.classList.add('touch');

  const stick = $('#stick');
  const knob = $('#knob');
  let stickId = null;
  const center = () => {
    const r = stick.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
  };
  const setStick = (dx, dy, max) => {
    const len = Math.hypot(dx, dy);
    const m = Math.min(1, len / max);
    const a = Math.atan2(dy, dx);
    const nx = Math.cos(a) * m, ny = Math.sin(a) * m;
    input.joystick.x = m > 0.12 ? nx : 0;
    input.joystick.y = m > 0.12 ? ny : 0;
    input.joystick.active = m > 0.12;
    knob.style.transform = `translate(${nx * max * 0.58}px, ${ny * max * 0.58}px)`;
  };
  stick.addEventListener('pointerdown', e => {
    stickId = e.pointerId;
    stick.setPointerCapture(stickId);
    const c = center();
    setStick(e.clientX - c.x, e.clientY - c.y, c.r);
    audio.init();
  });
  stick.addEventListener('pointermove', e => {
    if (e.pointerId !== stickId) return;
    const c = center();
    setStick(e.clientX - c.x, e.clientY - c.y, c.r);
  });
  const endStick = e => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    input.joystick.x = 0; input.joystick.y = 0; input.joystick.active = false;
    knob.style.transform = 'translate(0,0)';
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  const fireBtn = $('#btnFire');
  fireBtn.addEventListener('pointerdown', e => {
    e.preventDefault(); audio.init();
    input.fire = true; tryFire();
  });
  const stopFire = e => { e.preventDefault(); input.fire = false; };
  fireBtn.addEventListener('pointerup', stopFire);
  fireBtn.addEventListener('pointercancel', stopFire);
  fireBtn.addEventListener('pointerleave', stopFire);

  const sprintBtn = $('#btnSprint');
  sprintBtn.addEventListener('pointerdown', e => { e.preventDefault(); input.sprint = true; });
  const stopSprint = e => { e.preventDefault(); input.sprint = false; };
  sprintBtn.addEventListener('pointerup', stopSprint);
  sprintBtn.addEventListener('pointercancel', stopSprint);
  sprintBtn.addEventListener('pointerleave', stopSprint);

  $('#btnCar').addEventListener('pointerdown', e => { e.preventDefault(); audio.init(); toggleCar(); });
  $('#btnPhoneTop').addEventListener('click', () => { audio.ui(); togglePhone(); });
  $('#btnPauseTop').addEventListener('click', () => { audio.ui(); togglePause(); });
  $('#btnMute').addEventListener('click', () => { audio.init(); toggleMute(); });
}

/* ============================================================
   Dialogue
   ============================================================ */
const SPEAKER_COLORS = {
  LUNA: '#ff5fb5',
  RICO: '#24e0ff',
  NARRADOR: '#ffd166',
  '???': '#ff8a2b'
};

function drawPortrait(who) {
  const c = portraitCtx;
  c.clearRect(0, 0, 40, 40);
  const luna = who === 'LUNA';
  const rico = who === 'RICO';
  c.fillStyle = luna ? '#2a0d2a' : rico ? '#07242b' : '#1a1322';
  c.fillRect(0, 0, 40, 40);
  c.fillStyle = 'rgba(255,45,149,.16)';
  c.fillRect(0, 0, 40, 4);
  if (!luna && !rico) {
    c.fillStyle = '#ffd166';
    c.font = '18px PressStart, monospace';
    c.textAlign = 'center';
    c.fillText('★', 20, 27);
    return;
  }
  const skin = luna ? '#e0ac69' : '#c68642';
  const hair = luna ? '#2a0d2a' : '#171018';
  const shirt = luna ? '#ff2d95' : '#2f7d4f';
  // shoulders
  c.fillStyle = shirt; c.fillRect(8, 28, 24, 12);
  c.fillStyle = luna ? '#7b2dff' : '#1f5b38'; c.fillRect(8, 28, 5, 12); c.fillRect(27, 28, 5, 12);
  // neck + face
  c.fillStyle = skin; c.fillRect(16, 24, 8, 5);
  c.fillRect(12, 10, 16, 16);
  // hair
  c.fillStyle = hair;
  if (luna) {
    c.fillRect(10, 6, 20, 9); c.fillRect(9, 10, 5, 17); c.fillRect(26, 10, 5, 17);
  } else {
    c.fillRect(10, 6, 20, 6); c.fillRect(10, 10, 4, 5);
    c.fillStyle = '#2f7d4f'; c.fillRect(9, 5, 22, 4);
  }
  // eyes
  c.fillStyle = '#120c16'; c.fillRect(15, 17, 3, 2); c.fillRect(22, 17, 3, 2);
  // brow / mouth
  c.fillStyle = 'rgba(80,30,20,.6)'; c.fillRect(15, 15, 4, 1); c.fillRect(21, 15, 4, 1);
  c.fillStyle = '#7a2c2c'; c.fillRect(17, 22, 6, 1);
  // earrings / chain
  if (luna) { c.fillStyle = '#ffd166'; c.fillRect(8, 20, 2, 2); c.fillRect(30, 20, 2, 2); }
  else { c.fillStyle = '#ffd166'; c.fillRect(18, 29, 4, 1); }
}

function showDialogue(lines, onDone, cinematic = false) {
  game.dialogue = {
    lines: lines.slice(),
    idx: 0,
    char: 0,
    onDone: onDone || null,
    cinematic,
    lineDone: false
  };
  game.freeze = true;
  if (cinematic) { game.mode = 'cutscene'; game.cutsceneTime = 0; }
  $('#dialogue').classList.remove('hidden');
  $('#skipCutscene').classList.toggle('hidden', !cinematic);
  showDialogueLine();
}

function showDialogueLine() {
  const d = game.dialogue;
  if (!d) return;
  const line = d.lines[d.idx];
  if (!line) { closeDialogue(); return; }
  const who = line.who || '???';
  const nameEl = $('#speakerName');
  nameEl.textContent = who;
  nameEl.style.color = SPEAKER_COLORS[who] || '#ff5fb5';
  drawPortrait(who);
  d.char = 0;
  d.lineDone = false;
  $('#dialogueText').textContent = '';
  $('#continueHint').style.opacity = '.2';
}

function updateDialogueText(dt) {
  const d = game.dialogue;
  if (!d) return;
  const line = d.lines[d.idx];
  if (!line) return;
  if (!d.lineDone) {
    d.char += dt * 46;
    if (d.char >= line.text.length) {
      d.char = line.text.length;
      d.lineDone = true;
      $('#continueHint').style.opacity = '1';
    }
    $('#dialogueText').textContent = line.text.slice(0, Math.floor(d.char));
  }
}

function advanceDialogue() {
  const d = game.dialogue;
  if (!d) return;
  const line = d.lines[d.idx];
  if (!line) { closeDialogue(); return; }
  if (!d.lineDone) {
    d.char = line.text.length;
    d.lineDone = true;
    $('#dialogueText').textContent = line.text;
    $('#continueHint').style.opacity = '1';
    audio.ui();
    return;
  }
  audio.ui();
  d.idx++;
  if (d.idx >= d.lines.length) closeDialogue();
  else showDialogueLine();
}

function closeDialogue() {
  const d = game.dialogue;
  game.dialogue = null;
  game.freeze = false;
  $('#dialogue').classList.add('hidden');
  $('#skipCutscene').classList.add('hidden');
  if (d && d.onDone) d.onDone();
}

function skipCutscene() {
  if (!game.dialogue) return;
  game.dialogue.idx = game.dialogue.lines.length;
  closeDialogue();
}

/* ============================================================
   Missions
   ============================================================ */
const MISSION_NAMES = ['O ENCONTRO', 'A MALETA', 'FUGA PARA A GARAGEM', 'ENTREGA NO IATE', 'FUGA FINAL'];
const MISSION_OBJECTIVES = [
  'Vá até o Neon Palace',
  'Pegue a maleta no píer',
  'Leve a maleta até a garagem',
  'Entregue a maleta na marina',
  'Chegue ao heliponto'
];
const MISSION_TARGETS = ['club', 'brief', 'garage', 'marina', 'helipad'];

function setStage(stage) {
  game.stage = stage;
  game.missionCooldown = 0.8;
  if (stage <= 4) {
    const t = landmarks[MISSION_TARGETS[stage]];
    game.marker = { x: t.x, y: t.y, label: MISSION_TARGETS[stage].toUpperCase(), color: '#ffd166' };
  } else {
    game.marker = null;
  }
  updateHUD(true);
  updatePhoneContent();
}

function addWanted(n) {
  const before = player.wanted;
  player.wanted = clamp(player.wanted + n, 0, 5);
  game.crimeTimer = 0;
  if (player.wanted > 0) audio.sirenOn();
  if (player.wanted > before) {
    notify(player.wanted >= 4 ? 'PROCURADO! A CIDADE INTEIRA ESTÁ ATRÁS DE VOCÊ.' : 'NÍVEL DE PROCURA AUMENTOU!', 'red');
  }
}

function clearWanted() {
  player.wanted = 0;
  game.crimeTimer = 0;
  audio.sirenOff();
  for (const v of vehicles) {
    if (v.police) v.wantedGone = true;
  }
  for (const n of npcs) {
    if (n.kind === 'cop') n.despawn = true;
  }
  if (game.heli) game.heli = null;
}

function reward(amount) {
  player.cash += amount;
  game.stats.cashEarned += amount;
  notify('+ ' + fmtMoney(amount), 'green');
  audio.cash();
}

function triggerMission() {
  if (game.freeze || game.dialogue || game.mode !== 'play' || !game.marker || game.missionCooldown > 0) return;
  const d = dist2(player.x, player.y, game.marker.x, game.marker.y);
  if (d > (player.inCar ? 44 : 27)) return;
  const stage = game.stage;
  game.marker = null;
  updateHUD(true);

  if (stage === 0) {
    showDialogue([
      { who: 'LUNA', text: 'Você demorou, Rico. A cidade já começou a falar.' },
      { who: 'RICO', text: 'Vim pelo dinheiro, não pela conversa. Cadê a maleta?' },
      { who: 'LUNA', text: 'No píer da praia. E tem gente da gangue Piranha atrás dela.' }
    ], () => {
      setStage(1);
      notify('NOVA MISSÃO: A MALETA', 'gold');
    });
  } else if (stage === 1) {
    player.hasCase = true;
    addWanted(2);
    notify('MALETA RECUPERADA · A POLÍCIA FOI AVISADA', 'red');
    audio.pickup();
    showDialogue([
      { who: 'RICO', text: 'Peguei. Pesada. Deve valer uma fortuna.' },
      { who: 'LUNA', text: 'Alguém te viu. Leva isso pra garagem no centro. AGORA.' }
    ], () => {
      setStage(2);
      notify('FUJA PARA A GARAGEM', 'gold');
    });
  } else if (stage === 2) {
    reward(2500);
    player.weapon = 'smg';
    player.magSize = 30;
    player.mag = 30;
    player.reserve = Math.max(player.reserve, 120);
    clearWanted();
    notify('SMG DESBLOQUEADA · POLÍCIA PERDEU O RASTRO', 'gold');
    showDialogue([
      { who: 'LUNA', text: 'A maleta está segura. Peguei uma SMG pra você. Presente.' },
      { who: 'RICO', text: 'Agora a marina. E depois, nunca mais me vê.' }
    ], () => {
      setStage(3);
      notify('NOVA MISSÃO: ENTREGA NO IATE', 'gold');
    });
  } else if (stage === 3) {
    reward(5000);
    player.hasCase = false;
    showDialogue([
      { who: 'LUNA', text: 'O comprador gostou. Olha o tamanho do depósito.' },
      { who: 'RICO', text: 'Ainda tem uma coisa. O chefe da gangue quer minha cabeça.' },
      { who: 'LUNA', text: 'Então vamos sumir. Heliponto no centro. Te encontro lá.' }
    ], () => {
      setStage(4);
      notify('FUGA FINAL: CHEGUE AO HELIPONTO', 'gold');
    });
  } else if (stage === 4) {
    triggerAmbush();
  }
}

function triggerAmbush() {
  if (game.ambush) return;
  game.ambush = true;
  game.stage = 5;
  game.marker = null;
  game.gangTotal = 6;
  game.missionCooldown = 1;
  addWanted(3);
  audio.sirenOn();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rand(.4, -.4);
    let x = player.x + Math.cos(a) * rand(170, 110);
    let y = player.y + Math.sin(a) * rand(170, 110);
    if (!canStand(x, y, 7)) { x = player.x + Math.cos(a) * 80; y = player.y + Math.sin(a) * 80; }
    if (!canStand(x, y, 7)) { x = player.x + rand(50, -50); y = player.y + rand(50, -50); }
    spawnPed(x, y, 'gang');
  }
  notify('EMBOSCADA! ELIMINE A GANGUE.', 'red');
  showDialogue([
    { who: '???', text: 'Achou que ia sair de Vice City vivo, Rico?' },
    { who: 'LUNA', text: 'Seis deles! Usa a SMG e não deixa ninguém chegar perto!' }
  ], () => { updateHUD(true); });
}

function checkAmbush() {
  if (!game.ambush) return;
  const alive = npcs.filter(n => n.kind === 'gang' && !n.dead).length;
  if (alive === 0) {
    game.ambush = false;
    game.missionDone = true;
    clearWanted();
    showDialogue([
      { who: 'LUNA', text: 'Acabou. O helicóptero está esperando. Vamos embora.' },
      { who: 'RICO', text: 'Vice City que se dane. Eu já estou de saída.' }
    ], () => finishVictory());
  }
}

function finishVictory() {
  game.mode = 'victory';
  game.marker = null;
  audio.sirenOff();
  audio.engineOff();
  audio.win();
  const elapsed = game.time - game.stats.startTime;
  const totalCash = player.cash;
  const best = Math.max(totalCash, Number(localStorage.getItem('pixelViceBest') || 0));
  localStorage.setItem('pixelViceBest', String(best));
  const stars = clamp(5 - Math.floor(elapsed / 240), 1, 5);
  $('#victoryStats').innerHTML =
    `<div><span>TEMPO</span><b>${fmtTime(elapsed)}</b></div>` +
    `<div><span>DINHEIRO</span><b>${fmtMoney(totalCash)}</b></div>` +
    `<div><span>ABATES</span><b>${game.stats.kills}</b></div>` +
    `<div><span>POLICIAIS</span><b>${game.stats.copKills}</b></div>`;
  $('#victoryStars').textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  $('#victory').classList.remove('hidden');
  $('#hud').classList.add('hidden');
  $('#touch').classList.add('hidden');
}

function startReload() {
  if (game.mode !== 'play' || game.freeze || player.inCar) return;
  if (player.reloadTimer > 0 || player.mag >= player.magSize) return;
  if (player.reserve <= 0) { notify('SEM MUNIÇÃO RESERVA', 'red'); return; }
  player.reloadTimer = player.weapon === 'smg' ? 1.35 : 1.1;
  audio.reload();
}

/* ============================================================
   Core gameplay helpers
   ============================================================ */
function startFromTitle() {
  if (game.mode !== 'title') return;
  audio.init();
  resetRun();
  $('#title').classList.add('hidden');
  $('#hud').classList.add('hidden');
  $('#touch').classList.add('hidden');
  showDialogue([
    { who: 'NARRADOR', text: 'VICE CITY · 2026. O sol se põe, o neon acende e todo mundo deve algo a alguém.' },
    { who: 'LUNA', text: 'Vice City. Neon, dinheiro e gente querendo te matar.' },
    { who: 'RICO', text: 'Só preciso pegar a maleta e sumir. Fácil.' },
    { who: 'LUNA', text: 'Nada nessa cidade é fácil. Te encontro no Neon Palace.' }
  ], () => startGameplay(), true);
}

function mouseWorld() {
  return { x: input.mouse.x + cam.x, y: input.mouse.y + cam.y };
}

function nearestHostile(radius = 260) {
  let best = null, bd = radius;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  for (const n of npcs) {
    if (n.dead || (n.kind !== 'cop' && n.kind !== 'gang')) continue;
    const d = dist2(px, py, n.x, n.y);
    if (d < bd) { bd = d; best = n; }
  }
  for (const v of vehicles) {
    if (!v.police || v.wreck) continue;
    const d = dist2(px, py, v.x, v.y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

function getAimAngle() {
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  if (input.touch || input.fire) {
    const target = nearestHostile(300);
    if (target) return Math.atan2(target.y - py, target.x - px);
    if (input.joystick.active) return Math.atan2(input.joystick.y, input.joystick.x);
    return player.angle;
  }
  if (input.mouse.inside) {
    const m = mouseWorld();
    return Math.atan2(m.y - py, m.x - px);
  }
  return player.angle;
}

function scarePeds(radius) {
  for (const n of npcs) {
    if (n.kind !== 'ped' || n.dead) continue;
    if (dist2(n.x, n.y, player.x, player.y) < radius) n.flee = Math.max(n.flee, 4.5);
  }
}

function spawnBullet(x, y, angle, speed, dmg, owner, color) {
  bullets.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1.25,
    dmg,
    owner,
    color: color || (owner === 'player' ? '#ffe6a3' : '#ff6b6b')
  });
}

function tryFire() {
  if (game.mode !== 'play' || game.freeze || game.dialogue) return;
  if (player.fireCooldown > 0 || player.reloadTimer > 0) return;
  if (player.mag <= 0) { startReload(); return; }
  const angle = getAimAngle();
  const car = player.inCar;
  const px = car ? car.x + Math.cos(angle) * 14 : player.x;
  const py = car ? car.y + Math.sin(angle) * 14 : player.y;
  const spread = player.weapon === 'smg' ? 0.085 : 0.025;
  spawnBullet(px, py, angle + rand(spread, -spread), player.weapon === 'smg' ? 720 : 640, player.weapon === 'smg' ? 15 : 26, 'player');
  player.mag--;
  player.fireCooldown = player.weapon === 'smg' ? 0.085 : 0.27;
  game.stats.shots++;
  audio.shoot(player.weapon);
  cam.shake = Math.max(cam.shake, player.weapon === 'smg' ? 1.4 : 2.4);
  scarePeds(220);
  for (let i = 0; i < 4; i++) {
    particles.push({
      x: px, y: py,
      vx: Math.cos(angle) * rand(70, 20) + rand(18, -18),
      vy: Math.sin(angle) * rand(70, 20) + rand(18, -18),
      life: rand(.16, .06), maxLife: .16,
      color: '#ffe6a3', size: 2
    });
  }
  if (player.mag <= 0) startReload();
  if (player.wanted === 0 && Math.random() < 0.18) {
    // firing a gun in public eventually gets noticed
    const copNear = npcs.some(n => n.kind === 'cop' && !n.dead && dist2(n.x, n.y, player.x, player.y) < 220);
    if (copNear) addWanted(1);
  }
}

function damagePlayer(amount, source = '') {
  if (game.mode !== 'play' || player.invuln > 0) return;
  let dmg = amount;
  if (player.armor > 0) {
    const absorb = Math.min(player.armor, dmg * 0.65);
    player.armor -= absorb;
    dmg -= absorb;
  }
  player.health -= dmg;
  player.lastDamage = 0;
  player.damageFlash = .55;
  cam.shake = Math.max(cam.shake, 4);
  audio.hurt();
  if (player.health <= 0) {
    player.health = 0;
    die(source);
  }
}

function die(reason = '') {
  if (game.mode !== 'play') return;
  game.mode = 'wasted';
  game.wastedReason = reason;
  game.freeze = false;
  audio.sirenOff();
  audio.engineOff();
  audio.lose();
  const elapsed = game.time - game.stats.startTime;
  $('#wastedStats').innerHTML =
    `<div><span>TEMPO</span><b>${fmtTime(elapsed)}</b></div>` +
    `<div><span>DINHEIRO</span><b>${fmtMoney(player.cash)}</b></div>` +
    `<div><span>ABATES</span><b>${game.stats.kills}</b></div>` +
    `<div><span>MISSÃO</span><b>${String(Math.min(game.stage + 1, 5)).padStart(2, '0')} / 05</b></div>`;
  $('#wasted').classList.remove('hidden');
  $('#hud').classList.add('hidden');
  $('#touch').classList.add('hidden');
}

function respawnPlayer() {
  if (game.mode !== 'wasted') return;
  $('#wasted').classList.add('hidden');
  game.mode = 'play';
  player.health = 100;
  player.armor = 0;
  player.cash = Math.max(0, player.cash - 500);
  player.wanted = 0;
  player.invuln = 2.5;
  player.damageFlash = 0;
  player.inCar = null;
  player.fireCooldown = 0;
  player.reloadTimer = 0;
  clearWanted();
  vehicles = vehicles.filter(v => !v.police);
  npcs = npcs.filter(n => n.kind !== 'cop' && n.kind !== 'gang');
  bullets = [];
  player.x = landmarks.spawn.x;
  player.y = landmarks.spawn.y;
  player.angle = -Math.PI / 2;
  if (game.stage === 5) {
    game.ambush = false;
    game.gangTotal = 0;
    setStage(4);
  }
  cam.x = clamp(player.x - W / 2, 0, WORLD_W - W);
  cam.y = clamp(player.y - H / 2, 0, WORLD_H - H);
  cam.shake = 0;
  $('#hud').classList.remove('hidden');
  $('#touch').classList.toggle('hidden', !document.body.classList.contains('touch'));
  notify('VOCÊ ACORDOU NO MOTEL VICE · -$500', 'red');
  updateHUD(true);
}

function damageNpc(npc, amount, byPlayer = true) {
  if (npc.dead) return;
  npc.health -= amount;
  npc.hitFlash = .18;
  if (npc.health <= 0) killNpc(npc, byPlayer);
}

function killNpc(npc, byPlayer = true) {
  if (npc.dead) return;
  npc.dead = true;
  npc.deathTimer = 0;
  npc.angle = npc.angle + Math.PI;
  if (byPlayer) {
    game.stats.kills++;
    if (npc.kind === 'cop') {
      game.stats.copKills++;
      addWanted(1);
      dropAmmo(npc.x, npc.y, 20);
    } else if (npc.kind === 'gang') {
      dropCash(npc.x, npc.y, 60 + randInt(0, 90));
      dropAmmo(npc.x, npc.y, 14);
    } else {
      addWanted(1);
      if (Math.random() < .55) dropCash(npc.x, npc.y, 15 + randInt(0, 40));
    }
  }
  for (const n of npcs) {
    if (n.kind === 'ped' && !n.dead && dist2(n.x, n.y, npc.x, npc.y) < 170) n.flee = 5;
  }
  for (let i = 0; i < 12; i++) {
    particles.push({
      x: npc.x, y: npc.y,
      vx: rand(70, -70), vy: rand(55, -55),
      life: rand(.7, .25), maxLife: .7,
      color: i < 7 ? '#a51b2d' : '#6b1420', size: rand(3, 1)
    });
  }
  audio.hit();
}

function explodeAt(x, y, radius, damage) {
  audio.explosion();
  cam.shake = Math.max(cam.shake, 10);
  for (let i = 0; i < 34; i++) {
    const a = rand(TAU), sp = rand(210, 30);
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(.9, .25), maxLife: .9,
      color: i % 3 === 0 ? '#ffd166' : i % 3 === 1 ? '#ff5b2b' : '#3b2a2a',
      size: rand(5, 2)
    });
  }
  for (const n of npcs) {
    if (n.dead) continue;
    const d = dist2(n.x, n.y, x, y);
    if (d < radius) damageNpc(n, damage * (1 - d / radius));
  }
  for (const v of vehicles) {
    if (v.wreck) continue;
    const d = dist2(v.x, v.y, x, y);
    if (d < radius) damageCar(v, damage * (1 - d / radius));
  }
  const pd = dist2(player.x, player.y, x, y);
  if (pd < radius) damagePlayer(damage * (1 - pd / radius), 'explosão');
}

function damageCar(car, amount) {
  if (car.wreck) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.wreck = true;
    car.health = 0;
    car.speed = 0;
    if (car.driver === 'player') {
      player.inCar = null;
      player.x = car.x; player.y = car.y;
      audio.engineOff();
      damagePlayer(200, 'seu carro explodiu');
    }
    explodeAt(car.x, car.y, 62, 65);
    if (car.police) addWanted(1);
  }
}

function carCanMove(x, y, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const pts = [[-14, -7], [14, -7], [-14, 7], [14, 7], [0, 0], [-14, 0], [14, 0]];
  for (const [lx, ly] of pts) {
    const wx = x + cos * lx - sin * ly;
    const wy = y + sin * lx + cos * ly;
    if (isSolidAt(wx, wy)) return false;
  }
  return true;
}

function enterNearestCar() {
  let best = null, bd = 52;
  for (const v of vehicles) {
    if (v.wreck) continue;
    const d = dist2(player.x, player.y, v.x, v.y);
    if (d < bd) { bd = d; best = v; }
  }
  if (!best) { notify('NENHUM CARRO POR PERTO', ''); return; }
  if (best.driver === 'npc') {
    spawnPed(best.x + rand(14, -14), best.y + rand(14, -14));
    const p = npcs[npcs.length - 1]; if (p) p.flee = 4;
    addWanted(1);
    notify('CARRO ROUBADO · A POLÍCIA VIU', 'red');
  }
  if (best.police) addWanted(2);
  best.driver = 'player';
  best.ai = null;
  best.speed = 0;
  player.inCar = best;
  player.x = best.x; player.y = best.y;
  player.angle = best.angle;
  audio.engineOn();
  audio.engineUpdate(0);
  notify('VEÍCULO: ' + (best.police ? 'VIATURA' : 'CARRO') + ' · E PARA SAIR', '');
  updateHUD(true);
}

function exitCar() {
  const car = player.inCar;
  if (!car) return;
  const side = Math.PI / 2;
  const offsets = [
    { x: Math.cos(car.angle + side) * 24, y: Math.sin(car.angle + side) * 24 },
    { x: Math.cos(car.angle - side) * 24, y: Math.sin(car.angle - side) * 24 },
    { x: -Math.cos(car.angle) * 30, y: -Math.sin(car.angle) * 30 }
  ];
  let spot = null;
  for (const o of offsets) {
    if (canStand(car.x + o.x, car.y + o.y, 6)) { spot = { x: car.x + o.x, y: car.y + o.y }; break; }
  }
  if (!spot) { notify('SEM ESPAÇO PARA SAIR', 'red'); return; }
  car.driver = null;
  car.speed = 0;
  car.enterCooldown = 1;
  player.inCar = null;
  player.x = spot.x;
  player.y = spot.y;
  player.angle = car.angle;
  audio.engineOff();
  updateHUD(true);
}

function toggleCar() {
  if (game.mode !== 'play' || game.freeze || game.dialogue) return;
  if (player.inCar) exitCar(); else enterNearestCar();
}

function toggleMute() {
  audio.init();
  audio.setMuted(!audio.muted);
  notify(audio.muted ? 'SOM DESLIGADO' : 'SOM LIGADO', '');
}

function togglePause(force = false) {
  if (game.mode === 'phone') { closePhone(); return; }
  if (game.mode === 'play' && !game.dialogue) {
    if (force || true) {
      game.mode = 'paused';
      $('#pause').classList.remove('hidden');
      $('#pauseMission').textContent = game.missionDone ? '05 / 05' : String(Math.min(game.stage + 1, 5)).padStart(2, '0') + ' / 05';
      $('#pauseCash').textContent = fmtMoney(player.cash);
      $('#pauseTime').textContent = fmtTime(game.time - game.stats.startTime);
      audio.ui();
      return;
    }
  }
  if (game.mode === 'paused') {
    game.mode = 'play';
    $('#pause').classList.add('hidden');
    audio.ui();
  }
}

function togglePhone() {
  if (game.mode === 'play' && !game.freeze && !game.dialogue) openPhone();
  else if (game.mode === 'phone') closePhone();
}

function openPhone() {
  if (game.mode !== 'play') return;
  game.mode = 'phone';
  $('#phone').classList.remove('hidden');
  updatePhoneContent();
  drawPhoneMap();
  audio.ui();
}

function closePhone() {
  if (game.mode !== 'phone') return;
  game.mode = 'play';
  $('#phone').classList.add('hidden');
  audio.ui();
}

/* ============================================================
   Player update
   ============================================================ */
function updatePlayer(dt) {
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.reloadTimer = Math.max(0, player.reloadTimer - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.damageFlash = Math.max(0, player.damageFlash - dt);
  player.lastDamage += dt;

  if (player.reloadTimer === 0 && player.mag < player.magSize && player.reserve > 0 && player.wantReload) {
    const need = player.magSize - player.mag;
    const take = Math.min(need, player.reserve);
    player.mag += take; player.reserve -= take;
    player.wantReload = false;
  }

  if (player.health < 70 && player.lastDamage > 9 && game.mode === 'play') {
    player.health = Math.min(70, player.health + dt * 2.2);
  }

  if (player.inCar) {
    updatePlayerCar(dt);
  } else {
    let mx = 0, my = 0;
    if (input.keys.KeyA || input.keys.ArrowLeft) mx -= 1;
    if (input.keys.KeyD || input.keys.ArrowRight) mx += 1;
    if (input.keys.KeyW || input.keys.ArrowUp) my -= 1;
    if (input.keys.KeyS || input.keys.ArrowDown) my += 1;
    if (input.joystick.active) { mx = input.joystick.x; my = input.joystick.y; }
    const len = Math.hypot(mx, my);
    if (len > 0.08) {
      mx /= len; my /= len;
      const sprint = input.sprint || input.keys.ShiftLeft || input.keys.ShiftRight;
      const speed = sprint ? 108 : 68;
      const dx = mx * speed * dt, dy = my * speed * dt;
      if (canStand(player.x + dx, player.y, 6)) player.x += dx;
      if (canStand(player.x, player.y + dy, 6)) player.y += dy;
      player.moving = true;
      player.walkPhase += dt * (sprint ? 15 : 10);
      game.stats.distance += Math.hypot(dx, dy);
      if (Math.random() < dt * 8) {
        particles.push({ x: player.x + rand(4, -4), y: player.y + 5, vx: rand(5, -5), vy: rand(0, -8), life: .3, maxLife: .3, color: 'rgba(200,190,180,.35)', size: 2 });
      }
    } else {
      player.moving = false;
    }
    // don't walk through parked cars
    for (const v of vehicles) {
      if (v === player.inCar || v.wreck) continue;
      const d = dist2(player.x, player.y, v.x, v.y);
      if (d < 17 && d > 0.1) {
        const nx = (player.x - v.x) / d, ny = (player.y - v.y) / d;
        const tx = player.x + nx * (17 - d), ty = player.y + ny * (17 - d);
        if (canStand(tx, ty, 6)) { player.x = tx; player.y = ty; }
      }
    }
    // face aim / movement
    let target = player.angle;
    if (input.touch || input.fire) {
      if (input.joystick.active) target = Math.atan2(input.joystick.y, input.joystick.x);
      if (input.fire) {
        const h = nearestHostile(300);
        if (h) target = Math.atan2(h.y - player.y, h.x - player.x);
      }
    } else if (input.mouse.inside) {
      const m = mouseWorld();
      target = Math.atan2(m.y - player.y, m.x - player.x);
    }
    player.angle = angleLerp(player.angle, target, clamp(dt * 14, 0, 1));
  }

  // continuous fire
  if ((input.mouse.down || input.fire) && !game.freeze) tryFire();

  // pickups
  for (const p of pickups) {
    if (!p.active) continue;
    if (dist2(player.x, player.y, p.x, p.y) < 17) collectPickup(p);
  }

  // mission trigger
  game.missionCooldown = Math.max(0, game.missionCooldown - dt);
  triggerMission();
}

function updatePlayerCar(dt) {
  const car = player.inCar;
  if (!car || car.wreck) { player.inCar = null; return; }
  let throttle = 0, steer = 0;
  if (input.joystick.active) {
    throttle = -input.joystick.y;
    steer = input.joystick.x;
  } else {
    if (input.keys.KeyW || input.keys.ArrowUp) throttle += 1;
    if (input.keys.KeyS || input.keys.ArrowDown) throttle -= 1;
    if (input.keys.KeyD || input.keys.ArrowRight) steer += 1;
    if (input.keys.KeyA || input.keys.ArrowLeft) steer -= 1;
  }
  const handbrake = input.keys.Space;
  if (throttle > 0) car.speed += 235 * dt;
  else if (throttle < 0) car.speed -= 300 * dt;
  else car.speed *= Math.pow(0.35, dt);
  if (handbrake) car.speed *= Math.pow(0.08, dt);
  car.speed = clamp(car.speed, -82, 212);
  const turn = 2.35 * clamp(Math.abs(car.speed) / 85, 0.1, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steer * turn * dt;
  const cos = Math.cos(car.angle), sin = Math.sin(car.angle);
  const nx = car.x + cos * car.speed * dt;
  const ny = car.y + sin * car.speed * dt;
  if (carCanMove(nx, ny, car.angle)) {
    car.x = nx; car.y = ny;
  } else if (carCanMove(nx, car.y, car.angle)) {
    car.x = nx; car.speed *= 0.72;
  } else if (carCanMove(car.x, ny, car.angle)) {
    car.y = ny; car.speed *= 0.72;
  } else {
    if (Math.abs(car.speed) > 60) {
      damageCar(car, 6);
      cam.shake = Math.max(cam.shake, 3);
    }
    car.speed *= -0.18;
  }
  if (handbrake && Math.abs(car.speed) > 70 && Math.random() < .7) {
    particles.push({
      x: car.x - cos * 12 + rand(6, -6), y: car.y - sin * 12 + rand(6, -6),
      vx: rand(8, -8), vy: rand(8, -8), life: .45, maxLife: .45,
      color: 'rgba(70,65,70,.45)', size: 3
    });
  }
  // run over pedestrians
  if (Math.abs(car.speed) > 26) {
    for (const n of npcs) {
      if (n.dead || n.kind !== 'ped') continue;
      if (dist2(car.x, car.y, n.x, n.y) < 19) {
        killNpc(n, true);
        car.speed *= .82;
        cam.shake = Math.max(cam.shake, 3);
      }
    }
  }
  // smoke
  if (car.health < 35 && Math.random() < dt * 14) {
    particles.push({
      x: car.x + rand(6, -6), y: car.y + rand(6, -6),
      vx: rand(8, -8), vy: rand(-22, -8), life: .8, maxLife: .8,
      color: car.health < 15 ? 'rgba(35,30,30,.7)' : 'rgba(90,90,95,.5)', size: 4
    });
  }
  player.x = car.x; player.y = car.y;
  game.stats.distance += Math.abs(car.speed) * dt;
  audio.engineUpdate(car.speed);
  // drive-by
  if ((input.mouse.down || input.fire) && !game.freeze) tryFire();
}

/* ============================================================
   Vehicles / police / NPC AI / bullets / pickups
   ============================================================ */
function updateTrafficCar(car, dt) {
  const ai = car.ai;
  if (!ai) return;
  const dx = ai.targetX - car.x, dy = ai.targetY - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 6) {
    ai.ix = ai.targetIx; ai.iy = ai.targetIy;
    pickTrafficTarget(car);
  }
  const targetAngle = Math.atan2(ai.targetY - car.y, ai.targetX - car.x);
  car.angle = angleLerp(car.angle, targetAngle, clamp(dt * 5, 0, 1));
  car.speed = 42;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (carCanMove(nx, ny, car.angle)) {
    car.x = nx; car.y = ny;
  } else {
    car.speed = 0;
    ai.stuck = (ai.stuck || 0) + dt;
    if (ai.stuck > .8) { ai.stuck = 0; pickTrafficTarget(car); }
  }
  // traffic nudges the player on foot, not lethal
  if (!player.inCar && dist2(car.x, car.y, player.x, player.y) < 18) {
    damagePlayer(4, 'atropelamento');
    const a = Math.atan2(player.y - car.y, player.x - car.x);
    if (canStand(player.x + Math.cos(a) * 18, player.y + Math.sin(a) * 18, 6)) {
      player.x += Math.cos(a) * 18; player.y += Math.sin(a) * 18;
    }
  }
}

function updatePoliceCar(car, dt) {
  if (car.wreck) return;
  if (car.wantedGone || player.wanted <= 0) {
    car.despawnTimer = (car.despawnTimer || 0) + dt;
    car.speed *= Math.pow(0.2, dt);
    if (car.despawnTimer > 2.5) car.removeMe = true;
    return;
  }
  const target = player.inCar ? player.inCar : player;
  const d = dist2(car.x, car.y, target.x, target.y);
  const desired = Math.atan2(target.y - car.y, target.x - car.x);
  car.angle = angleLerp(car.angle, desired, clamp(dt * 2.3, 0, 1));
  car.speed = clamp(car.speed + 180 * dt, 0, 118 + player.wanted * 8);
  if (d < 64) car.speed *= Math.pow(.25, dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (carCanMove(nx, ny, car.angle)) { car.x = nx; car.y = ny; }
  else { car.speed *= .4; }
  car.hitCooldown = Math.max(0, (car.hitCooldown || 0) - dt);
  if (d < 32 && car.hitCooldown <= 0) {
    car.hitCooldown = .9;
    if (player.inCar) damageCar(player.inCar, 9);
    else damagePlayer(9, 'viatura');
    cam.shake = Math.max(cam.shake, 3);
  }
  // police gunfire from the car
  car.fireTimer = (car.fireTimer || rand(1.6, .6)) - dt;
  if (player.wanted >= 2 && d < 245 && car.fireTimer <= 0) {
    car.fireTimer = 1.35;
    const a = Math.atan2(target.y - car.y, target.x - car.x) + rand(.08, -.08);
    spawnBullet(car.x, car.y, a, 430, 7, 'cop', '#ff6b6b');
  }
  if (car.health < 35 && Math.random() < dt * 10) {
    particles.push({ x: car.x + rand(6, -6), y: car.y + rand(6, -6), vx: rand(8, -8), vy: rand(-20, -8), life: .8, maxLife: .8, color: 'rgba(60,60,70,.6)', size: 4 });
  }
}

function moveNpc(n, dx, dy) {
  if (canStand(n.x + dx, n.y + dy, 6)) { n.x += dx; n.y += dy; return true; }
  if (canStand(n.x + dx, n.y, 6)) { n.x += dx; return true; }
  if (canStand(n.x, n.y + dy, 6)) { n.y += dy; return true; }
  return false;
}

function updatePed(n, dt) {
  n.walk += dt;
  if (n.flee > 0) {
    n.flee -= dt;
    const a = Math.atan2(n.y - player.y, n.x - player.x);
    const sp = n.speed * 1.75;
    if (!moveNpc(n, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt)) {
      n.flee = 0;
    }
    n.angle = a;
    return;
  }
  if (!n.target || dist2(n.x, n.y, n.target.x, n.target.y) < 5 || (n.targetTimer || 0) <= 0) {
    n.targetTimer = rand(4.5, 2);
    const a = rand(TAU), r = rand(46, 10);
    const tx = n.homeX + Math.cos(a) * r, ty = n.homeY + Math.sin(a) * r;
    if (canStand(tx, ty, 6)) n.target = { x: tx, y: ty };
  }
  if (n.target) {
    n.targetTimer -= dt;
    const a = Math.atan2(n.target.y - n.y, n.target.x - n.x);
    const d = dist2(n.x, n.y, n.target.x, n.target.y);
    if (d > 4) {
      if (!moveNpc(n, Math.cos(a) * n.speed * dt, Math.sin(a) * n.speed * dt)) n.target = null;
      n.angle = a;
    }
  }
}

function updateHostile(n, dt) {
  if (n.despawn || (n.kind === 'cop' && player.wanted <= 0)) { n.removeMe = true; return; }
  const target = player.inCar ? player.inCar : player;
  const d = dist2(n.x, n.y, target.x, target.y);
  if (n.kind === 'cop') {
    if (d > 620) n.searchTimer += dt; else n.searchTimer = 0;
    if (n.searchTimer > 9) { n.removeMe = true; return; }
  }
  const desiredDist = n.kind === 'cop' ? 118 : 95;
  const a = Math.atan2(target.y - n.y, target.x - n.x);
  if (d > desiredDist) {
    const sp = n.speed;
    if (!moveNpc(n, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt)) {
      const side = a + (n.kind === 'cop' ? 1 : -1) * Math.PI / 2;
      moveNpc(n, Math.cos(side) * sp * dt, Math.sin(side) * sp * dt);
    }
    n.angle = a;
  } else {
    n.angle = angleLerp(n.angle, a, clamp(dt * 8, 0, 1));
    // strafe a little so they don't all stack
    if (d < desiredDist - 25) {
      const sp = n.speed * .45;
      moveNpc(n, -Math.cos(a) * sp * dt, -Math.sin(a) * sp * dt);
    }
  }
  n.fireTimer -= dt;
  if (d < 235 && n.fireTimer <= 0) {
    n.fireTimer = n.kind === 'cop' ? rand(1.35, .8) : rand(.9, .45);
    const spread = n.kind === 'cop' ? .11 : .16;
    spawnBullet(n.x, n.y, a + rand(spread, -spread), 450, n.kind === 'cop' ? 7 : 9, n.kind === 'cop' ? 'cop' : 'gang', n.kind === 'cop' ? '#ff6b6b' : '#ff9b5b');
    for (let i = 0; i < 3; i++) particles.push({ x: n.x, y: n.y, vx: Math.cos(a) * rand(50, 10), vy: Math.sin(a) * rand(50, 10), life: .12, maxLife: .12, color: '#ffd166', size: 2 });
  }
  n.meleeTimer = (n.meleeTimer || 0) - dt;
  if (d < 18 && n.meleeTimer <= 0) {
    n.meleeTimer = 1.1;
    damagePlayer(n.kind === 'cop' ? 7 : 11, n.kind === 'cop' ? 'cassetete' : 'facão');
  }
}

function updateNpcs(dt) {
  for (let i = npcs.length - 1; i >= 0; i--) {
    const n = npcs[i];
    if (n.dead) {
      n.deathTimer += dt;
      if (n.deathTimer > 22) npcs.splice(i, 1);
      continue;
    }
    n.hitFlash = Math.max(0, (n.hitFlash || 0) - dt);
    if (n.kind === 'ped') updatePed(n, dt);
    else updateHostile(n, dt);
    if (n.removeMe) { npcs.splice(i, 1); continue; }
  }
}

function pointInCar(car, x, y) {
  const cos = Math.cos(-car.angle), sin = Math.sin(-car.angle);
  const dx = x - car.x, dy = y - car.y;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) < car.w / 2 + 2 && Math.abs(ly) < car.h / 2 + 2;
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.life -= dt;
    if (b.life <= 0) { bullets.splice(i, 1); continue; }
    let dead = false;
    const steps = 3;
    for (let s = 0; s < steps && !dead; s++) {
      b.x += b.vx * dt / steps;
      b.y += b.vy * dt / steps;
      if (isSolidAt(b.x, b.y)) {
        dead = true;
        for (let k = 0; k < 3; k++) particles.push({ x: b.x, y: b.y, vx: rand(40, -40), vy: rand(40, -40), life: .2, maxLife: .2, color: '#ffd166', size: 1 });
        break;
      }
      if (b.owner === 'player') {
        for (const v of vehicles) {
          if (v.wreck || v === player.inCar) continue;
          if (pointInCar(v, b.x, b.y)) {
            damageCar(v, b.dmg);
            dead = true;
            for (let k = 0; k < 4; k++) particles.push({ x: b.x, y: b.y, vx: rand(70, -70), vy: rand(70, -70), life: .25, maxLife: .25, color: '#ffd166', size: 2 });
            break;
          }
        }
        if (dead) break;
        for (const n of npcs) {
          if (n.dead) continue;
          if (dist2(n.x, n.y, b.x, b.y) < 8) {
            damageNpc(n, b.dmg, true);
            dead = true;
            for (let k = 0; k < 5; k++) particles.push({ x: b.x, y: b.y, vx: rand(60, -60), vy: rand(60, -60), life: .3, maxLife: .3, color: '#a51b2d', size: 2 });
            break;
          }
        }
      } else {
        if (player.inCar) {
          if (pointInCar(player.inCar, b.x, b.y)) {
            damageCar(player.inCar, b.dmg);
            dead = true;
            for (let k = 0; k < 4; k++) particles.push({ x: b.x, y: b.y, vx: rand(50, -50), vy: rand(50, -50), life: .2, maxLife: .2, color: '#ffd166', size: 2 });
            break;
          }
        } else if (dist2(player.x, player.y, b.x, b.y) < 7) {
          damagePlayer(b.dmg, 'tiro');
          dead = true;
          for (let k = 0; k < 5; k++) particles.push({ x: b.x, y: b.y, vx: rand(60, -60), vy: rand(60, -60), life: .3, maxLife: .3, color: '#a51b2d', size: 2 });
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.pow(.35, dt); p.vy *= Math.pow(.35, dt);
    p.vy += 26 * dt;
  }
}

function collectPickup(p) {
  if (p.type === 'cash') {
    player.cash += p.amount;
    game.stats.cashEarned += p.amount;
    audio.cash();
    notify('+ ' + fmtMoney(p.amount), 'green');
  } else if (p.type === 'health') {
    player.health = Math.min(player.maxHealth, player.health + p.amount);
    audio.pickup();
    notify('VIDA +' + p.amount, 'green');
  } else if (p.type === 'armor') {
    player.armor = Math.min(100, player.armor + p.amount);
    audio.pickup();
    notify('COLETE +' + p.amount, '');
  } else if (p.type === 'ammo') {
    player.reserve += p.amount;
    audio.pickup();
    notify('MUNIÇÃO +' + p.amount, 'gold');
  }
  p.active = false;
  p.timer = p.respawn;
}

function updatePickups(dt) {
  for (const p of pickups) {
    p.phase += dt * 3;
    if (!p.active) {
      if (p.respawn > 0) {
        p.timer -= dt;
        if (p.timer <= 0) p.active = true;
      }
      continue;
    }
    if (dist2(player.x, player.y, p.x, p.y) < 18) collectPickup(p);
  }
}

function spawnPoliceCar() {
  let spot = null;
  for (let tries = 0; tries < 30; tries++) {
    const c = pick(ROAD_CENTERS);
    const d = dist2(c.x, c.y, player.x, player.y);
    if (d > 330 && d < 1100) { spot = c; break; }
  }
  if (!spot) spot = pick(ROAD_CENTERS);
  const car = makeCar(spot.x, spot.y, rand(TAU), { police: true, color: '#e9e6f0', health: 115, driver: 'npc' });
  car.ai = { mode: 'chase' };
  car.siren = true;
  car.fireTimer = 1;
  audio.sirenOn();
}

function spawnCop() {
  for (let tries = 0; tries < 30; tries++) {
    const a = rand(TAU), r = rand(420, 230);
    const x = player.x + Math.cos(a) * r, y = player.y + Math.sin(a) * r;
    if (canStand(x, y, 6)) { spawnPed(x, y, 'cop'); return; }
  }
}

function updateWanted(dt) {
  if (player.wanted > 0) {
    game.crimeTimer += dt;
    if (game.crimeTimer > 24) {
      game.crimeTimer = 0;
      player.wanted = Math.max(0, player.wanted - 1);
      if (player.wanted === 0) { audio.sirenOff(); notify('A POLÍCIA DESISTIU DE VOCÊ', 'green'); }
      else notify('NÍVEL DE PROCURA DIMINUIU', '');
    }
    const policeCars = vehicles.filter(v => v.police && !v.wreck).length;
    const footCops = npcs.filter(n => n.kind === 'cop' && !n.dead).length;
    const targetCars = Math.min(4, player.wanted);
    const targetFoot = player.wanted >= 2 ? Math.min(4, player.wanted - 1) : 0;
    game.policeSpawn -= dt;
    game.footSpawn -= dt;
    if (policeCars < targetCars && game.policeSpawn <= 0) { spawnPoliceCar(); game.policeSpawn = 3.5; }
    if (footCops < targetFoot && game.footSpawn <= 0) { spawnCop(); game.footSpawn = 5; }
    if (player.wanted >= 4 && !game.heli) game.heli = { x: player.x, y: player.y, angle: 0, rotor: 0 };
    if (player.wanted < 4) game.heli = null;
  } else {
    game.heli = null;
    audio.sirenOff();
    for (const v of vehicles) if (v.police) v.wantedGone = true;
    for (const n of npcs) if (n.kind === 'cop') n.despawn = true;
  }
}

function updateHeli(dt) {
  if (!game.heli) return;
  const h = game.heli;
  h.angle += dt * .55;
  h.rotor += dt * 22;
  const radius = 145;
  const tx = player.x + Math.cos(h.angle) * radius;
  const ty = player.y + Math.sin(h.angle) * radius;
  h.x = lerp(h.x, tx, clamp(dt * 1.4, 0, 1));
  h.y = lerp(h.y, ty, clamp(dt * 1.4, 0, 1));
}

function updateVehicles(dt) {
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (v === player.inCar) continue;
    if (v.removeMe) { vehicles.splice(i, 1); continue; }
    if (v.wreck) continue;
    if (v.police) updatePoliceCar(v, dt);
    else if (v.ai && v.ai.mode === 'traffic') updateTrafficCar(v, dt);
  }
}

function updateCamera(dt) {
  const target = player.inCar ? player.inCar : player;
  let lookX = 0, lookY = 0;
  if (player.inCar) {
    lookX = Math.cos(player.inCar.angle) * Math.min(70, Math.abs(player.inCar.speed) * .3);
    lookY = Math.sin(player.inCar.angle) * Math.min(70, Math.abs(player.inCar.speed) * .3);
  } else if (input.mouse.inside) {
    lookX = clamp((input.mouse.x - W / 2) * .12, -26, 26);
    lookY = clamp((input.mouse.y - H / 2) * .12, -18, 18);
  }
  const k = 1 - Math.exp(-7 * dt);
  cam.x = lerp(cam.x, target.x - W / 2 + lookX, k);
  cam.y = lerp(cam.y, target.y - H / 2 + lookY, k);
  cam.x = clamp(cam.x, 0, WORLD_W - W);
  cam.y = clamp(cam.y, 0, WORLD_H - H);
  if (cam.shake > 0) {
    cam.shake *= Math.exp(-7 * dt);
    if (cam.shake < .1) cam.shake = 0;
    cam.shakeX = rand(cam.shake, -cam.shake);
    cam.shakeY = rand(cam.shake, -cam.shake);
  } else { cam.shakeX = 0; cam.shakeY = 0; }
}

function update(dt) {
  game.time += dt;
  game.tod = (game.tod + dt / 600) % 1;
  if (game.dialogue) updateDialogueText(dt);

  if (game.mode === 'play' && !game.freeze) {
    updatePlayer(dt);
    updateVehicles(dt);
    updateNpcs(dt);
    updateBullets(dt);
    updateParticles(dt);
    updatePickups(dt);
    updateWanted(dt);
    updateHeli(dt);
    checkAmbush();
  } else {
    updateParticles(dt);
    if (game.mode === 'play' && game.freeze) updateDialogueText(dt);
  }
  updateCamera(dt);
}

/* ============================================================
   Rendering — world & entities
   ============================================================ */
function drawWater(camX, camY) {
  const t = game.time;
  const x0 = Math.max(0, Math.floor(camX / T)), x1 = Math.min(MW - 1, Math.ceil((camX + W) / T));
  const y0 = Math.max(0, Math.floor(camY / T)), y1 = Math.min(MH - 1, Math.ceil((camY + H) / T));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tileAt(tx, ty) !== TILE.WATER) continue;
      const wx = tx * T - camX, wy = ty * T - camY;
      const off = Math.sin(t * 1.5 + tx * .7 + ty * .45) * 4;
      ctx.fillStyle = 'rgba(150,235,255,.18)';
      ctx.fillRect(wx + ((t * 7 + tx * 9 + ty * 4) % 14), wy + 5 + off, 6, 1);
      ctx.fillStyle = 'rgba(210,250,255,.10)';
      ctx.fillRect(wx + ((t * 4 + tx * 5) % 16), wy + 12 - off, 4, 1);
    }
  }
  // foam on the shore
  const foamX = 112 * T - camX;
  if (foamX > -20 && foamX < W + 20) {
    for (let y = Math.floor(camY / 8) * 8; y < camY + H; y += 8) {
      const yy = y - camY;
      const off = Math.sin(t * 2 + y * .12) * 3;
      ctx.fillStyle = 'rgba(220,250,255,.32)';
      ctx.fillRect(foamX + off, yy, 5, 1);
    }
  }
}

function drawPickups(camX, camY) {
  for (const p of pickups) {
    if (!p.active) continue;
    const x = Math.round(p.x - camX), y = Math.round(p.y - camY + Math.sin(p.phase) * 2);
    if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(x, y + 6, 7, 3, 0, 0, TAU); ctx.fill();
    if (p.type === 'cash') {
      ctx.fillStyle = '#2f7d4f'; ctx.fillRect(x - 6, y - 4, 12, 8);
      ctx.fillStyle = '#4ade80'; ctx.fillRect(x - 6, y - 4, 12, 2);
      ctx.fillStyle = '#0c3b21'; ctx.font = '5px PressStart, monospace'; ctx.textAlign = 'center';
      ctx.fillText('$', x, y + 2);
    } else if (p.type === 'health') {
      ctx.fillStyle = '#f3f0e6'; ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = '#ff3b5b'; ctx.fillRect(x - 1, y - 4, 2, 8); ctx.fillRect(x - 4, y - 1, 8, 2);
    } else if (p.type === 'armor') {
      ctx.fillStyle = '#24a9ff';
      ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y - 4); ctx.lineTo(x + 5, y + 3); ctx.lineTo(x, y + 7); ctx.lineTo(x - 5, y + 3); ctx.lineTo(x - 6, y - 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#bdefff'; ctx.fillRect(x - 1, y - 4, 2, 6);
    } else if (p.type === 'ammo') {
      ctx.fillStyle = '#8a6a1f'; ctx.fillRect(x - 6, y - 5, 12, 10);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(x - 5, y - 4, 10, 3);
      ctx.fillStyle = '#3a2b0a'; ctx.fillRect(x - 3, y + 1, 2, 4); ctx.fillRect(x + 1, y + 1, 2, 4);
    }
    ctx.restore();
  }
}

function drawMarkerGround(camX, camY) {
  if (!game.marker) return;
  const x = game.marker.x - camX, y = game.marker.y - camY;
  if (x < -40 || x > W + 40 || y < -40 || y > H + 40) return;
  const t = game.time;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * .8);
  ctx.strokeStyle = 'rgba(255,209,102,.75)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, 18 + Math.sin(t * 4) * 2, i * Math.PI / 2 + .2, i * Math.PI / 2 + 1.2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,209,102,.08)';
  ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill();
}

function drawMarkerBeam(camX, camY) {
  if (!game.marker) return;
  const x = Math.round(game.marker.x - camX), y = Math.round(game.marker.y - camY);
  if (x < -50 || x > W + 50) return;
  const t = game.time;
  const g = ctx.createLinearGradient(0, y - 90, 0, y);
  g.addColorStop(0, 'rgba(255,209,102,0)');
  g.addColorStop(.55, 'rgba(255,209,102,.12)');
  g.addColorStop(1, 'rgba(255,209,102,.35)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 6, y - 90, 12, 90);
  ctx.fillStyle = '#ffd166';
  const bob = Math.sin(t * 3) * 3;
  ctx.save();
  ctx.translate(x, y - 54 + bob);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-4, -4, 8, 8);
  ctx.restore();
  ctx.font = '5px PressStart, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,209,102,.8)';
  ctx.fillText(game.marker.label, x, y - 66 + bob);
}

function drawVehicle(v, camX, camY) {
  const x = Math.round(v.x - camX), y = Math.round(v.y - camY);
  if (x < -40 || x > W + 40 || y < -40 || y > H + 40) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(v.angle);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(2, 4, 17, 8, 0, 0, TAU); ctx.fill();
  // wheels
  ctx.fillStyle = '#15141c';
  ctx.fillRect(-11, -9, 6, 3); ctx.fillRect(5, -9, 6, 3);
  ctx.fillRect(-11, 6, 6, 3); ctx.fillRect(5, 6, 6, 3);
  // body
  const body = v.wreck ? '#3a3540' : v.color;
  ctx.fillStyle = body;
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-15, -7, 30, 14, 3); ctx.fill(); }
  else ctx.fillRect(-15, -7, 30, 14);
  // roof
  ctx.fillStyle = v.wreck ? '#2b2732' : 'rgba(20,18,30,.45)';
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-6, -5, 12, 10, 2); ctx.fill(); }
  else ctx.fillRect(-6, -5, 12, 10);
  // windshield
  ctx.fillStyle = v.wreck ? '#1c1a22' : 'rgba(150,225,255,.55)';
  ctx.fillRect(4, -5, 4, 10);
  ctx.fillStyle = v.wreck ? '#1c1a22' : 'rgba(150,225,255,.35)';
  ctx.fillRect(-9, -4, 3, 8);
  // lights
  if (!v.wreck) {
    ctx.fillStyle = '#ffe6a3';
    ctx.fillRect(13, -5, 2, 3); ctx.fillRect(13, 2, 2, 3);
    ctx.fillStyle = '#ff4b4b';
    ctx.fillRect(-15, -5, 2, 3); ctx.fillRect(-15, 2, 2, 3);
  }
  if (v.police) {
    ctx.fillStyle = '#1c2233';
    ctx.fillRect(-7, -7, 8, 14);
    const blink = Math.floor(game.time * 6) % 2;
    ctx.fillStyle = blink ? '#ff2d3b' : '#24a9ff';
    ctx.fillRect(-3, -3, 6, 3);
    ctx.fillStyle = blink ? '#24a9ff' : '#ff2d3b';
    ctx.fillRect(-3, 1, 6, 3);
    ctx.fillStyle = '#0d1018'; ctx.font = '3px PressStart, monospace'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 2);
  }
  if (v.gang) {
    ctx.fillStyle = 'rgba(255,59,59,.7)';
    ctx.fillRect(-10, -7, 3, 14);
  }
  if (v === player.inCar) {
    ctx.strokeStyle = 'rgba(255,209,102,.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(-16.5, -8.5, 33, 17);
  }
  ctx.restore();
}

function drawNpc(n, camX, camY) {
  const x = Math.round(n.x - camX), y = Math.round(n.y - camY);
  if (x < -30 || x > W + 30 || y < -40 || y > H + 30) return;
  if (n.dead) {
    ctx.fillStyle = 'rgba(120,20,32,.35)';
    ctx.beginPath(); ctx.ellipse(x, y + 3, 10, 4, 0, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(x, y + 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = n.shirt; ctx.fillRect(-5, -3, 10, 6);
    ctx.fillStyle = n.skin; ctx.fillRect(5, -2, 4, 4);
    ctx.fillStyle = n.pants; ctx.fillRect(-8, -2, 4, 4);
    ctx.restore();
    return;
  }
  const walk = Math.sin(n.walk * 9) * (n.kind === 'ped' ? 2 : 1);
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(0, 6, 6, 2.5, 0, 0, TAU); ctx.fill();
  // legs
  ctx.fillStyle = n.pants;
  ctx.fillRect(-4, 2 + Math.max(0, walk), 3, 5 - Math.max(0, walk));
  ctx.fillRect(1, 2 + Math.max(0, -walk), 3, 5 - Math.max(0, -walk));
  // body
  ctx.fillStyle = n.hitFlash > 0 ? '#fff' : n.shirt;
  ctx.fillRect(-5, -6, 10, 9);
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(-5, -6, 10, 2);
  // arms
  ctx.fillStyle = n.skin;
  ctx.fillRect(-7, -5, 2, 5); ctx.fillRect(5, -5, 2, 5);
  // head
  ctx.fillStyle = n.skin; ctx.fillRect(-3, -12, 6, 6);
  ctx.fillStyle = n.kind === 'cop' ? '#1b2740' : n.kind === 'gang' ? '#7d1626' : '#2b2026';
  if (n.kind === 'cop') { ctx.fillRect(-4, -13, 8, 3); ctx.fillRect(-4, -10, 8, 1); }
  else if (n.kind === 'gang') { ctx.fillRect(-4, -12, 8, 2); ctx.fillRect(-4, -10, 2, 3); }
  else { ctx.fillRect(-4, -13, 8, 3); }
  // gun
  if (n.kind !== 'ped') {
    ctx.save();
    ctx.rotate(n.angle);
    ctx.fillStyle = '#17141d';
    ctx.fillRect(4, -1, 7, 2);
    ctx.fillRect(9, -1, 2, 3);
    ctx.restore();
  }
  ctx.restore();
  if (n.kind !== 'ped' && n.health < n.maxHealth) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x - 8, y - 19, 16, 3);
    ctx.fillStyle = n.kind === 'cop' ? '#24a9ff' : '#ff4b4b';
    ctx.fillRect(x - 8, y - 19, 16 * (n.health / n.maxHealth), 3);
  }
}

function drawPlayer(camX, camY) {
  if (player.inCar) return;
  const x = Math.round(player.x - camX), y = Math.round(player.y - camY);
  if (player.invuln > 0 && Math.floor(game.time * 12) % 2 === 0) ctx.globalAlpha = .45;
  const walk = player.moving ? Math.sin(player.walkPhase * 9) * 2 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(0, 6, 7, 2.8, 0, 0, TAU); ctx.fill();
  // legs
  ctx.fillStyle = '#252a3b';
  ctx.fillRect(-4, 2 + Math.max(0, walk), 3, 5 - Math.max(0, walk));
  ctx.fillRect(1, 2 + Math.max(0, -walk), 3, 5 - Math.max(0, -walk));
  // body jacket
  ctx.fillStyle = '#2f7d4f';
  ctx.fillRect(-5, -6, 10, 9);
  ctx.fillStyle = '#4aa36b'; ctx.fillRect(-5, -6, 10, 2);
  ctx.fillStyle = '#1f5b38'; ctx.fillRect(-5, 1, 10, 2);
  // arms
  ctx.fillStyle = '#c68642';
  ctx.fillRect(-7, -5, 2, 5); ctx.fillRect(5, -5, 2, 5);
  // head
  ctx.fillStyle = '#c68642'; ctx.fillRect(-3, -12, 6, 6);
  ctx.fillStyle = '#171018'; ctx.fillRect(-4, -13, 8, 3);
  ctx.fillStyle = '#2f7d4f'; ctx.fillRect(-4, -13, 8, 2);
  // gun arm toward aim
  ctx.save();
  ctx.rotate(player.angle);
  ctx.fillStyle = '#c68642'; ctx.fillRect(4, -1, 5, 3);
  ctx.fillStyle = '#17141d'; ctx.fillRect(8, -1, 7, 2);
  ctx.fillRect(13, -1, 2, 3);
  ctx.restore();
  // briefcase
  if (player.hasCase) {
    ctx.fillStyle = '#5b3a1e'; ctx.fillRect(-11, 0, 6, 7);
    ctx.fillStyle = '#c9a06a'; ctx.fillRect(-11, 0, 6, 2);
    ctx.fillStyle = '#ffd166'; ctx.fillRect(-9, 2, 2, 2);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBullets(camX, camY) {
  for (const b of bullets) {
    const x = b.x - camX, y = b.y - camY;
    if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - b.vx * .018, y - b.vy * .018);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = b.color;
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
}

function drawParticles(camX, camY) {
  for (const p of particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    const x = p.x - camX, y = p.y - camY;
    if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(x), Math.round(y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawHeli(camX, camY) {
  const h = game.heli;
  if (!h) return;
  const gx = h.x - camX, gy = h.y - camY;
  // ground searchlight
  const g = ctx.createRadialGradient(gx, gy, 4, gx, gy, 62);
  g.addColorStop(0, 'rgba(255,240,190,.22)');
  g.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(gx, gy, 62, 0, TAU); ctx.fill();
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(gx + 18, gy + 16, 14, 5, 0, 0, TAU); ctx.fill();
  // body (altitude)
  const x = gx, y = gy - 82;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#1c2233'; ctx.fillRect(-16, -6, 32, 12);
  ctx.fillStyle = '#e9e6f0'; ctx.fillRect(-12, -5, 20, 10);
  ctx.fillStyle = '#24a9ff'; ctx.fillRect(-2, -5, 4, 10);
  ctx.fillStyle = '#1c2233'; ctx.fillRect(-4, -9, 8, 4);
  ctx.fillStyle = '#ffd166'; ctx.fillRect(12, -2, 3, 4);
  ctx.strokeStyle = 'rgba(220,235,255,.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.stroke();
  ctx.strokeStyle = 'rgba(220,235,255,.35)'; ctx.lineWidth = 1;
  const rot = h.rotor;
  for (let i = 0; i < 2; i++) {
    const a = rot + i * Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(-26 * Math.cos(a), -26 * Math.sin(a)); ctx.lineTo(26 * Math.cos(a), 26 * Math.sin(a)); ctx.stroke();
  }
  ctx.fillStyle = '#ff2d3b'; ctx.fillRect(-2, 6, 2, 2);
  ctx.restore();
}

function drawHeadlights(camX, camY) {
  const nf = nightFactor(game.tod);
  if (nf < .12) return;
  for (const v of vehicles) {
    if (v.wreck) continue;
    if (v.parked && Math.abs(v.speed) < 2) continue;
    const x = v.x - camX, y = v.y - camY;
    if (x < -60 || x > W + 60 || y < -60 || y > H + 60) continue;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(v.angle);
    ctx.globalAlpha = nf * .14;
    ctx.fillStyle = '#ffe6a3';
    ctx.beginPath();
    ctx.moveTo(13, -5); ctx.lineTo(54, -20); ctx.lineTo(54, 20); ctx.lineTo(13, 5); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = nf * .35;
    ctx.fillStyle = '#ff4b4b'; ctx.fillRect(-17, -5, 2, 3); ctx.fillRect(-17, 2, 2, 3);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawCrosshair() {
  if (input.touch || !input.mouse.inside || game.mode !== 'play' || game.freeze) return;
  const x = input.mouse.x, y = input.mouse.y;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,95,181,.85)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 7, y); ctx.lineTo(x - 2, y);
  ctx.moveTo(x + 2, y); ctx.lineTo(x + 7, y);
  ctx.moveTo(x, y - 7); ctx.lineTo(x, y - 2);
  ctx.moveTo(x, y + 2); ctx.lineTo(x, y + 7);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,95,181,.8)'; ctx.fillRect(x - 1, y - 1, 2, 2);
  ctx.restore();
}

function drawGame() {
  const camX = Math.round(clamp(cam.x + cam.shakeX, 0, WORLD_W - W));
  const camY = Math.round(clamp(cam.y + cam.shakeY, 0, WORLD_H - H));
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(worldCanvas, camX, camY, W, H, 0, 0, W, H);
  drawWater(camX, camY);
  drawPickups(camX, camY);
  drawMarkerGround(camX, camY);

  const renderables = [];
  for (const v of vehicles) renderables.push({ y: v.y, fn: () => drawVehicle(v, camX, camY) });
  for (const n of npcs) renderables.push({ y: n.y, fn: () => drawNpc(n, camX, camY) });
  if (!player.inCar) renderables.push({ y: player.y, fn: () => drawPlayer(camX, camY) });
  renderables.sort((a, b) => a.y - b.y);
  for (const r of renderables) r.fn();

  drawBullets(camX, camY);
  drawParticles(camX, camY);

  // day / night tint
  const nf = nightFactor(game.tod);
  const sf = sunsetFactor(game.tod);
  if (nf > 0) {
    ctx.fillStyle = `rgba(8,10,38,${nf * .58})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (sf > 0) {
    ctx.fillStyle = `rgba(255,95,40,${sf * .15})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (nf > .02) {
    ctx.save();
    ctx.globalAlpha = nf;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(nightCanvas, camX, camY, W, H, 0, 0, W, H);
    ctx.restore();
  }
  drawHeadlights(camX, camY);
  drawHeli(camX, camY);
  drawMarkerBeam(camX, camY);
  drawCrosshair();

  // damage / low health
  if (player.damageFlash > 0) {
    ctx.fillStyle = `rgba(255,20,40,${player.damageFlash * .38})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (player.health < 30 && game.mode === 'play') {
    const pulse = .12 + Math.sin(game.time * 6) * .06;
    const g = ctx.createRadialGradient(W / 2, H / 2, H * .28, W / 2, H / 2, H * .78);
    g.addColorStop(0, 'rgba(255,0,30,0)');
    g.addColorStop(1, `rgba(255,0,30,${pulse})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // cinematic letterbox during cutscene dialogue
  if (game.mode === 'cutscene') {
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, W, 26);
    ctx.fillRect(0, H - 26, W, 26);
  }
}

/* ============================================================
   Title & cutscene pixel art
   ============================================================ */
function pixelSun(c, x, y, r, top, bottom, stripeCol) {
  const g = c.createLinearGradient(0, y - r, 0, y + r);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.fillStyle = stripeCol;
  for (let i = 0; i < 6; i++) c.fillRect(x - r, y + 4 + i * 5, r * 2, 1 + i * .35);
}

function drawPalmSilhouette(c, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = col; c.lineWidth = 3;
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-6, -30, 4, -58); c.stroke();
  c.fillStyle = col;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    c.save(); c.translate(4, -58); c.rotate(a);
    c.beginPath(); c.ellipse(17, 0, 20, 5, 0, 0, TAU); c.fill();
    c.restore();
  }
  c.beginPath(); c.arc(4, -60, 6, 0, TAU); c.fill();
  c.restore();
}

function drawTitleScene() {
  const c = ctx;
  const t = game.titleTime;
  c.clearRect(0, 0, W, H);
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#160a2e');
  sky.addColorStop(.34, '#4b1152');
  sky.addColorStop(.62, '#c3266e');
  sky.addColorStop(.82, '#ff6b4a');
  sky.addColorStop(1, '#ffb347');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);

  // stars
  for (let i = 0; i < 40; i++) {
    const x = (hash2(i, 2) * W + t * (i % 3 + 1) * .3) % W;
    const y = hash2(i, 7) * 120;
    c.fillStyle = `rgba(255,255,255,${.15 + hash2(i, 9) * .35})`;
    c.fillRect(x, y, 1, 1);
  }
  // sun
  pixelSun(c, 468, 152, 54, '#fff0a8', '#ff5f8f', 'rgba(70,12,60,.55)');
  // sun reflection
  for (let i = 0; i < 14; i++) {
    const yy = 246 + i * 4;
    const w = 52 - i * 2.4 + Math.sin(t * 2 + i) * 4;
    c.fillStyle = `rgba(255,209,102,${.3 - i * .015})`;
    c.fillRect(468 - w / 2, yy, w, 2);
  }
  // clouds
  for (let i = 0; i < 5; i++) {
    const x = ((i * 151 + t * (8 + i * 2)) % (W + 180)) - 90;
    const y = 58 + i * 21;
    c.fillStyle = `rgba(255,160,190,${.12 + i * .02})`;
    c.fillRect(x, y, 70, 4); c.fillRect(x + 12, y - 4, 44, 4); c.fillRect(x + 24, y + 4, 56, 3);
  }
  // far skyline
  for (let i = 0; i < 24; i++) {
    const bx = i * 28 - 8;
    const bh = 24 + hash2(i, 4) * 58;
    const by = 224 - bh;
    c.fillStyle = '#2a0c3a';
    c.fillRect(bx, by, 24, bh);
    c.fillStyle = 'rgba(255,45,149,.55)';
    for (let wy = by + 6; wy < 220; wy += 9) {
      if (hash2(bx, wy) > .5) c.fillRect(bx + 4 + (hash2(wy, bx) * 10 | 0), wy, 2, 3);
    }
  }
  // near skyline
  for (let i = 0; i < 18; i++) {
    const bx = i * 38 - 10;
    const bh = 34 + hash2(i, 8) * 56;
    const by = 246 - bh;
    c.fillStyle = '#12061f';
    c.fillRect(bx, by, 32, bh);
    c.fillStyle = 'rgba(36,224,255,.4)';
    for (let wy = by + 5; wy < 242; wy += 10) if (hash2(bx, wy) > .55) c.fillRect(bx + 5, wy, 3, 2);
    if (i === 4 || i === 12) {
      c.fillStyle = i === 4 ? '#ff2d95' : '#24e0ff';
      c.fillRect(bx + 10, by + 6, 12, 3);
    }
  }
  // ocean
  const oc = c.createLinearGradient(0, 246, 0, 310);
  oc.addColorStop(0, '#240c3f'); oc.addColorStop(1, '#0a0820');
  c.fillStyle = oc; c.fillRect(0, 246, W, 66);
  for (let i = 0; i < 30; i++) {
    const yy = 250 + i * 2;
    c.fillStyle = `rgba(255,110,160,${.08 + (i % 4) * .02})`;
    c.fillRect((Math.sin(t * .7 + i) * 20 + i * 23) % W, yy, 18 + (i % 3) * 8, 1);
  }
  // beach / road
  c.fillStyle = '#120b1c'; c.fillRect(0, 310, W, 50);
  c.fillStyle = '#1c1426'; c.fillRect(0, 316, W, 44);
  c.fillStyle = 'rgba(255,209,102,.45)';
  for (let x = -20; x < W + 40; x += 46) c.fillRect(x + (t * 22 % 46), 338, 20, 2);
  // palms
  drawPalmSilhouette(c, 44, 330, 1.55, '#08050f');
  drawPalmSilhouette(c, 604, 342, 1.8, '#08050f');
  drawPalmSilhouette(c, 94, 346, .9, '#0b0714');
  // car silhouette
  const carX = ((t * 38) % 780) - 70;
  c.save(); c.translate(carX, 330);
  c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.ellipse(0, 9, 30, 6, 0, 0, TAU); c.fill();
  c.fillStyle = '#160c22'; c.beginPath(); c.moveTo(-28, 5); c.lineTo(-20, -5); c.lineTo(18, -6); c.lineTo(30, 3); c.lineTo(28, 8); c.lineTo(-26, 8); c.closePath(); c.fill();
  c.fillStyle = '#ff2d95'; c.fillRect(-4, -4, 16, 3);
  c.fillStyle = '#ffe6a3'; c.fillRect(27, 0, 5, 3);
  c.fillStyle = '#0b0714'; c.beginPath(); c.arc(-15, 8, 5, 0, TAU); c.arc(18, 8, 5, 0, TAU); c.fill();
  c.restore();
  // seagulls
  for (let i = 0; i < 5; i++) {
    const x = 80 + i * 110 + Math.sin(t * .5 + i) * 18;
    const y = 70 + i * 13;
    c.strokeStyle = 'rgba(255,220,230,.5)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x, y - 2); c.lineTo(x + 4, y); c.stroke();
  }
  // grain dots
  for (let i = 0; i < 30; i++) {
    c.fillStyle = 'rgba(255,255,255,.12)';
    c.fillRect((hash2(i, 3) * W + t * 4) % W, hash2(i, 5) * H, 1, 1);
  }
}

function drawBigPerson(c, x, y, s, shirt, pants, skin, hair, luna) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 2, 11, 3.5, 0, 0, TAU); c.fill();
  c.fillStyle = pants; c.fillRect(-6, -18, 5, 20); c.fillRect(2, -18, 5, 20);
  c.fillStyle = '#171018'; c.fillRect(-7, -2, 6, 4); c.fillRect(2, -2, 6, 4);
  c.fillStyle = shirt; c.fillRect(-8, -36, 16, 20);
  c.fillStyle = luna ? '#ff7ab9' : '#4aa36b'; c.fillRect(-8, -36, 16, 3);
  c.fillStyle = skin; c.fillRect(-11, -34, 3, 13); c.fillRect(8, -34, 3, 13);
  c.fillStyle = skin; c.fillRect(-5, -48, 10, 12);
  c.fillStyle = hair;
  if (luna) { c.fillRect(-7, -51, 14, 10); c.fillRect(-8, -47, 3, 16); c.fillRect(5, -47, 3, 16); }
  else { c.fillRect(-6, -51, 12, 6); c.fillRect(-6, -47, 2, 4); c.fillStyle = '#2f7d4f'; c.fillRect(-7, -53, 14, 4); }
  if (luna) { c.fillStyle = '#ffd166'; c.fillRect(-8, -40, 2, 2); c.fillRect(6, -40, 2, 2); }
  c.restore();
}

function drawCutscene() {
  const c = ctx;
  const t = game.cutsceneTime;
  c.clearRect(0, 0, W, H);
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1c0a32');
  sky.addColorStop(.38, '#5b155c');
  sky.addColorStop(.64, '#d63b76');
  sky.addColorStop(.84, '#ff8a4a');
  sky.addColorStop(1, '#ffd166');
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 36; i++) {
    c.fillStyle = `rgba(255,255,255,${.1 + hash2(i, 2) * .3})`;
    c.fillRect(hash2(i, 5) * W, hash2(i, 8) * 100, 1, 1);
  }
  pixelSun(c, 508, 144, 58, '#fff3b0', '#ff6b6b', 'rgba(70,12,60,.5)');
  // skyline
  for (let i = 0; i < 20; i++) {
    const bx = i * 34 - 12;
    const bh = 28 + hash2(i, 6) * 62;
    c.fillStyle = '#2a0b35'; c.fillRect(bx, 238 - bh, 30, bh);
    c.fillStyle = 'rgba(255,209,102,.45)';
    for (let wy = 238 - bh + 6; wy < 234; wy += 9) if (hash2(bx, wy) > .55) c.fillRect(bx + 5, wy, 2, 2);
  }
  // ocean
  c.fillStyle = '#1c0a30'; c.fillRect(0, 238, W, 80);
  for (let i = 0; i < 26; i++) {
    const yy = 242 + i * 3;
    c.fillStyle = `rgba(255,130,170,${.12 - i * .003})`;
    c.fillRect(430 + Math.sin(t + i) * 10, yy, 46 - i, 1);
    c.fillRect(180 + Math.sin(t * .8 + i) * 18, yy, 28, 1);
  }
  // sand
  c.fillStyle = '#3a2432'; c.fillRect(0, 300, W, 60);
  c.fillStyle = '#4a2b38'; c.fillRect(0, 312, W, 48);
  // parked convertible
  const carX = 245, carY = 308;
  c.save(); c.translate(carX, carY);
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 12, 48, 8, 0, 0, TAU); c.fill();
  c.fillStyle = '#2b1028'; c.beginPath(); c.moveTo(-46, 6); c.lineTo(-34, -9); c.lineTo(30, -10); c.lineTo(48, 3); c.lineTo(44, 11); c.lineTo(-44, 11); c.closePath(); c.fill();
  c.fillStyle = '#ff2d95'; c.fillRect(-34, -7, 62, 3);
  c.fillStyle = '#2a8f9f'; c.fillRect(-20, -12, 28, 5);
  c.fillStyle = '#0b0714'; c.beginPath(); c.arc(-27, 11, 8, 0, TAU); c.arc(29, 11, 8, 0, TAU); c.fill();
  c.fillStyle = '#ffe6a3'; c.fillRect(44, 1, 5, 4);
  c.restore();
  // characters
  drawBigPerson(c, 370, 342, 3.3, '#2f7d4f', '#252a3b', '#c68642', '#171018', false);
  drawBigPerson(c, 452, 344, 3.1, '#ff2d95', '#f3f0e6', '#e0ac69', '#2a0d2a', true);
  // palms
  drawPalmSilhouette(c, 60, 340, 2.1, '#08050f');
  drawPalmSilhouette(c, 596, 350, 2.2, '#08050f');
  drawPalmSilhouette(c, 135, 356, 1.2, '#0b0714');
  // seagulls
  for (let i = 0; i < 4; i++) {
    const x = 110 + i * 120 + Math.sin(t * .6 + i) * 12;
    const y = 72 + i * 11;
    c.strokeStyle = 'rgba(255,220,230,.5)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x, y - 2); c.lineTo(x + 4, y); c.stroke();
  }
  // cinematic bars
  c.fillStyle = '#05040a'; c.fillRect(0, 0, W, 24); c.fillRect(0, H - 24, W, 24);
  c.font = '6px PressStart, monospace'; c.textAlign = 'left';
  c.fillStyle = 'rgba(255,255,255,.55)';
  c.fillText('VICE CITY · 2026', 16, 36);
  c.fillStyle = 'rgba(255,45,149,.75)';
  c.fillRect(16, 41, 82, 1);
}

/* ============================================================
   HUD / radar / phone
   ============================================================ */
let lastHudAt = 0;

function locationName() {
  const x = player.x, y = player.y;
  let best = null, bd = 128;
  for (const p of pois) {
    const d = dist2(x, y, p.x, p.y);
    if (d < bd) { bd = d; best = p; }
  }
  if (best) return best.name;
  if (x > 100 * T) return 'PRAIA DE VICE';
  if (y > 70 * T) return 'DOCKS';
  if (x < 30 * T) return 'MOTEL VICE';
  if (x < 50 * T) return y < 30 * T ? 'VICE NORTE' : y < 70 * T ? 'CENTRO' : 'SUNSET';
  if (x < 70 * T) return y < 30 * T ? 'DOWNTOWN' : 'GALLERIA';
  return y < 30 * T ? 'MIDTOWN' : y < 70 * T ? 'HELIPONTO' : 'PIER DISTRICT';
}

function updateHUD(force = false) {
  const now = performance.now();
  if (!force && now - lastHudAt < 70) return;
  lastHudAt = now;
  if (game.mode === 'title' || game.mode === 'cutscene') return;

  let tag = 'MISSÃO 01', name = 'O ENCONTRO', obj = 'Vá até o Neon Palace';
  if (game.freeRoam) {
    tag = 'MODO LIVRE'; name = 'VICE CITY'; obj = 'Explore, roube carros e fuja da polícia';
  } else if (game.missionDone) {
    tag = 'CONCLUÍDA'; name = 'VICE É SUA'; obj = 'A cidade é toda sua agora';
  } else if (game.stage === 5) {
    const alive = npcs.filter(n => n.kind === 'gang' && !n.dead).length;
    tag = 'MISSÃO 05'; name = 'EMBOSCADA'; obj = `Elimine a gangue: ${game.gangTotal - alive} / ${game.gangTotal}`;
  } else {
    tag = 'MISSÃO 0' + (game.stage + 1);
    name = MISSION_NAMES[game.stage] || '';
    obj = MISSION_OBJECTIVES[game.stage] || '';
  }
  $('#missionTag').textContent = tag;
  $('#missionName').textContent = name;
  $('#missionObj').textContent = obj;
  if (game.marker) {
    const d = Math.round(dist2(player.x, player.y, game.marker.x, game.marker.y) / 8);
    $('#missionDist').textContent = d + ' m';
  } else {
    $('#missionDist').textContent = game.stage === 5 ? 'EM COMBATE' : '—';
  }

  const stars = $('#wanted').children;
  for (let i = 0; i < stars.length; i++) stars[i].classList.toggle('on', i < player.wanted);
  $('#cash').textContent = fmtMoney(player.cash);
  $('#healthFill').style.width = clamp(player.health, 0, 100) + '%';
  $('#armorFill').style.width = clamp(player.armor, 0, 100) + '%';
  $('#healthNum').textContent = Math.max(0, Math.round(player.health));
  $('#armorNum').textContent = Math.max(0, Math.round(player.armor));
  $('#carHealthRow').classList.toggle('hidden', !player.inCar);
  if (player.inCar) $('#carFill').style.width = clamp(player.inCar.health / player.inCar.maxHealth * 100, 0, 100) + '%';
  $('#weaponName').textContent = player.weapon === 'smg' ? 'SMG' : 'PISTOLA';
  $('#weaponIcon').textContent = player.weapon === 'smg' ? '≡' : '▬';
  $('#ammo').textContent = player.mag + ' / ' + (player.reserve > 999 ? '∞' : player.reserve);

  const hours = Math.floor(game.tod * 24);
  const mins = Math.floor((game.tod * 24 % 1) * 60);
  const timeStr = String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');
  $('#clock').textContent = timeStr;
  $('#phoneTime').textContent = timeStr;

  $('#speedo').classList.toggle('hidden', !player.inCar);
  if (player.inCar) {
    const kmh = Math.round(Math.abs(player.inCar.speed) * .52);
    $('#speedVal').textContent = kmh;
    $('#speedFill').style.width = clamp(Math.abs(player.inCar.speed) / 212 * 100, 0, 100) + '%';
  }
  $('#radarLabel').textContent = locationName();
}

function drawRadar() {
  const S = 176, C = S / 2;
  const c = radarCtx;
  const center = player.inCar ? player.inCar : player;
  const cx = center.x, cy = center.y;
  const scale = .4;
  c.clearRect(0, 0, S, S);
  c.save();
  c.beginPath(); c.arc(C, C, C - 4, 0, TAU); c.clip();
  c.fillStyle = '#08060f'; c.fillRect(0, 0, S, S);
  c.save();
  c.translate(C, C);
  c.scale(3.2, 3.2);
  c.translate(-cx / 8, -cy / 8);
  c.drawImage(minimapCanvas, 0, 0);
  c.restore();

  // roads glow
  c.globalAlpha = .18;
  c.fillStyle = '#ff2d95';
  c.fillRect(0, C - 1, S, 2);
  c.fillRect(C - 1, 0, 2, S);
  c.globalAlpha = 1;

  // mission marker
  if (game.marker) {
    let mx = C + (game.marker.x - cx) * scale;
    let my = C + (game.marker.y - cy) * scale;
    const dx = mx - C, dy = my - C;
    const dd = Math.hypot(dx, dy);
    if (dd > C - 12) { const k = (C - 12) / dd; mx = C + dx * k; my = C + dy * k; }
    c.save();
    c.translate(mx, my); c.rotate(game.time * 2);
    c.fillStyle = '#ffd166'; c.fillRect(-4, -4, 8, 8);
    c.restore();
    c.strokeStyle = 'rgba(255,209,102,.7)'; c.lineWidth = 1;
    c.beginPath(); c.arc(mx, my, 7 + Math.sin(game.time * 5) * 2, 0, TAU); c.stroke();
  }
  // vehicles / hostiles
  for (const v of vehicles) {
    if (v === player.inCar || v.wreck) continue;
    const rx = C + (v.x - cx) * scale, ry = C + (v.y - cy) * scale;
    if (Math.hypot(rx - C, ry - C) > C - 7) continue;
    if (v.police) {
      c.fillStyle = Math.floor(game.time * 7) % 2 ? '#ff3b3b' : '#24a9ff';
      c.fillRect(rx - 2, ry - 2, 4, 4);
    } else if (Math.hypot(v.x - cx, v.y - cy) < 260) {
      c.fillStyle = 'rgba(220,220,235,.5)';
      c.fillRect(rx - 1, ry - 1, 2, 2);
    }
  }
  for (const n of npcs) {
    if (n.dead || n.kind === 'ped') continue;
    const rx = C + (n.x - cx) * scale, ry = C + (n.y - cy) * scale;
    if (Math.hypot(rx - C, ry - C) > C - 7) continue;
    c.fillStyle = n.kind === 'cop' ? '#ff3b3b' : '#c084fc';
    c.fillRect(rx - 2, ry - 2, 4, 4);
  }
  // player arrow
  c.save();
  c.translate(C, C);
  c.rotate((player.inCar ? player.inCar.angle : player.angle) + Math.PI / 2);
  c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,45,149,.9)'; c.lineWidth = 1; c.stroke();
  c.restore();
  // rings
  c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1;
  c.beginPath(); c.arc(C, C, C * .55, 0, TAU); c.stroke();
  c.beginPath(); c.arc(C, C, C * .82, 0, TAU); c.stroke();
  c.restore();
  // compass
  c.fillStyle = 'rgba(255,255,255,.55)';
  c.font = '6px PressStart, monospace'; c.textAlign = 'center';
  c.fillText('N', C, 12);
}

function updatePhoneContent() {
  if (!$('#phoneMissions')) return;
  const cashEl = $('#phoneCash'); if (cashEl) cashEl.textContent = fmtMoney(player.cash);
  const wEl = $('#phoneWanted'); if (wEl) wEl.textContent = player.wanted > 0 ? '★'.repeat(player.wanted) : 'LIMPO';
  const hEl = $('#phoneHealth'); if (hEl) hEl.textContent = Math.round(player.health);
  const wepEl = $('#phoneWeapon'); if (wepEl) wepEl.textContent = player.weapon === 'smg' ? 'SMG' : 'PISTOLA';
  const carEl = $('#phoneCar'); if (carEl) carEl.textContent = player.inCar ? (player.inCar.police ? 'VIATURA' : 'CARRO') : 'A PÉ';
  const list = $('#phoneMissions');
  let html = '';
  for (let i = 0; i < 5; i++) {
    const done = game.missionDone || game.stage > i;
    const active = !game.missionDone && game.stage === i;
    const icon = done ? '✓' : active ? '◆' : '○';
    html += `<div class="pm ${done ? 'done' : ''} ${active ? 'active' : ''}"><span class="pm-i">${icon}</span><span>${MISSION_NAMES[i]}<br><em>${MISSION_OBJECTIVES[i]}</em></span></div>`;
  }
  list.innerHTML = html;
}

function drawPhoneMap() {
  const c = phoneMapCtx;
  const MWp = phoneMapCanvas.width, MHp = phoneMapCanvas.height;
  c.clearRect(0, 0, MWp, MHp);
  c.fillStyle = '#07060e'; c.fillRect(0, 0, MWp, MHp);
  const scale = Math.min(MWp / (MW * 2), MHp / (MH * 2));
  const mw = MW * 2 * scale, mh = MH * 2 * scale;
  const ox = (MWp - mw) / 2, oy = (MHp - mh) / 2;
  c.drawImage(minimapCanvas, ox, oy, mw, mh);
  const px = ox + (player.x / 8) * scale, py = oy + (player.y / 8) * scale;
  if (game.marker) {
    const mx = ox + (game.marker.x / 8) * scale, my = oy + (game.marker.y / 8) * scale;
    c.fillStyle = '#ffd166'; c.fillRect(mx - 4, my - 4, 8, 8);
    c.strokeStyle = 'rgba(255,209,102,.7)'; c.strokeRect(mx - 6, my - 6, 12, 12);
  }
  c.save();
  c.translate(px, py);
  c.rotate(player.angle + Math.PI / 2);
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 5); c.lineTo(0, 2); c.lineTo(-4, 5); c.closePath(); c.fill();
  c.restore();
  // landmarks labels
  c.font = '6px PressStart, monospace'; c.textAlign = 'left';
  const labels = [['NEON', landmarks.club], ['GARAGEM', landmarks.garage], ['MARINA', landmarks.marina], ['HELI', landmarks.helipad]];
  for (const [txt, p] of labels) {
    const x = ox + (p.x / 8) * scale, y = oy + (p.y / 8) * scale;
    c.fillStyle = 'rgba(255,209,102,.55)';
    c.fillText(txt, x + 5, y - 4);
  }
  c.fillStyle = 'rgba(255,255,255,.35)';
  c.font = '5px PressStart, monospace';
  c.fillText('VICE CITY', 6, MHp - 6);
}

/* ============================================================
   UI wiring
   ============================================================ */
function restartGame() {
  ['#pause', '#phone', '#wasted', '#victory'].forEach(s => $(s).classList.add('hidden'));
  resetRun();
  startGameplay();
  notify('NOVO JOGO · VICE CITY ESTÁ ESPERANDO', 'gold');
}

function freeRoam() {
  $('#victory').classList.add('hidden');
  game.mode = 'play';
  game.freeRoam = true;
  game.missionDone = true;
  game.ambush = false;
  game.marker = null;
  game.stage = 5;
  game.freeze = false;
  $('#hud').classList.remove('hidden');
  $('#touch').classList.toggle('hidden', !document.body.classList.contains('touch'));
  notify('MODO LIVRE DESBLOQUEADO · FAÇA O QUE QUISER', 'gold');
  updateHUD(true);
}

function bindUI() {
  $('#startBtn').addEventListener('click', e => { e.stopPropagation(); audio.init(); startFromTitle(); });
  $('#dialogue').addEventListener('click', () => advanceDialogue());
  $('#skipCutscene').addEventListener('click', e => { e.stopPropagation(); skipCutscene(); });
  $('#resumeBtn').addEventListener('click', () => togglePause());
  $('#restartBtn').addEventListener('click', restartGame);
  $('#muteBtn2').addEventListener('click', toggleMute);
  $('#phoneClose').addEventListener('click', closePhone);
  $('#respawnBtn').addEventListener('click', respawnPlayer);
  $('#wastedRestart').addEventListener('click', restartGame);
  $('#replayBtn').addEventListener('click', restartGame);
  $('#freeRoamBtn').addEventListener('click', freeRoam);
  $('#pause').addEventListener('click', e => { if (e.target === $('#pause')) togglePause(); });
  $('#phone').addEventListener('click', e => { if (e.target === $('#phone')) closePhone(); });
}

/* ============================================================
   Main loop
   ============================================================ */
let lastFrame = performance.now();
function loop(now) {
  const dt = Math.min(.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;

  if (game.mode === 'title') {
    game.titleTime += dt;
    drawTitleScene();
  } else if (game.mode === 'cutscene') {
    game.cutsceneTime += dt;
    updateDialogueText(dt);
    drawCutscene();
  } else if (game.mode === 'play') {
    update(dt);
    drawGame();
  } else {
    drawGame();
  }

  if (game.mode === 'play' || game.mode === 'paused' || game.mode === 'phone') {
    updateHUD();
    drawRadar();
  }
  updateRotateHint();
  requestAnimationFrame(loop);
}

async function init() {
  fitCanvas();
  setupTouch();
  bindUI();
  await Promise.race([
    document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
    new Promise(res => setTimeout(res, 1800))
  ]);
  buildWorld();
  resetRun();
  game.mode = 'title';
  game.titleTime = 0;
  $('#hud').classList.add('hidden');
  $('#touch').classList.add('hidden');
  updateHUD(true);
  window.PV = { game, player, vehicles: () => vehicles, npcs: () => npcs, audio };
  requestAnimationFrame(loop);
}

init().catch(err => {
  console.error(err);
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;color:#fff;background:#07060d;font-family:monospace;z-index:999;padding:20px;text-align:center';
  t.textContent = 'Erro ao iniciar o jogo: ' + err.message;
  document.body.appendChild(t);
});
