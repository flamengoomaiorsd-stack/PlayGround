// Tiny pixel-art toolkit: integer drawing, bitmap fonts, palette quantisation.
export const W = 480;
export const H = 270;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return c;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function ring(ctx, cx, cy, r, color, width = 1) {
  // pixelated circle outline
  ctx.fillStyle = color;
  const steps = Math.max(8, Math.round(r * 7));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    ctx.fillRect(x, y, width, width);
  }
}

export function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  const r2 = r * r;
  for (let y = -r; y <= r; y++) {
    const span = Math.floor(Math.sqrt(Math.max(0, r2 - y * y)));
    ctx.fillRect(Math.round(cx - span), Math.round(cy + y), span * 2 + 1, 1);
  }
}

// Stepped glow (no smooth gradients) so it stays in the pixel language.
export function glow(ctx, cx, cy, radius, color, alpha = 0.5, steps = 5) {
  ctx.save();
  for (let i = steps - 1; i >= 0; i--) {
    const t = (i + 1) / steps;
    ctx.globalAlpha = (alpha / steps) * (1.15 - t * 0.4);
    disc(ctx, cx, cy, Math.round(radius * t), color);
  }
  ctx.restore();
}

export function fillPoly(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------- 5x7 font
const G = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '#....', '####.', '....#', '....#', '####.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '...#.', '..#..', '..#..', '.#...', '#....', '.....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '\u2190': ['.....', '..#..', '.#...', '#####', '.#...', '..#..', '.....'],
  '\u2192': ['.....', '..#..', '...#.', '#####', '...#.', '..#..', '.....'],
  '\u2191': ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..'],
  '\u2193': ['..#..', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'],
  '\u00d7': ['.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '.....'],
  '\u00b7': ['.....', '.....', '.....', '..#..', '.....', '.....', '.....'],
  '\u25c6': ['..#..', '.###.', '#####', '.###.', '..#..', '.....', '.....'],
};

const textCache = new Map();

export function measureText(str, scale = 1, spacing = 1) {
  if (!str) return 0;
  let w = 0;
  for (const ch of str) w += (G[ch] ? 5 : 5) * scale + spacing * scale;
  return w - spacing * scale;
}

function buildText(str, scale, color, spacing, outline, shadow, alpha) {
  const w = measureText(str, scale, spacing) + (outline ? scale * 2 : 0) + (shadow ? scale * 2 : 0);
  const h = 7 * scale + (outline ? scale * 2 : 0) + (shadow ? scale * 2 : 0);
  const c = makeCanvas(Math.max(1, w), Math.max(1, h));
  const x0 = outline ? scale : 0;
  const y0 = outline ? scale : 0;
  const ctx = c.getContext('2d');
  ctx.globalAlpha = alpha;
  let cx = x0;
  for (const ch of str) {
    const glyph = G[ch];
    if (glyph) {
      if (outline) {
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
          drawGlyph(ctx, glyph, cx + ox * scale, y0 + oy * scale, scale, outline);
        }
      }
      if (shadow) drawGlyph(ctx, glyph, cx + scale * 2, y0 + scale * 2, scale, shadow);
      drawGlyph(ctx, glyph, cx, y0, scale, color);
    }
    cx += 5 * scale + spacing * scale;
  }
  return c;
}

function drawGlyph(ctx, glyph, x, y, scale, color) {
  ctx.fillStyle = color;
  for (let row = 0; row < 7; row++) {
    const line = glyph[row];
    for (let col = 0; col < 5; col++) {
      if (line[col] === '#') ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}

export function drawText(ctx, str, x, y, opts = {}) {
  const scale = opts.scale ?? 1;
  const color = opts.color ?? '#e8dfd0';
  const spacing = opts.spacing ?? 1;
  const outline = opts.outline ?? null;
  const shadow = opts.shadow ?? null;
  const alpha = opts.alpha ?? 1;
  const align = opts.align ?? 'left';
  const upper = opts.raw ? str : String(str).toUpperCase();
  const width = measureText(upper, scale, spacing);
  let dx = x;
  if (align === 'center') dx = x - width / 2;
  else if (align === 'right') dx = x - width;
  const key = `${upper}|${scale}|${color}|${spacing}|${outline}|${shadow}|${alpha}`;
  let c = textCache.get(key);
  if (!c) {
    c = buildText(upper, scale, color, spacing, outline, shadow, alpha);
    textCache.set(key, c);
  }
  const pad = (outline ? scale : 0);
  ctx.drawImage(c, Math.round(dx) - pad, Math.round(y) - pad);
  return c.width;
}

// ------------------------------------------------ decorative title lettering
// Wide, serif-flavoured glyphs used only for the blood logo.
export const LOGO_FONT = {
  G: [
    '..######..',
    '.##....##.',
    '##......##',
    '##........',
    '##....####',
    '##......##',
    '##......##',
    '.##....##.',
    '..######..',
    '..........',
  ],
  O: [
    '..######..',
    '.##....##.',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '.##....##.',
    '..######..',
    '..........',
  ],
  D: [
    '#######...',
    '##.....##.',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '##......##',
    '##.....##.',
    '#######...',
    '..........',
  ],
  F: [
    '##########',
    '##........',
    '##........',
    '##........',
    '#######...',
    '##........',
    '##........',
    '##........',
    '##........',
    '..........',
  ],
  W: [
    '##......##',
    '##......##',
    '##......##',
    '##..##..##',
    '##..##..##',
    '##.####.##',
    '.###..###.',
    '###....###',
    '##......##',
    '..........',
  ],
  A: [
    '...####...',
    '..######..',
    '.##....##.',
    '##......##',
    '##......##',
    '##########',
    '##......##',
    '##......##',
    '##......##',
    '..........',
  ],
  R: [
    '#######...',
    '##....##..',
    '##.....##.',
    '##....##..',
    '#######...',
    '##...##...',
    '##....##..',
    '##.....##.',
    '##......##',
    '..........',
  ],
  I: [
    '..######..',
    '....##....',
    '....##....',
    '....##....',
    '....##....',
    '....##....',
    '....##....',
    '....##....',
    '..######..',
    '..........',
  ],
  V: [
    '##......##',
    '##......##',
    '##......##',
    '.##....##.',
    '.##....##.',
    '..##..##..',
    '..######..',
    '...####...',
    '....##....',
    '..........',
  ],
  ' ': ['....', '....', '....', '....', '....', '....', '....', '....', '....', '....'],
};

export const LOGO_W = 10;
export const LOGO_H = 9;
export const LOGO_GAP = 2;

export function logoWidth(str, scale = 1) {
  let w = 0;
  for (const ch of str) {
    w += (ch === ' ' ? 4 : LOGO_W) * scale + LOGO_GAP * scale;
  }
  return w - LOGO_GAP * scale;
}

export function drawLogo(ctx, str, x, y, scale, colors) {
  let cx = x;
  for (const ch of str) {
    const glyph = LOGO_FONT[ch];
    const gw = ch === ' ' ? 4 : LOGO_W;
    if (glyph) {
      for (let row = 0; row < glyph.length; row++) {
        for (let col = 0; col < gw; col++) {
          if (glyph[row][col] === '#') {
            ctx.fillStyle = colors[row] || colors[colors.length - 1];
            ctx.fillRect(Math.round(cx + col * scale), Math.round(y + row * scale), scale, scale);
          }
        }
      }
    }
    cx += (gw + LOGO_GAP) * scale;
  }
  return cx - LOGO_GAP * scale;
}

export function logoOutline(ctx, str, x, y, scale, color) {
  let cx = x;
  ctx.fillStyle = color;
  for (const ch of str) {
    const glyph = LOGO_FONT[ch];
    const gw = ch === ' ' ? 4 : LOGO_W;
    if (glyph) {
      for (let row = 0; row < glyph.length; row++) {
        for (let col = 0; col < gw; col++) {
          if (glyph[row][col] === '#') {
            const gx = Math.round(cx + col * scale);
            const gy = Math.round(y + row * scale);
            ctx.fillRect(gx - scale, gy, scale, scale);
            ctx.fillRect(gx + scale, gy, scale, scale);
            ctx.fillRect(gx, gy - scale, scale, scale);
            ctx.fillRect(gx, gy + scale, scale, scale);
          }
        }
      }
    }
    cx += (gw + LOGO_GAP) * scale;
  }
  return cx - LOGO_GAP * scale;
}

// ---------------------------------------------------------- quantisation
// Snap every pixel of a canvas to the nearest colour of a palette.
// Kills antialiasing so shapes read as crisp pixel art.
export function quantize(canvas, palette) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const pal = palette.map((hex) => {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, hex.startsWith('#') && hex.length === 9 ? parseInt(hex.slice(7), 16) : 255];
  });
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 24) continue;
    let best = 0;
    let bestD = Infinity;
    for (let p = 0; p < pal.length; p++) {
      const dr = d[i] - pal[p][0];
      const dg = d[i + 1] - pal[p][1];
      const db = d[i + 2] - pal[p][2];
      const dd = dr * dr * 1.15 + dg * dg * 1.5 + db * db * 0.75;
      if (dd < bestD) { bestD = dd; best = p; }
    }
    d[i] = pal[best][0];
    d[i + 1] = pal[best][1];
    d[i + 2] = pal[best][2];
  }
  ctx.putImageData(img, 0, 0);
}
