// Battlefield backdrop and all character rendering, drawn with chunky rectangles.
import { makeCanvas, px, disc, ring, glow, fillPoly, quantize, mulberry32, clamp } from './pixel.js';

export const GROUND_Y = 228;

const BG_PALETTE = [
  '#05060a', '#080a0f', '#0c0f15', '#11151c', '#171c24', '#1e242d',
  '#262d37', '#303842', '#3b434d', '#48505a', '#575e66', '#676b70',
  '#7a7268', '#8d8072', '#a4947e', '#b8a48a', '#cbb694', '#dcc7a2',
  '#eed7ae', '#f7e6c2', '#5a2c1c', '#33150f', '#6d2a18', '#8f3a20',
  '#2a2118', '#3d2f22', '#1a1410', '#100c0a', '#211a1b', '#2c2320',
];

// ------------------------------------------------------------------ helpers
export function line(ctx, x0, y0, x1, y1, color, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  ctx.fillStyle = color;
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let guard = 300;
  while (guard-- > 0) {
    ctx.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function limb(ctx, x0, y0, x1, y1, color, w, outline) {
  if (outline) line(ctx, x0, y0, x1, y1, outline, w + 2);
  line(ctx, x0, y0, x1, y1, color, w);
}

// ------------------------------------------------------------ arena backdrop
export function buildArenaBackdrop() {
  const c = makeCanvas(480, 270);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(2024);

  const sky = ctx.createLinearGradient(0, 0, 0, 240);
  sky.addColorStop(0, '#080b11');
  sky.addColorStop(0.3, '#141a23');
  sky.addColorStop(0.5, '#2a2c30');
  sky.addColorStop(0.66, '#614a36');
  sky.addColorStop(0.78, '#9a6c42');
  sky.addColorStop(0.86, '#3b2a1d');
  sky.addColorStop(1, '#0e0b09');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 480, 270);

  // storm cells
  for (let i = 0; i < 40; i++) {
    ctx.save();
    ctx.globalAlpha = 0.18 + rnd() * 0.22;
    ctx.fillStyle = rnd() < 0.5 ? '#0a0d12' : '#39424c';
    ctx.beginPath();
    ctx.ellipse(rnd() * 480, rnd() * 120, 40 + rnd() * 80, 10 + rnd() * 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // glow on the horizon behind Olympus
  const sun = ctx.createRadialGradient(238, 166, 4, 238, 166, 130);
  sun.addColorStop(0, 'rgba(255,220,160,0.7)');
  sun.addColorStop(0.35, 'rgba(226,150,86,0.22)');
  sun.addColorStop(1, 'rgba(160,80,40,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(80, 60, 320, 180);

  // distant mount Olympus
  fillPoly(ctx, [40, 216, 96, 160, 138, 186, 196, 108, 244, 178, 300, 142, 350, 188, 404, 152, 480, 216], '#211d21');
  fillPoly(ctx, [150, 196, 196, 118, 224, 150, 244, 128, 282, 196], '#2a2426');
  // temple silhouette atop the peak
  ctx.fillStyle = '#1b171a';
  ctx.fillRect(176, 112, 44, 4);
  for (let i = 0; i < 6; i++) ctx.fillRect(178 + i * 7, 116, 4, 24);
  ctx.fillRect(172, 140, 52, 3);
  // tiny warm windows
  for (let i = 0; i < 5; i++) px(ctx, 181 + i * 7, 124 + (i % 2) * 4, 2, 3, '#a2602e');

  // ruined giant statue, half buried in fog
  ctx.save();
  ctx.globalAlpha = 0.9;
  fillPoly(ctx, [180, 228, 190, 180, 204, 168, 206, 152, 218, 148, 222, 132, 236, 128, 244, 140, 250, 160, 262, 172, 270, 196, 276, 228], '#181419');
  const stRnd = mulberry32(77);
  for (let i = 0; i < 12; i++) {
    px(ctx, 200 + stRnd() * 60, 140 + stRnd() * 80, 2, 8 + stRnd() * 14, '#221c20');
  }
  px(ctx, 228, 146, 5, 3, '#8f3a20');
  px(ctx, 242, 146, 4, 3, '#8f3a20');
  ctx.restore();

  // broken columns, mid ground
  const column = (x, top, h, w) => {
    ctx.fillStyle = '#2b2325';
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = '#3d2f2c';
    ctx.fillRect(x + 2, top, 4, h);
    ctx.fillStyle = '#1a1415';
    ctx.fillRect(x + w - 5, top, 4, h);
    ctx.fillStyle = '#463833';
    for (let i = 1; i < w - 2; i += 5) ctx.fillRect(x + i, top + 2, 1, h - 2);
    // capital
    ctx.fillStyle = '#3b302b';
    ctx.fillRect(x - 4, top - 7, w + 8, 6);
    ctx.fillRect(x - 6, top - 2, w + 12, 3);
    ctx.fillStyle = '#241c1a';
    ctx.fillRect(x - 4, top - 8, w + 8, 2);
    // erosion at top
    ctx.fillStyle = '#0c0909';
    ctx.fillRect(x + w * 0.2, top - 8, 4, 4);
    ctx.fillRect(x + w * 0.7, top - 6, 3, 3);
  };
  column(24, 100, 128, 26);
  column(56, 132, 96, 18);
  column(420, 88, 140, 26);
  column(388, 138, 90, 16);
  column(348, 158, 70, 12);

  // chain hanging between columns (visual flavour)
  ctx.fillStyle = '#171214';
  for (let i = 0; i < 40; i++) {
    const t = i / 39;
    const x = 56 + t * 330;
    const y = 112 + Math.sin(t * Math.PI) * 34;
    ctx.fillRect(Math.round(x), Math.round(y), 2, 4);
    ctx.fillRect(Math.round(x + 1), Math.round(y + 1), 1, 1);
  }

  // smoke hugging the ground
  for (let i = 0; i < 26; i++) {
    ctx.save();
    ctx.globalAlpha = 0.1 + rnd() * 0.12;
    ctx.fillStyle = i % 3 ? '#3b3430' : '#5b4a3c';
    ctx.beginPath();
    ctx.ellipse(rnd() * 480, 196 + rnd() * 46, 30 + rnd() * 60, 6 + rnd() * 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // floor slab
  ctx.fillStyle = '#241a13';
  ctx.fillRect(0, GROUND_Y, 480, 270 - GROUND_Y);
  ctx.fillStyle = '#3a2b1f';
  ctx.fillRect(0, GROUND_Y, 480, 6);
  ctx.fillStyle = '#6a4a2c';
  ctx.fillRect(0, GROUND_Y, 480, 1);
  ctx.fillStyle = '#4a3521';
  for (let x = 6; x < 480; x += 46) ctx.fillRect(x, GROUND_Y + 1, 18, 1);
  // tiles
  for (let y = GROUND_Y + 8; y < 270; y += 12) {
    for (let x = (y / 12) % 2 ? 12 : -8; x < 480; x += 52) {
      px(ctx, x, y, 46, 1, '#3a2a1d');
      px(ctx, x, y + 1, 1, 10, '#17110c');
      px(ctx, x + 6, y + 3, 20, 1, '#2f2116');
      px(ctx, x + 9, y + 4, 14, 1, '#3a2a1d');
    }
  }
  // wall base / rubble at the back of the platform
  ctx.fillStyle = '#151011';
  ctx.fillRect(0, GROUND_Y - 4, 480, 3);
  ctx.fillStyle = '#2b2018';
  for (let x = 0; x < 480; x += 19) ctx.fillRect(x, GROUND_Y - 5, 7 + (x % 5), 2);
  // cracks
  const cr = mulberry32(567);
  for (let i = 0; i < 10; i++) {
    let x = cr() * 480;
    let y = GROUND_Y + 10 + cr() * 30;
    for (let s = 0; s < 9; s++) {
      px(ctx, x, y, 1, 1, '#0d0a08');
      x += -2 + cr() * 5;
      y += cr() * 2;
    }
  }
  // ash drifts on the floor
  for (let i = 0; i < 90; i++) {
    px(ctx, cr() * 480, GROUND_Y + 4 + cr() * 38, 1, 1, cr() < 0.5 ? '#3a2f24' : '#241c15');
  }

  // fire braziers at the arena sides
  const brazier = (bx, by, scale) => {
    ctx.fillStyle = '#2b2320';
    ctx.fillRect(bx - 3 * scale, by, 6 * scale, 18 * scale);
    ctx.fillStyle = '#3d2f22';
    ctx.fillRect(bx - 3 * scale, by, 2 * scale, 18 * scale);
    ctx.fillStyle = '#575e66';
    ctx.fillRect(bx - 10 * scale, by - 5 * scale, 20 * scale, 6 * scale);
    ctx.fillStyle = '#3a3233';
    ctx.fillRect(bx - 8 * scale, by - 3 * scale, 16 * scale, 3 * scale);
    ctx.fillStyle = '#6d2a18';
    ctx.fillRect(bx - 6 * scale, by - 5 * scale, 12 * scale, 2 * scale);
    ctx.fillStyle = '#e0622a';
    ctx.fillRect(bx - 4 * scale, by - 6 * scale, 8 * scale, 1 * scale);
    // base plinth
    ctx.fillStyle = '#242020';
    ctx.fillRect(bx - 7 * scale, by + 18 * scale, 14 * scale, 4 * scale);
  };
  brazier(74, 196, 1.1);
  brazier(408, 190, 1);

  // foreground framing rocks / broken pillars at the very edges
  ctx.fillStyle = '#0d0a09';
  fillPoly(ctx, [0, 270, 0, 214, 10, 206, 18, 226, 26, 270], '#151011');
  fillPoly(ctx, [480, 270, 480, 208, 468, 200, 458, 226, 452, 270], '#151011');
  px(ctx, 3, 214, 6, 2, '#3b302b');
  px(ctx, 464, 204, 8, 2, '#3b302b');

  quantize(c, BG_PALETTE);
  return c;
}

// ------------------------------------------------------------------- Kratos
const SKIN = '#c9b39e';
const SKIN_D = '#8b7563';
const SKIN_DD = '#5c4a3f';
const SKIN_H = '#eddcc3';
const LEATHER = '#3a2a24';
const LEATHER_L = '#5a4133';
const RED = '#a3221b';
const RED_D = '#6d1210';
const GOLD = '#d9ac63';
const GOLD_H = '#f8e6b4';
const STEEL = '#e6d3a5';
const STEEL_H = '#fffbee';
const STEEL_D = '#9c7228';
const DARK = '#1a1214';

function bladeShape(ctx, hx, hy, angle, len, flick = 0) {
  const tx = hx + Math.cos(angle) * len;
  const ty = hy + Math.sin(angle) * len;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const w = 2.6;
  // dark spine
  fillPoly(ctx, [hx + nx * w, hy + ny * w, tx - nx * 1.2, ty - ny * 1.2, tx + nx * 1.2, ty + ny * 1.2, hx - nx * w, hy - ny * w], DARK);
  // metal
  fillPoly(ctx, [hx + nx * (w - 0.8), hy + ny * (w - 0.8), tx, ty, hx + nx * 1.4, hy + ny * 1.4], STEEL_D);
  fillPoly(ctx, [hx + nx * 1.4, hy + ny * 1.4, tx, ty, hx - nx * 0.8, hy - ny * 0.8], STEEL);
  // hot edge
  line(ctx, hx + nx * 1.6, hy + ny * 1.6, tx, ty, STEEL_H, 1);
  // blood along the blade
  const bx = hx + (tx - hx) * 0.45;
  const by = hy + (ty - hy) * 0.45;
  px(ctx, bx, by, 2, 2, RED_D);
  px(ctx, bx + 2, by - 2, 2, 1, RED);
  // flame licking off the tip
  if (flick > 0) {
    const fl = 2 + flick * 3;
    px(ctx, tx + (Math.random() - 0.5) * 2, ty - fl, 1, fl + 1, '#ff9d3a');
    px(ctx, tx - 1, ty - fl - 2, 1, 2, '#ffd27a');
  }
}

export function drawKratos(ctx, p, time) {
  const speed = p.state === 'run';
  const attacking = p.state === 'attack';
  const heavy = p.state === 'heavy';
  const hurt = p.state === 'hurt';
  const dead = p.state === 'dead';
  const dash = p.state === 'dash';
  const air = !p.onGround;

  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));
  ctx.scale(p.facing, 1);
  const blink = p.invuln > 0 && Math.floor(time * 40) % 2 === 0 && !dead;
  if (blink) ctx.globalAlpha = 0.5;

  const bob = !air && !speed && !attacking ? Math.round(Math.sin(time * 3) * 0.7) : 0;
  const lean = speed ? 2 : dash ? 4 : attacking ? 1 : 0;
  const crouch = dead ? 8 : dash ? 4 : 0;
  ctx.translate(0, bob + crouch);

  // dark backing silhouette so he reads against the storm
  px(ctx, -10 + lean, -38, 21, 18, '#0f0a0c');
  px(ctx, -13 + lean, -40, 11, 10, '#0f0a0c');
  px(ctx, -1 + lean, -51, 11, 12, '#0f0a0c');
  px(ctx, -8, -22, 17, 7, '#0f0a0c');

  // --- legs
  const phase = p.walkPhase;
  let lfx = -5, lfy = 0, rfx = 5, rfy = 0;
  if (speed) {
    lfx = -5 + Math.sin(phase) * 4;
    rfx = 5 - Math.sin(phase) * 4;
    lfy = Math.max(0, -Math.sin(phase) * 4);
    rfy = Math.max(0, Math.sin(phase) * 4);
  } else if (air) {
    lfx = -6; lfy = 4; rfx = 6; rfy = 1;
  } else if (dash) {
    lfx = -9; rfx = 7;
  } else if (attacking || heavy) {
    lfx = -8; rfx = 6;
  }
  if (dead) { lfx = -10; rfx = 4; lfy = 6; rfy = 5; }

  // rear leg
  limb(ctx, -3, -16, lfx - 1, -6, LEATHER, 4, DARK);
  limb(ctx, lfx - 1, -6, lfx, 0 - lfy, LEATHER, 3, DARK);
  px(ctx, lfx - 2, -1 - lfy, 5, 2, '#221a16');
  // front leg
  limb(ctx, 3, -16, rfx + 1, -6, LEATHER_L, 4, DARK);
  limb(ctx, rfx + 1, -6, rfx + (speed ? Math.sin(phase) * 1 : 0), 0 - rfy, LEATHER_L, 3, DARK);
  px(ctx, rfx - 1, -1 - rfy, 5, 2, '#2c221c');
  // gold greave highlights
  px(ctx, rfx - 1, -8 - rfy, 3, 1, GOLD);
  px(ctx, lfx - 1, -8 - lfy, 3, 1, STEEL_D);

  // --- skirt / loincloth
  for (let i = -4; i <= 4; i++) {
    const h = 8 + ((i * 7) % 3);
    px(ctx, i * 2 - 1, -22, 2, h, i % 2 ? LEATHER : '#4a1a16');
  }
  px(ctx, -8, -24, 16, 3, RED_D);
  px(ctx, -8, -24, 16, 1, '#c43622');
  px(ctx, -2, -24, 3, 2, GOLD);

  // --- torso
  px(ctx, -9 + lean, -37, 19, 1, '#1a1214');
  px(ctx, -9 + lean, -37, 1, 16, '#1a1214');
  px(ctx, 9 + lean, -36, 1, 15, '#1a1214');
  px(ctx, -8 + lean, -36, 17, 14, SKIN);
  px(ctx, -8 + lean, -36, 4, 14, SKIN_H);
  px(ctx, -8 + lean, -24, 17, 2, SKIN_D);
  // chest shadow + abs suggestion
  px(ctx, 2 + lean, -33, 6, 9, SKIN_D);
  px(ctx, -1 + lean, -29, 6, 1, SKIN_D);
  px(ctx, -1 + lean, -26, 6, 1, SKIN_D);
  // red war paint
  px(ctx, -6 + lean, -34, 3, 9, RED);
  px(ctx, -6 + lean, -34, 1, 9, '#cf5138');
  px(ctx, -3 + lean, -28, 4, 2, RED);
  // belt
  px(ctx, -9 + lean, -23, 18, 3, '#2b1c16');
  px(ctx, -9 + lean, -23, 18, 1, '#6b4a2e');
  px(ctx, 2 + lean, -22, 4, 2, GOLD);
  px(ctx, 3 + lean, -22, 2, 1, GOLD_H);

  // --- shoulders
  // back shoulder
  px(ctx, -12 + lean, -37, 7, 8, SKIN_D);
  px(ctx, -12 + lean, -37, 2, 8, SKIN_DD);
  // front pauldron
  px(ctx, 4 + lean, -39, 9, 8, '#3a2a1e');
  px(ctx, 4 + lean, -39, 9, 2, GOLD);
  px(ctx, 4 + lean, -38, 2, 6, GOLD_H);
  px(ctx, 11 + lean, -36, 2, 4, STEEL_D);
  // spine tattoo / ash
  px(ctx, -2 + lean, -36, 1, 4, '#d8c4ab');

  // --- head
  const headX = 0 + lean;
  const headY = -49;
  px(ctx, headX - 4, headY, 9, 9, SKIN);
  px(ctx, headX - 4, headY, 3, 9, SKIN_H);
  px(ctx, headX + 3, headY + 2, 2, 6, SKIN_D);
  // beard
  px(ctx, headX - 4, headY + 7, 9, 3, '#2f282a');
  px(ctx, headX - 4, headY + 9, 6, 2, '#3a3233');
  px(ctx, headX - 3, headY + 7, 7, 1, '#4a4242');
  // tattoo stripe over the left eye
  px(ctx, headX - 1, headY - 1, 2, 6, RED);
  px(ctx, headX - 1, headY + 1, 1, 4, '#cf5138');
  px(ctx, headX + 1, headY + 6, 2, 2, RED_D);
  // eye + brow
  px(ctx, headX + 1, headY + 3, 3, 1, DARK);
  px(ctx, headX + 2, headY + 4, 2, 1, '#f0dfc9');
  px(ctx, headX + 3, headY + 4, 1, 1, '#1a1214');
  // skull shading, scar
  px(ctx, headX + 3, headY + 1, 1, 3, SKIN_D);
  px(ctx, headX - 3, headY + 2, 1, 1, '#5a1c18');
  px(ctx, headX - 2, headY + 4, 1, 2, '#5a1c18');

  // --- arms + blades
  const shoulder = { x: 7 + lean, y: -35 };
  let handF = { x: 12, y: -26 };
  let handB = { x: -10, y: -26 };
  let angF = 1.5;
  let angB = 2.3;
  const flick = attacking || heavy ? 1 : 0;

  if (attacking) {
    const ap = clamp(p.attackT / p.attackDur, 0, 1);
    const swing = Math.sin(ap * Math.PI);
    if (p.attackStep === 0) {
      handF = { x: 12 + swing * 12, y: -30 - swing * 2 };
      angF = -0.5 + swing * 1.6;
      handB = { x: -9, y: -24 };
      angB = 2.4;
    } else if (p.attackStep === 1) {
      handF = { x: 9 - swing * 2, y: -42 - swing * 2 };
      angF = -1.9 + swing * 2.6;
      handB = { x: -10 - swing * 6, y: -30 };
      angB = 3.6 - swing * 1.2;
    } else {
      handF = { x: 11 + swing * 14, y: -27 - swing * 4 };
      angF = -0.9 + swing * 2.2;
      handB = { x: 4 + swing * 10, y: -32 - swing * 6 };
      angB = -1.1 + swing * 2.0;
    }
  } else if (heavy) {
    const ap = clamp(p.attackT / p.attackDur, 0, 1);
    const raise = Math.min(1, ap * 2.6);
    const slam = Math.max(0, (ap - 0.42) * 2.2);
    handF = { x: 9 + slam * 8, y: -38 - raise * 10 + slam * 25 };
    angF = raise > 0.75 ? 1.4 + slam * 1.2 : -1.2;
    handB = { x: 2 + slam * 6, y: -36 - raise * 8 + slam * 22 };
    angB = raise > 0.75 ? 1.2 + slam * 1.3 : -1.5;
  } else if (air) {
    handF = { x: 13, y: -34 };
    angF = -0.2;
    handB = { x: -13, y: -34 };
    angB = 3.4;
  } else if (speed) {
    handF = { x: 13, y: -24 - Math.sin(phase) * 2 };
    angF = 2.1;
    handB = { x: -12, y: -24 + Math.sin(phase) * 2 };
    angB = 2.7;
  } else if (dead) {
    handF = { x: 11, y: -8 };
    angF = 1.7;
    handB = { x: -12, y: -10 };
    angB = 2.1;
  } else if (hurt) {
    handF = { x: 14, y: -32 };
    angF = 2.3;
    handB = { x: -11, y: -30 };
    angB = 2.9;
  }

  // back arm first
  limb(ctx, shoulder.x - 12, shoulder.y - 1, handB.x, handB.y, SKIN_D, 3, DARK);
  px(ctx, handB.x - 2, handB.y - 2, 4, 4, LEATHER);
  px(ctx, handB.x - 2, handB.y - 2, 4, 1, '#7c4a2a');
  bladeShape(ctx, handB.x, handB.y, angB, 20, flick * 0.6);

  // front arm
  limb(ctx, shoulder.x, shoulder.y, handF.x, handF.y, SKIN, 4, DARK);
  px(ctx, handF.x - 1, handF.y - 2, 4, 4, LEATHER_L);
  px(ctx, handF.x - 1, handF.y - 2, 4, 1, '#8a5a34');
  bladeShape(ctx, handF.x, handF.y, angF, 23, flick);

  // fiery arc during swings
  if (attacking || heavy) {
    const ap = clamp(p.attackT / p.attackDur, 0, 1);
    const baseAngle = p.attackStep === 0 ? -0.8 : p.attackStep === 1 ? -1.9 : -1.1;
    const sweep = p.attackStep === 1 ? 2.8 : 2.4;
    const cur = baseAngle + sweep * ap;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const a = cur - i * 0.13;
      if (a < baseAngle) break;
      const r = 22 + i * 0.5;
      const pxr = shoulder.x + Math.cos(a) * r;
      const pyr = shoulder.y + Math.sin(a) * r;
      ctx.globalAlpha = (1 - i / 12) * 0.55;
      px(ctx, pxr, pyr, 2, 2, i < 4 ? '#ffe6a0' : i < 8 ? '#ffab3c' : '#c43622');
    }
    ctx.restore();
  }

  // rage aura
  if (p.rage >= 100) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + Math.sin(time * 12) * 0.1;
    glow(ctx, 0, -26, 26, '#ff5a1e', 0.4, 4);
    ctx.restore();
  }
  if (p.hitFlash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = Math.min(0.65, p.hitFlash * 2);
    ctx.fillStyle = '#ff3a1a';
    ctx.fillRect(-20, -56, 40, 60);
  }
  ctx.restore();
}

// ------------------------------------------------------------- legionnaire
export function drawLegionnaire(ctx, e, time) {
  ctx.save();
  ctx.translate(Math.round(e.x), Math.round(e.y));
  ctx.scale(e.facing, 1);
  if (e.hurtT > 0 && Math.floor(time * 40) % 2 === 0) ctx.globalAlpha = 0.65;
  if (e.spawnT > 0) ctx.globalAlpha = clamp(1 - e.spawnT / 0.45, 0.15, 1);

  const walk = Math.sin(e.walkPhase);
  const atk = e.state === 'windup' ? Math.min(1, e.stateT / 0.35) : e.state === 'strike' ? 1 : 0;
  const dead = e.state === 'dying';
  const lean = dead ? 0 : e.state === 'strike' ? 3 : 0;

  // legs
  const lx = dead ? -8 : walk * 2.5;
  const rx = dead ? 4 : -walk * 2.5;
  limb(ctx, -3, -14, -4 + lx, 0, '#8d8072', 3, '#211a1b');
  limb(ctx, 3, -14, 4 + rx, 0, '#a4947e', 3, '#211a1b');
  px(ctx, -6 + lx, -1, 5, 2, '#3a3233');
  px(ctx, 2 + rx, -1, 5, 2, '#3a3233');

  // tattered skirt
  for (let i = -3; i <= 3; i++) {
    px(ctx, i * 2 - 1, -18, 2, 5 + ((i * 5) % 3), i % 2 ? '#6d1210' : '#4a1a16');
  }
  // ribcage
  px(ctx, -6 + lean, -28, 12, 11, '#3a3233');
  px(ctx, -5 + lean, -27, 10, 9, '#b9a99a');
  for (let i = 0; i < 3; i++) px(ctx, -5 + lean, -26 + i * 3, 9, 1, '#5c4a3f');
  px(ctx, -1 + lean, -25, 1, 7, '#2a2020');
  // breastplate fragment
  px(ctx, -7 + lean, -29, 4, 7, '#2c2320');
  px(ctx, -7 + lean, -29, 4, 1, '#6b4a2e');

  // arms + sword
  const sh = { x: 5 + lean, y: -28 };
  let hand = { x: 9, y: -18 };
  let ang = 2.2;
  if (atk > 0) {
    if (e.state === 'windup') {
      hand = { x: 6, y: -36 - atk * 3 };
      ang = -1.2;
    } else {
      hand = { x: 12, y: -22 };
      ang = 0.15;
    }
  }
  limb(ctx, sh.x, sh.y, hand.x, hand.y, '#b9a99a', 3, '#211a1b');
  px(ctx, hand.x - 2, hand.y - 2, 4, 4, '#3a2a1e');
  // rusty sword
  const tx2 = hand.x + Math.cos(ang) * 17;
  const ty2 = hand.y + Math.sin(ang) * 17;
  line(ctx, hand.x, hand.y, tx2, ty2, '#575e66', 2);
  line(ctx, hand.x, hand.y, tx2, ty2, '#8d8072', 1);
  px(ctx, tx2, ty2, 2, 2, '#cbb694');
  // shield on the back arm
  px(ctx, -11 + lean, -27, 6, 10, '#2c2320');
  px(ctx, -11 + lean, -27, 6, 1, '#6b4a2e');
  px(ctx, -9 + lean, -24, 2, 2, '#6d1210');

  // skull head with helm
  const hx = lean;
  px(ctx, hx - 3, -39, 7, 7, '#cbb694');
  px(ctx, hx - 3, -39, 2, 7, '#dcc7a2');
  px(ctx, hx + 1, -36, 2, 2, '#2a2020');
  px(ctx, hx + 2, -35, 1, 1, '#e04b2a');
  px(ctx, hx + 3, -36, 1, 1, '#e04b2a');
  px(ctx, hx - 2, -36, 2, 1, '#2a2020');
  px(ctx, hx - 3, -33, 7, 2, '#8d8072');
  // helmet
  px(ctx, hx - 4, -42, 8, 4, '#463d3d');
  px(ctx, hx - 4, -42, 8, 1, '#6b4a2e');
  px(ctx, hx - 5, -40, 2, 3, '#6b4a2e');
  px(ctx, hx + 3, -40, 2, 3, '#6b4a2e');
  px(ctx, hx - 1, -43, 1, 5, '#2a2020');
  // horns
  px(ctx, hx - 6, -41, 2, 2, '#cbb694');
  px(ctx, hx + 5, -41, 2, 2, '#cbb694');
  px(ctx, hx - 7, -39, 2, 1, '#a4947e');
  px(ctx, hx + 6, -39, 2, 1, '#a4947e');

  if (e.hitFlash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = Math.min(0.75, e.hitFlash * 2.2);
    ctx.fillStyle = '#ff3a1a';
    ctx.fillRect(-20, -48, 40, 52);
  }
  ctx.restore();
}

// ----------------------------------------------------------------- harpy
export function drawHarpy(ctx, e, time) {
  ctx.save();
  ctx.translate(Math.round(e.x), Math.round(e.y));
  ctx.scale(e.facing, 1);
  if (e.hurtT > 0 && Math.floor(time * 40) % 2 === 0) ctx.globalAlpha = 0.65;
  if (e.spawnT > 0) ctx.globalAlpha = clamp(1 - e.spawnT / 0.45, 0.15, 1);

  const flap = Math.sin(time * 9 + e.seed) * 5;
  const dive = e.state === 'dive';
  const lean = dive ? 6 : 0;

  // wings (dark ragged)
  ctx.fillStyle = '#241a1e';
  fillPoly(ctx, [-2, -6, -26, -14 - flap, -20, -2 - flap, -4, 2], '#241a1e');
  fillPoly(ctx, [-4, -8, -22, -13 - flap, -17, -5 - flap, -5, -3], '#3a2a33');
  fillPoly(ctx, [2, -8, 20, -16 + flap, 16, -4 + flap, 4, 0], '#2c2026');
  fillPoly(ctx, [3, -9, 17, -14 + flap, 14, -6 + flap, 4, -2], '#463a42');
  // wing bones
  line(ctx, -3, -7, -20, -11 - flap, '#5c4a3f', 1);
  line(ctx, 3, -8, 16, -14 + flap, '#5c4a3f', 1);

  // body
  px(ctx, -4 + lean, -12, 8, 10, '#5c4a3f');
  px(ctx, -3 + lean, -12, 5, 9, '#8d8072');
  px(ctx, -3 + lean, -10, 3, 6, '#c9b39e');
  // tatters
  for (let i = 0; i < 4; i++) px(ctx, -3 + lean + i * 2, -3, 1, 2 + (i % 2), '#4a1a16');
  // head
  px(ctx, -2 + lean, -18, 6, 6, '#c9b39e');
  px(ctx, 1 + lean, -17, 2, 1, '#e04b2a');
  px(ctx, 0 + lean, -16, 1, 1, '#e04b2a');
  px(ctx, -3 + lean, -19, 5, 2, '#241a1e');
  px(ctx, -4 + lean, -18, 2, 3, '#241a1e');
  // talons
  const cl = dive ? 4 : 0;
  line(ctx, -2, -2, -5 - cl, 4 + cl, '#cbb694', 1);
  line(ctx, 2, -2, 5 + cl, 4 + cl, '#cbb694', 1);
  line(ctx, -5 - cl, 4 + cl, -7, 6 + cl, '#8d8072', 1);
  line(ctx, 5 + cl, 4 + cl, 7, 6 + cl, '#8d8072', 1);
  if (e.hitFlash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = Math.min(0.75, e.hitFlash * 2.2);
    ctx.fillStyle = '#ff3a1a';
    ctx.fillRect(-28, -22, 55, 32);
  }
  ctx.restore();
}

// --------------------------------------------------------------- minotaur
export function drawMinotaur(ctx, e, time) {
  ctx.save();
  ctx.translate(Math.round(e.x), Math.round(e.y));
  ctx.scale(e.facing, 1);
  if (e.hurtT > 0 && Math.floor(time * 40) % 2 === 0) ctx.globalAlpha = 0.7;
  if (e.spawnT > 0) ctx.globalAlpha = clamp(1 - e.spawnT / 0.6, 0.1, 1);

  const dead = e.state === 'dying';
  const walk = Math.sin(e.walkPhase);
  const charging = e.state === 'charge';
  const windup = e.state === 'windup';
  const slam = e.state === 'slam';
  const lean = dead ? 0 : charging ? 6 : windup ? -3 : 0;
  const crouch = slam ? 4 : 0;

  // legs
  const lx = dead ? -10 : walk * 5;
  const rx = dead ? 8 : -walk * 5;
  limb(ctx, -7, -20, -9 + lx, 0, '#6b3a35', 6, '#1a0f10');
  limb(ctx, 7, -20, 9 + rx, 0, '#7d4440', 6, '#1a0f10');
  px(ctx, -13 + lx, -2, 9, 3, '#241a1e');
  px(ctx, 4 + rx, -2, 9, 3, '#241a1e');
  // hooves
  px(ctx, -14 + lx, -4, 3, 3, '#cbb694');
  px(ctx, 5 + rx, -4, 3, 3, '#cbb694');

  // loincloth / belt
  px(ctx, -13, -26 - crouch, 26, 7, '#3a2a1e');
  px(ctx, -13, -26 - crouch, 26, 1, '#6b4a2e');
  for (let i = -5; i <= 5; i += 2) px(ctx, i * 2, -20 - crouch, 3, 6, i % 3 ? '#4a1a16' : '#6d1210');
  px(ctx, 2, -24 - crouch, 6, 4, '#b8894a');

  // torso
  px(ctx, -14 + lean, -44 - crouch, 28, 20, '#6b3a35');
  px(ctx, -14 + lean, -44 - crouch, 8, 20, '#8a4a42');
  px(ctx, 8 + lean, -44 - crouch, 6, 20, '#4d2825');
  // muscle shading
  px(ctx, -6 + lean, -40 - crouch, 12, 2, '#4d2825');
  px(ctx, -2 + lean, -36 - crouch, 4, 8, '#4d2825');
  px(ctx, -10 + lean, -32 - crouch, 6, 3, '#8a4a42');
  // war paint
  px(ctx, -9 + lean, -42 - crouch, 3, 10, '#c43622');
  px(ctx, 5 + lean, -38 - crouch, 6, 2, '#c43622');
  // chest strap
  fillPoly(ctx, [-12 + lean, -30 - crouch, -2 + lean, -44 - crouch, 6 + lean, -44 - crouch, 12 + lean, -36 - crouch, 12 + lean, -33 - crouch, 4 + lean, -41 - crouch, -8 + lean, -28 - crouch], '#2c2320');

  // arms
  const shY = -42 - crouch;
  let handL = { x: -18, y: -24 - crouch };
  let handR = { x: 18, y: -24 - crouch };
  let axeAng = 0.9;
  if (windup) {
    const w = Math.min(1, e.stateT / 0.5);
    handR = { x: 14, y: -52 - w * 6 };
    axeAng = -1.6;
    handL = { x: -18, y: -34 };
  } else if (slam) {
    const w = Math.min(1, e.stateT / 0.2);
    handR = { x: 16 + w * 6, y: -30 + w * 16 };
    axeAng = 1.2;
    handL = { x: -16, y: -22 };
  } else if (charging) {
    handR = { x: 22, y: -30 };
    axeAng = 0.4;
    handL = { x: -22, y: -30 };
  }
  // back arm
  limb(ctx, -12 + lean, shY, handL.x, handL.y, '#6b3a35', 5, '#1a0f10');
  // front arm
  limb(ctx, 12 + lean, shY, handR.x, handR.y, '#8a4a42', 6, '#1a0f10');
  px(ctx, handR.x - 2, handR.y - 2, 5, 5, '#2c2320');
  px(ctx, handL.x - 2, handL.y - 2, 5, 5, '#2c2320');

  // giant axe
  const ax = handR.x + Math.cos(axeAng) * 20;
  const ay = handR.y + Math.sin(axeAng) * 20;
  line(ctx, handR.x, handR.y, ax, ay, '#3a2a1e', 3);
  line(ctx, handR.x, handR.y, ax, ay, '#6b4a2e', 1);
  const nx = -Math.sin(axeAng);
  const ny = Math.cos(axeAng);
  fillPoly(ctx, [ax - nx * 9, ay - ny * 9, ax + nx * 9, ay + ny * 9, ax + nx * 9 + Math.cos(axeAng) * 8, ay + ny * 9 + Math.sin(axeAng) * 8, ax - nx * 9 + Math.cos(axeAng) * 6, ay - ny * 9 + Math.sin(axeAng) * 6], '#575e66');
  fillPoly(ctx, [ax - nx * 7, ay - ny * 7, ax + nx * 7, ay + ny * 7, ax + nx * 7 + Math.cos(axeAng) * 5, ay + ny * 7 + Math.sin(axeAng) * 5, ax - nx * 7 + Math.cos(axeAng) * 4, ay - ny * 7 + Math.sin(axeAng) * 4], '#8d8072');
  px(ctx, ax - nx * 8, ay - ny * 8, 2, 2, '#cbb694');
  px(ctx, ax + Math.cos(axeAng) * 6, ay + Math.sin(axeAng) * 6, 2, 2, '#5a1c18');

  // bull head
  const hy = -58 - crouch + (windup ? 1 : 0);
  px(ctx, -8 + lean, hy, 16, 14, '#5c3230');
  px(ctx, -8 + lean, hy, 5, 14, '#7d4440');
  px(ctx, 5 + lean, hy + 2, 4, 11, '#3d2020');
  // muzzle
  px(ctx, -1 + lean, hy + 8, 9, 7, '#8a5a4f');
  px(ctx, -1 + lean, hy + 8, 9, 2, '#a8756a');
  px(ctx, 5 + lean, hy + 10, 3, 3, '#3d1a18');
  px(ctx, 1 + lean, hy + 12, 5, 1, '#3d1a18');
  // nose ring
  ring(ctx, 4 + lean, hy + 12, 2, '#d9ac63');
  // eyes
  px(ctx, -5 + lean, hy + 4, 4, 2, '#2a0d0c');
  px(ctx, -4 + lean, hy + 4, 2, 2, '#ff6a32');
  px(ctx, 1 + lean, hy + 3, 4, 2, '#2a0d0c');
  px(ctx, 2 + lean, hy + 3, 2, 2, '#ff6a32');
  // horns
  fillPoly(ctx, [-8 + lean, hy + 2, -18 + lean, hy - 6, -16 + lean, hy - 9, -5 + lean, hy + 1], '#dcc7a2');
  fillPoly(ctx, [8 + lean, hy + 2, 18 + lean, hy - 6, 16 + lean, hy - 9, 5 + lean, hy + 1], '#cbb694');
  px(ctx, -15 + lean, hy - 6, 2, 2, '#f7e6c2');
  px(ctx, 15 + lean, hy - 6, 2, 2, '#f7e6c2');
  // ears
  px(ctx, -12 + lean, hy + 5, 4, 2, '#3d2020');
  px(ctx, 8 + lean, hy + 5, 4, 2, '#3d2020');

  if (windup) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4;
    glow(ctx, 0, hy + 4, 22, '#ff4a1e', 0.4, 4);
    ctx.restore();
  }
  if (e.hitFlash > 0) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = Math.min(0.7, e.hitFlash * 2);
    ctx.fillStyle = '#ff3a1a';
    ctx.fillRect(-30, -80, 60, 84);
  }
  ctx.restore();
}
