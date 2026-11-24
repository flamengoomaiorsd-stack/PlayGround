// Title-screen set dressing: storm sky, Kratos bust, Blades of Chaos, blood logo.
import {
  makeCanvas, mulberry32, px, disc, glow, fillPoly, quantize,
  drawText, drawLogo, logoOutline, logoWidth, LOGO_FONT, clamp,
} from './pixel.js';

export const TITLE = { w: 480, h: 270 };

const SKY_PALETTE = [
  '#04050a', '#070a0f', '#0b0e14', '#10141b', '#151a22', '#1b212b',
  '#232a34', '#2c343f', '#38414b', '#454e58', '#555d66', '#686e73',
  '#7c7b78', '#918b82', '#a69c8e', '#bba994', '#cfb89f', '#e2c9ab',
  '#f0d9b7', '#f9e9c7', '#fff3d8', '#6a4b38', '#4a3527', '#2c1f18',
  '#3a1a15', '#5a2418', '#7c3a22',
];

const FIGURE_PALETTE = [
  '#05050a', '#0b090d', '#121015', '#191519', '#211c1f', '#292325',
  '#322b2d', '#3d3536', '#4b4142', '#5a4e4c', '#6a5b56', '#7b6a62',
  '#8d7a6e', '#9f8a7b', '#b09a88', '#c1aa95', '#d1baa3', '#e0cbb2',
  '#eedcc2', '#f9ead2', '#fff5e0',
  '#3d1a18', '#5a1c18', '#77211b', '#962a20', '#b33a28', '#cf5138',
  '#4c3a24', '#6b512c', '#8a6a38', '#a98645', '#c9a45a', '#e6c47a',
  '#fff0bd', '#6b3a22', '#94552c', '#c07a3a',
];

const BANNER_PALETTE = [
  '#160406', '#240507', '#320809', '#420b0c', '#520d0d', '#650f0e',
  '#7a1310', '#8f1812', '#a51f17', '#b92b1c', '#cc3c25', '#dd5230',
  '#0d0304', '#070203',
];

function polygonOutline(ctx, pts, color, r = 1) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
    fillPoly(ctx, pts.map((v, i) => v + (i % 2 === 0 ? dx * r : dy * r)), color);
  }
}

function thickStroke(ctx, points, widths, color) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const w0 = widths[i] / 2;
    const w1 = widths[i + 1] / 2;
    fillPoly(ctx, [
      x0 + nx * w0, y0 + ny * w0,
      x0 - nx * w0, y0 - ny * w0,
      x1 - nx * w1, y1 - ny * w1,
      x1 + nx * w1, y1 + ny * w1,
    ], color);
  }
}

// ------------------------------------------------------------ storm backdrop
function buildSky() {
  const c = makeCanvas(240, 135);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(1337);

  const grad = ctx.createLinearGradient(0, 0, 0, 135);
  grad.addColorStop(0, '#04060b');
  grad.addColorStop(0.3, '#101720');
  grad.addColorStop(0.52, '#262d37');
  grad.addColorStop(0.68, '#4f4a44');
  grad.addColorStop(0.8, '#8e7256');
  grad.addColorStop(0.88, '#4a3524');
  grad.addColorStop(1, '#171009');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 240, 135);

  // hard break of sun behind Kratos' shoulder
  const sun = ctx.createRadialGradient(224, 70, 2, 224, 70, 52);
  sun.addColorStop(0, 'rgba(255,248,220,0.98)');
  sun.addColorStop(0.12, 'rgba(255,235,186,0.86)');
  sun.addColorStop(0.34, 'rgba(236,192,132,0.34)');
  sun.addColorStop(1, 'rgba(170,110,64,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 240, 135);

  // heavy storm clouds
  const cloud = (cx, cy, rx, ry, color, alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    for (let i = 0; i < 10; i++) {
      const ox = (rnd() - 0.5) * rx * 1.6;
      const oy = (rnd() - 0.5) * ry * 1.5;
      const r = rx * (0.25 + rnd() * 0.4);
      ctx.beginPath();
      ctx.ellipse(cx + ox, cy + oy, r, r * (0.32 + rnd() * 0.3), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  for (let i = 0; i < 80; i++) {
    cloud(rnd() * 250 - 5, rnd() * 90, 20 + rnd() * 34, 7 + rnd() * 14, rnd() < 0.75 ? '#0b1119' : '#3b4550', 0.28 + rnd() * 0.28);
  }
  // storm ceiling
  for (let i = 0; i < 26; i++) {
    cloud(rnd() * 240, rnd() * 24, 28 + rnd() * 46, 8 + rnd() * 14, '#05080d', 0.5);
  }
  // burning cloud edges around the sun
  for (let i = 0; i < 16; i++) {
    cloud(200 + rnd() * 60, 34 + rnd() * 70, 12 + rnd() * 26, 4 + rnd() * 9, '#c08a56', 0.10 + rnd() * 0.13);
  }

  // mountains
  const ridge = (baseY, color, amp, step) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 140);
    for (let x = 0; x <= 240; x += step) {
      const y = baseY + Math.sin(x * 0.12) * amp + Math.sin(x * 0.038 + 2) * amp * 0.8 + rnd() * 2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(240, 140);
    ctx.closePath();
    ctx.fill();
  };
  ridge(96, '#4b463f', 5, 6);
  ridge(103, '#332f2b', 6, 5);

  // broken temple silhouettes
  ctx.fillStyle = '#1e1a18';
  for (const [bx, by, n, cw, chh] of [[20, 104, 5, 4, 24], [50, 99, 7, 3, 30], [148, 103, 4, 4, 22]]) {
    ctx.fillRect(bx - 3, by, n * (cw + 1) + 4, 3);
    for (let i = 0; i < n; i++) {
      const x = bx + i * (cw + 1);
      ctx.fillRect(x, by + 3, cw, chh);
      ctx.fillRect(x + cw / 2 - 0.5, by + 3, 1, chh);
    }
  }
  // ruined arch
  ctx.fillStyle = '#151210';
  ctx.beginPath();
  ctx.arc(120, 118, 12, Math.PI, Math.PI * 2);
  ctx.fillRect(108, 118, 3, 14);
  ctx.fillRect(129, 118, 3, 14);
  ctx.fill();

  // film grain / ash texture so the sky reads as pixel art, not a blur
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(rnd() * 240);
    const y = Math.floor(rnd() * 135);
    const r = rnd();
    ctx.fillStyle = r < 0.33 ? '#1b212b' : r < 0.66 ? '#575d66' : '#8f8378';
    ctx.globalAlpha = 0.10 + rnd() * 0.14;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;

  // ground haze
  const hz = ctx.createLinearGradient(0, 104, 0, 135);
  hz.addColorStop(0, 'rgba(8,6,6,0)');
  hz.addColorStop(1, 'rgba(5,4,5,0.96)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, 102, 240, 33);

  quantize(c, SKY_PALETTE);
  return c;
}

// ---------------------------------------------------------------- Kratos bust
function buildKratos() {
  const c = makeCanvas(480, 270);
  const ctx = c.getContext('2d');

  const INK = '#0a0809';
  const SKIN = '#b09a88';
  const SKIN_L = '#d1baa3';
  const SKIN_H = '#eedcc2';
  const SKIN_D = '#7b6a62';
  const SKIN_DD = '#4b4142';
  const RED = '#962a20';
  const RED_L = '#c9482f';
  const RED_D = '#5a1c18';

  // ------------------------------------------------ torso and shoulders
  const shoulders = [
    258, 270, 278, 246, 298, 228, 318, 216, 340, 207, 360, 200, 380, 197,
    398, 196, 416, 199, 436, 204, 454, 213, 468, 226, 480, 244, 484, 270,
  ];
  polygonOutline(ctx, shoulders, INK, 2);
  fillPoly(ctx, shoulders, '#4b4142');

  // left deltoid (lit side)
  const deltoid = [280, 270, 296, 243, 318, 224, 340, 213, 356, 209, 364, 218, 364, 238, 350, 258, 340, 270];
  fillPoly(ctx, deltoid, '#8d7a6e');
  fillPoly(ctx, [292, 270, 306, 246, 326, 229, 344, 220, 352, 224, 350, 240, 338, 258, 330, 270], '#b09a88');
  fillPoly(ctx, [302, 270, 314, 250, 330, 236, 342, 229, 344, 234, 336, 246, 326, 262, 322, 270], '#c1aa95');
  // deltoid muscle ridges
  ctx.globalAlpha = 0.55;
  fillPoly(ctx, [308, 258, 322, 238, 334, 230, 338, 242, 326, 256, 316, 266], '#7b6a62');
  fillPoly(ctx, [286, 262, 300, 240, 310, 234, 306, 248, 296, 264], '#6a5b56');
  ctx.globalAlpha = 1;

  // right shoulder, lost in shadow
  fillPoly(ctx, [416, 270, 420, 236, 432, 220, 450, 216, 466, 228, 476, 248, 480, 270], '#322b2d');
  fillPoly(ctx, [430, 270, 434, 242, 444, 228, 456, 226, 464, 240, 468, 270], '#292325');

  // chest plate / pecs
  fillPoly(ctx, [336, 270, 348, 246, 362, 230, 382, 222, 402, 226, 412, 240, 414, 270], '#5a4e4c');
  fillPoly(ctx, [350, 270, 360, 248, 374, 234, 392, 229, 402, 234, 404, 248, 394, 266, 386, 270], '#3d3536');
  fillPoly(ctx, [344, 262, 356, 242, 370, 232, 380, 234, 370, 246, 360, 262, 356, 270], '#6a5b56');
  // sternum / collar shadow
  fillPoly(ctx, [366, 228, 384, 222, 400, 226, 402, 232, 384, 231, 368, 237], '#292325');
  fillPoly(ctx, [364, 214, 392, 208, 414, 214, 416, 222, 390, 218, 368, 222], '#3d3536');

  // leather harness over the left shoulder
  polygonOutline(ctx, [324, 270, 340, 238, 350, 216, 366, 206, 378, 205, 382, 211, 368, 220, 356, 244, 348, 270], INK, 1);
  fillPoly(ctx, [326, 270, 342, 240, 352, 218, 366, 208, 376, 207, 376, 214, 362, 224, 352, 246, 344, 270], '#3a281c');
  fillPoly(ctx, [330, 270, 344, 244, 354, 222, 366, 212, 372, 212, 360, 226, 350, 250, 340, 270], '#5a4130');
  // buckle
  fillPoly(ctx, [356, 220, 368, 214, 372, 222, 360, 228], '#8a6a38');
  px(ctx, 360, 217, 5, 4, '#e6c47a');
  px(ctx, 361, 218, 3, 2, '#fff0bd');

  // red war paint over the chest + shoulder
  thickStroke(ctx, [[292, 258], [310, 236], [334, 220], [356, 214]], [10, 13, 11, 7], RED_D);
  thickStroke(ctx, [[294, 257], [311, 237], [333, 221], [353, 216]], [7, 9, 8, 5], RED);
  thickStroke(ctx, [[296, 256], [312, 238], [332, 223]], [3, 4, 3], RED_L);
  thickStroke(ctx, [[368, 238], [390, 228], [408, 222]], [8, 9, 5], RED_D);
  thickStroke(ctx, [[369, 237], [389, 228], [405, 223]], [5, 6, 4], RED);
  px(ctx, 380, 230, 9, 2, RED_L);

  // ash streaks over the skin
  const ashRnd = mulberry32(31);
  for (let i = 0; i < 80; i++) {
    const x = 280 + ashRnd() * 190;
    const y = 210 + ashRnd() * 58;
    if (x > 404 && y > 226) continue;
    px(ctx, x, y, 1 + (ashRnd() < 0.25 ? 1 : 0), 1, ashRnd() < 0.55 ? '#6a5b56' : '#8d7a6e');
  }
  // blood spatter on the chest
  for (let i = 0; i < 26; i++) {
    const x = 340 + ashRnd() * 80;
    const y = 224 + ashRnd() * 42;
    px(ctx, x, y, 1 + (ashRnd() < 0.2 ? 1 : 0), 1, ashRnd() < 0.5 ? '#77211b' : '#3d1a18');
  }

  // ------------------------------------------------ neck
  // thick trapezius rising from the shoulders
  fillPoly(ctx, [326, 226, 342, 206, 360, 193, 376, 190, 380, 200, 366, 212, 352, 230, 344, 244], '#6a5b56');
  fillPoly(ctx, [334, 228, 348, 210, 362, 199, 372, 197, 372, 204, 358, 216, 346, 234], '#8d7a6e');
  fillPoly(ctx, [422, 190, 442, 196, 456, 210, 462, 226, 450, 232, 438, 218, 424, 206], '#3d3536');
  fillPoly(ctx, [430, 193, 446, 200, 456, 214, 456, 222, 446, 216, 434, 204], '#292325');
  const neck = [370, 176, 424, 170, 434, 200, 430, 232, 392, 236, 368, 220, 360, 196];
  polygonOutline(ctx, neck, INK, 1);
  fillPoly(ctx, neck, '#5a4e4c');
  fillPoly(ctx, [372, 181, 404, 176, 410, 210, 402, 232, 384, 230, 370, 208], '#7b6a62');
  fillPoly(ctx, [398, 178, 422, 174, 428, 206, 418, 226, 406, 222, 408, 200], '#4b4142');
  // jaw shadow
  fillPoly(ctx, [362, 178, 428, 171, 426, 186, 398, 192, 374, 190, 364, 186], '#211c1f');
  // neck tattoo lines
  thickStroke(ctx, [[410, 180], [416, 198], [414, 212]], [4, 3, 1], RED_D);

  // ------------------------------------------------ head
  const head = [
    392, 46, 412, 48, 429, 57, 440, 73, 446, 91, 449, 108,
    446, 120, 449, 130, 443, 142, 440, 154, 430, 170, 416, 181,
    400, 187, 384, 186, 371, 177, 361, 165, 354, 151, 350, 137,
    347, 121, 347, 105, 350, 89, 357, 73, 367, 61, 379, 52,
  ];
  polygonOutline(ctx, head, INK, 2);
  fillPoly(ctx, head, SKIN);

  // deep shadow on the far side of the face
  fillPoly(ctx, [
    420, 52, 432, 60, 441, 75, 447, 92, 449, 108, 446, 120, 449, 130,
    443, 142, 440, 154, 430, 170, 416, 181, 404, 185, 412, 166, 420, 148,
    424, 130, 423, 112, 417, 92, 412, 72,
  ], '#7b6a62');
  fillPoly(ctx, [
    431, 80, 440, 94, 443, 110, 439, 126, 432, 142, 424, 156, 413, 170,
    404, 178, 412, 162, 419, 146, 421, 128, 418, 110, 413, 96, 414, 84,
  ], '#6a5b56');

  // lit plane of the forehead and cheek
  fillPoly(ctx, [352, 84, 367, 64, 384, 53, 400, 54, 406, 72, 398, 92, 378, 102, 360, 104], SKIN_L);
  fillPoly(ctx, [356, 80, 370, 62, 384, 55, 394, 57, 390, 72, 374, 86, 360, 96], SKIN_H);
  fillPoly(ctx, [352, 120, 364, 110, 380, 110, 386, 126, 380, 146, 366, 156, 354, 146], '#c1aa95');
  // temple / cheekbone shadow
  fillPoly(ctx, [380, 96, 400, 94, 414, 106, 418, 124, 414, 142, 404, 154, 394, 150, 396, 132, 392, 116, 382, 106], '#8d7a6e');
  fillPoly(ctx, [356, 142, 366, 152, 378, 162, 392, 168, 394, 178, 378, 176, 364, 164, 354, 152], '#7b6a62');
  // forehead creases
  px(ctx, 362, 88, 16, 1, '#9f8a7b');
  px(ctx, 366, 84, 11, 1, '#9f8a7b');
  px(ctx, 374, 92, 13, 1, '#8d7a6e');
  // nose-to-mouth crease + cheek hollow
  px(ctx, 365, 133, 1, 12, '#7b6a62');
  px(ctx, 366, 144, 2, 5, '#4b4142');
  fillPoly(ctx, [390, 140, 400, 145, 402, 158, 392, 158, 386, 150], '#7b6a62');
  // jaw edge
  px(ctx, 371, 170, 1, 8, '#5a4e4c');
  px(ctx, 380, 177, 2, 7, '#4b4142');

  // ------------------------------------------------ ear
  fillPoly(ctx, [430, 113, 442, 110, 449, 120, 449, 135, 443, 147, 433, 143, 430, 130], '#4b4142');
  fillPoly(ctx, [434, 117, 442, 116, 445, 126, 443, 138, 436, 140, 433, 128], '#7b6a62');
  fillPoly(ctx, [436, 120, 441, 119, 442, 128, 439, 136, 436, 134], '#292325');
  px(ctx, 437, 121, 2, 4, '#b09a88');
  px(ctx, 441, 132, 2, 3, '#3d3536');

  // ------------------------------------------------ brow, eyes
  fillPoly(ctx, [348, 105, 366, 98, 388, 104, 399, 118, 386, 116, 374, 111, 355, 113], '#211c1f');
  fillPoly(ctx, [350, 102, 368, 96, 386, 100, 394, 108, 380, 104, 360, 106], '#3d3536');
  // brow highlight
  px(ctx, 355, 99, 10, 1, '#d1baa3');
  px(ctx, 370, 97, 10, 1, '#c1aa95');
  // angry crease between the brows
  px(ctx, 374, 104, 2, 8, '#4b4142');

  // eye socket (viewer left) + fierce eye
  fillPoly(ctx, [354, 108, 374, 105, 387, 109, 386, 126, 372, 129, 357, 123], '#211c1f');
  fillPoly(ctx, [359, 114, 370, 111, 377, 114, 376, 121, 364, 122, 359, 119], '#c1aa95');
  px(ctx, 359, 114, 12, 2, '#7b6a62');
  px(ctx, 364, 114, 5, 5, '#3d1a18');
  px(ctx, 365, 115, 3, 3, '#121015');
  px(ctx, 362, 117, 2, 1, '#fff5e0');
  px(ctx, 371, 119, 4, 1, '#4b4142');
  // heavy upper lid shadow
  fillPoly(ctx, [356, 110, 373, 107, 385, 111, 385, 114, 372, 111, 358, 114], '#121015');
  // lower lid
  px(ctx, 359, 121, 16, 1, '#4b4142');
  px(ctx, 356, 110, 2, 9, '#3d3536');
  // under-eye crease
  px(ctx, 361, 125, 12, 1, '#7b6a62');

  // far eye swallowed by shadow and tattoo
  fillPoly(ctx, [393, 111, 411, 108, 421, 112, 420, 122, 408, 124, 396, 120], '#322b2d');
  px(ctx, 398, 113, 10, 2, '#4b4142');
  px(ctx, 402, 114, 4, 2, '#121015');
  px(ctx, 404, 113, 2, 1, '#d1baa3');

  // ------------------------------------------------ nose
  fillPoly(ctx, [378, 101, 388, 102, 394, 122, 391, 136, 383, 143, 374, 139, 370, 131, 374, 120], '#a68f7c');
  fillPoly(ctx, [379, 102, 384, 103, 383, 120, 380, 131, 375, 133, 373, 128, 376, 116], '#d1baa3');
  fillPoly(ctx, [386, 104, 391, 106, 395, 123, 391, 133, 387, 130, 385, 118], '#8d7a6e');
  fillPoly(ctx, [369, 136, 382, 133, 390, 137, 388, 146, 379, 151, 370, 148, 365, 142], '#a68f7c');
  px(ctx, 369, 141, 6, 3, '#322b2d');
  px(ctx, 371, 143, 2, 1, '#121015');
  px(ctx, 384, 140, 4, 1, '#6a5b56');
  px(ctx, 375, 137, 5, 1, '#d1baa3');

  // ------------------------------------------------ beard
  const beard = [
    347, 146, 350, 166, 359, 184, 372, 198, 389, 205, 408, 201,
    424, 190, 435, 174, 442, 152, 437, 142, 429, 149, 422, 141,
    413, 150, 404, 143, 395, 152, 386, 144, 376, 152, 366, 144, 356, 152,
  ];
  polygonOutline(ctx, beard, INK, 1);
  fillPoly(ctx, beard, '#322b2d');
  fillPoly(ctx, [356, 156, 362, 174, 375, 189, 392, 195, 408, 189, 422, 175, 430, 160, 424, 170, 410, 184, 393, 190, 376, 182, 362, 168], '#211c1f');
  // beard strands
  for (let i = 0; i < 26; i++) {
    const x = 356 + ((i * 41) % 74);
    const y = 156 + ((i * 23) % 36);
    px(ctx, x, y, 1, 1 + (i % 4), i % 3 ? '#5a4e4c' : '#4b4142');
  }
  for (let i = 0; i < 8; i++) {
    const x = 364 + ((i * 37) % 58);
    const y = 166 + ((i * 19) % 26);
    px(ctx, x, y, 1, 3, '#7b6a62');
  }
  // ash-white beard streaks
  px(ctx, 372, 184, 1, 8, '#9f8a7b');
  px(ctx, 380, 188, 1, 7, '#b09a88');
  px(ctx, 399, 186, 1, 6, '#8d7a6e');
  px(ctx, 414, 176, 1, 5, '#6a5b56');

  // moustache + mouth (over the beard)
  fillPoly(ctx, [363, 152, 378, 149, 392, 152, 400, 157, 389, 160, 376, 158, 366, 158], '#3d3536');
  fillPoly(ctx, [365, 152, 379, 150, 390, 153, 392, 156, 379, 156, 368, 157], '#4b4142');
  fillPoly(ctx, [367, 159, 386, 157, 401, 160, 399, 165, 386, 167, 370, 164], '#3d1a18');
  px(ctx, 372, 160, 22, 1, '#1a0a0a');
  px(ctx, 377, 164, 14, 1, '#6a5b56');

  // ------------------------------------------------ tattoos / scars
  // the iconic stripe: crown to cheek, over the far eye
  const tattooPts = [[416, 48], [422, 62], [419, 76], [424, 90], [419, 104], [422, 118], [415, 130], [410, 144], [405, 156], [401, 166]];
  const tattooW = [10, 14, 15, 15, 14, 13, 12, 10, 7, 3];
  thickStroke(ctx, tattooPts, tattooW, RED_D);
  thickStroke(ctx, tattooPts.map(([x, y]) => [x - 1, y + 1]), tattooW.map((w) => w * 0.68), RED);
  thickStroke(ctx, tattooPts.slice(0, 7).map(([x, y]) => [x - 4, y + 2]), [3, 5, 5, 4, 4, 3, 2], RED_L);
  // jagged paint flecks
  px(ctx, 407, 64, 9, 2, RED_L);
  px(ctx, 418, 78, 5, 1, '#5a1c18');
  px(ctx, 405, 92, 4, 4, RED_L);
  px(ctx, 409, 116, 5, 2, RED_L);
  px(ctx, 398, 148, 3, 2, RED_L);
  // blood dribbling from the tattoo
  px(ctx, 406, 158, 1, 5, '#5a1c18');
  px(ctx, 412, 156, 1, 3, '#77211b');

  // stitched seam down the near cheek
  for (let i = 0; i < 12; i++) {
    const x = 351 + i * 1.15;
    const y = 116 + i * 3.1;
    px(ctx, x, y, 2, 1, '#5a1c18');
    if (i % 3 === 0) {
      px(ctx, x - 2, y - 1, 5, 1, '#8a5a4a');
      px(ctx, x, y - 2, 1, 5, '#8a5a4a');
    }
  }
  px(ctx, 352, 113, 1, 3, '#c1aa95');
  // old chain scar
  px(ctx, 393, 126, 2, 10, '#5a1c18');
  px(ctx, 397, 129, 1, 8, '#8a5a4a');
  px(ctx, 384, 138, 10, 1, '#5a1c18');

  // grime, blood specks and ash on the face
  const grime = mulberry32(505);
  for (let i = 0; i < 34; i++) {
    const x = 352 + grime() * 90;
    const y = 58 + grime() * 120;
    const r = grime();
    px(ctx, x, y, 1 + (r < 0.2 ? 1 : 0), 1, r < 0.3 ? '#77211b' : r < 0.6 ? '#7b6a62' : '#4b4142');
  }

  // ------------------------------------------------ rim light
  for (let i = 0; i < 32; i++) {
    const y = 62 + i * 3.4;
    const x = 436 + Math.sin(i * 0.6) * 2 + i * 0.25;
    px(ctx, x, y, 1, 2, i % 3 === 0 ? '#eedcc2' : '#c1aa95');
  }
  for (let i = 0; i < 10; i++) px(ctx, 394 + i * 3, 47 - Math.round(i * 0.4), 2, 1, '#8d7a6e');
  for (let i = 0; i < 22; i++) px(ctx, 448 + i * 1.5, 214 + i * 2.6, 1, 2, '#5a4e4c');
  // warm bounce light from the sun on the far cheek
  ctx.globalAlpha = 0.28;
  fillPoly(ctx, [418, 108, 434, 100, 440, 120, 436, 146, 424, 160, 416, 150, 422, 128], '#c9a45a');
  ctx.globalAlpha = 1;

  quantize(c, FIGURE_PALETTE);
  return c;
}

// ------------------------------------------------------------------ blades
function drawBlade(ctx, x0, y0, x1, y1, cx, cy, width) {
  const steps = 48;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
    pts.push([x, y, t]);
  }
  const widthAt = (t) => Math.max(0.5, width * (0.8 + 0.5 * Math.sin(t * Math.PI)) * (1 - t * 0.97));

  // dark outline pass
  for (let i = 0; i < steps; i++) {
    const [x, y, t] = pts[i];
    const [nx, ny] = pts[i + 1];
    const w = widthAt(t);
    const dx = nx - x;
    const dy = ny - y;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * w * 0.5;
    const oy = (dx / len) * w * 0.5;
    fillPoly(ctx, [
      x - ox - 1, y - oy - 1, x + ox - 1, y + oy - 1,
      nx + ox + 1, ny + oy + 1, nx - ox + 1, ny - oy + 1,
    ], '#0d0b0d');
  }
  // body of the blade
  for (let i = 0; i < steps; i++) {
    const [x, y, t] = pts[i];
    const [nx, ny] = pts[i + 1];
    const w = widthAt(t);
    const dx = nx - x;
    const dy = ny - y;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * w * 0.5;
    const oy = (dx / len) * w * 0.5;
    fillPoly(ctx, [x - ox, y - oy, x + ox, y + oy, nx + ox, ny + oy, nx - ox, ny - oy], t > 0.7 ? '#4b4142' : '#332d2e');
    // dark steel body
    fillPoly(ctx, [x - ox * 0.74, y - oy * 0.74, x + ox * 0.32, y + oy * 0.32, nx + ox * 0.32, ny + oy * 0.32, nx - ox * 0.74, ny - oy * 0.74], t > 0.62 ? '#575e66' : '#3d3536');
    // heated cutting edge
    fillPoly(ctx, [x - ox * 0.9, y - oy * 0.9, x - ox * 0.6, y - oy * 0.6, nx - ox * 0.6, ny - oy * 0.6, nx - ox * 0.9, ny - oy * 0.9], '#a98645');
    fillPoly(ctx, [x - ox * 0.84, y - oy * 0.84, x - ox * 0.7, y - oy * 0.7, nx - ox * 0.7, ny - oy * 0.7, nx - ox * 0.84, ny - oy * 0.84], '#e6c47a');
    fillPoly(ctx, [x - ox * 0.79, y - oy * 0.79, x - ox * 0.74, y - oy * 0.74, nx - ox * 0.74, ny - oy * 0.74, nx - ox * 0.79, ny - oy * 0.79], '#fff0bd');
    // fuller shadow
    fillPoly(ctx, [x + ox * 0.08, y + oy * 0.08, x + ox * 0.42, y + oy * 0.42, nx + ox * 0.42, ny + oy * 0.42, nx + ox * 0.08, ny + oy * 0.08], '#191519');
  }
  // blood on the blade
  const rnd = mulberry32(Math.round(x1 + y1 * 3));
  for (let i = 0; i < 24; i++) {
    const t = 0.1 + rnd() * 0.72;
    const idx = Math.floor(t * steps);
    const [x, y] = pts[idx];
    const w = widthAt(t);
    ctx.fillStyle = rnd() < 0.55 ? '#5a1c18' : '#962a20';
    ctx.fillRect(Math.round(x + (rnd() - 0.5) * w * 0.8), Math.round(y + (rnd() - 0.5) * 4), 1 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 3));
  }

  // guard + grip at the root
  const hx = x0;
  const hy = y0;
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const gx = Math.cos(ang);
  const gy = Math.sin(ang);
  // guard
  fillPoly(ctx, [hx - gy * 10, hy + gx * 10, hx + gy * 10, hy - gx * 10, hx + gy * 10 + gx * 3, hy - gx * 10 + gy * 3, hx - gy * 10 + gx * 3, hy + gx * 10 + gy * 3], '#8a6a38');
  fillPoly(ctx, [hx - gy * 8, hy + gx * 8, hx + gy * 8, hy - gx * 8, hx + gy * 8 + gx * 2, hy - gx * 8 + gy * 2, hx - gy * 8 + gx * 2, hy + gx * 8 + gy * 2], '#c9a45a');
  // grip
  const gx2 = hx - gx * 5;
  const gy2 = hy - gy * 5;
  fillPoly(ctx, [gx2 - gy * 4, gy2 + gx * 4, gx2 + gy * 4, gy2 - gx * 4, gx2 + gy * 4 - gx * 22, gy2 - gx * 4 - gy * 22, gx2 - gy * 4 - gx * 22, gy2 + gx * 4 - gy * 22], '#2c2218');
  for (let i = 0; i < 5; i++) {
    px(ctx, gx2 - gx * (5 + i * 3) - gy * 3, gy2 - gy * (5 + i * 3) + gx * 3, 6, 2, i % 2 ? '#94552c' : '#3a281c');
  }
  // pommel
  disc(ctx, gx2 - gx * 25, gy2 - gy * 25, 4.5, '#0d0b0d');
  disc(ctx, gx2 - gx * 25, gy2 - gy * 25, 3.2, '#8a6a38');
  disc(ctx, gx2 - gx * 25, gy2 - gy * 25, 1.6, '#e6c47a');
}

function chain(ctx, x0, y0, x1, y1, sag, links) {
  for (let i = 0; i < links; i++) {
    const t = i / (links - 1);
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * ((x0 + x1) / 2) + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2 + sag) + t * t * y1;
    if (i % 2 === 0) {
      px(ctx, x - 2, y - 1, 5, 3, '#0d0b0d');
      px(ctx, x - 1, y, 3, 1, '#3d3536');
    } else {
      px(ctx, x - 2, y - 2, 4, 5, '#0d0b0d');
      px(ctx, x - 1, y - 1, 2, 3, '#3d3536');
    }
  }
}

function buildBlades() {
  const c = makeCanvas(480, 270);
  const ctx = c.getContext('2d');

  // chains draped in from both edges
  chain(ctx, 108, 276, 240, 256, 20, 24);
  chain(ctx, 416, 276, 320, 256, 18, 24);
  chain(ctx, 146, 282, 224, 266, 8, 14);

  // left blade, sweeping up-left
  drawBlade(ctx, 252, 266, 172, 182, 204, 226, 32);
  // right blade, sweeping up-right
  drawBlade(ctx, 306, 266, 362, 164, 326, 214, 30);

  quantize(c, FIGURE_PALETTE);
  return c;
}

// ---------------------------------------------------------------- blood logo
function buildBanner() {
  const c = makeCanvas(480, 270);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(4242);
  const cx = 176;
  const cy = 50;

  const lobes = [
    [cx - 130, cy + 2, 32, 24], [cx - 100, cy - 8, 38, 20], [cx - 58, cy - 14, 52, 22],
    [cx - 8, cy - 10, 48, 24], [cx + 40, cy, 40, 22], [cx + 84, cy + 10, 32, 18],
    [cx + 114, cy + 2, 22, 16], [cx - 108, cy + 18, 28, 14], [cx - 44, cy + 18, 42, 16],
    [cx + 24, cy + 20, 32, 14],
  ];
  for (const [x, y, rx, ry] of lobes) {
    ctx.fillStyle = '#420b0c';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const [x, y, rx, ry] of lobes) {
    ctx.fillStyle = '#650f0e';
    ctx.beginPath();
    ctx.ellipse(x, y - 1, rx * 0.9, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // spatter
  for (let i = 0; i < 110; i++) {
    const x = cx - 160 + rnd() * 340;
    const y = cy - 42 + rnd() * 84;
    const r = rnd() < 0.82 ? rnd() * 2.4 + 0.4 : 2 + rnd() * 4;
    ctx.fillStyle = rnd() < 0.5 ? '#7a1310' : rnd() < 0.6 ? '#520d0d' : '#8f1812';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // tendrils reaching left
  for (let i = 0; i < 7; i++) {
    const y = cy - 14 + rnd() * 34;
    const len = 40 + rnd() * 90;
    ctx.strokeStyle = '#520d0d';
    ctx.lineWidth = 1 + rnd() * 3;
    ctx.beginPath();
    ctx.moveTo(cx - 108, y);
    ctx.bezierCurveTo(cx - 140, y + (rnd() - 0.5) * 14, cx - 150 - len * 0.4, y + (rnd() - 0.5) * 20, cx - 120 - len, y + (rnd() - 0.5) * 26);
    ctx.stroke();
  }
  // drips
  for (let i = 0; i < 26; i++) {
    const x = cx - 140 + rnd() * 300;
    const y = cy + 10 + rnd() * 16;
    const len = 4 + rnd() * 34;
    ctx.fillStyle = rnd() < 0.5 ? '#650f0e' : '#420b0c';
    ctx.fillRect(x, y, 1 + (rnd() < 0.3 ? 2 : 1), len);
    if (rnd() < 0.5) {
      ctx.beginPath();
      ctx.arc(x + 1, y + len, 1.6 + rnd() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // darker core behind the wordmark
  for (let i = 0; i < 6; i++) {
    const x = cx - 100 + i * 42;
    const y = cy + 2 + Math.sin(i) * 5;
    ctx.fillStyle = '#240507';
    ctx.beginPath();
    ctx.ellipse(x, y, 30, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // bright arterial flecks
  for (let i = 0; i < 22; i++) {
    const x = cx - 138 + rnd() * 300;
    const y = cy - 26 + rnd() * 70;
    ctx.fillStyle = rnd() < 0.5 ? '#a51f17' : '#b92b1c';
    ctx.fillRect(x, y, 1 + Math.round(rnd() * 3), 1 + Math.round(rnd() * 2));
  }

  quantize(c, BANNER_PALETTE);
  return c;
}

// -------------------------------------------------------------- logo layer
function buildLogo() {
  const scale = 2;
  const titleW = logoWidth('GOD OF WAR', scale);
  const iiiW = 3 * 20 + 2 * 4;
  const w = titleW + 10 + iiiW + 36;
  const h = 9 * scale + 30;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const x = 18;
  const y = 16;

  // shadow
  logoOutline(ctx, 'GOD OF WAR', x + 2, y + 3, scale, '#120406');

  const rows = [
    '#4c3411', '#7c5a29', '#bb9449', '#eccf86', '#ffe9ad', '#fff3cd',
    '#f5dd9e', '#d8af64', '#b98739', '#8f5f22',
  ];
  // dark edge around each glyph
  logoOutline(ctx, 'GOD OF WAR', x, y, scale, '#2a0709');
  drawLogo(ctx, 'GOD OF WAR', x, y, scale, rows);

  // III to the right, like the third entry
  const iiiX = x + titleW + 12;
  const iiiY = y + 9;
  const iiiRows = ['#e0b46a', '#c43622', '#8f1812', '#5a0d0d', '#420b0c', '#5a0d0d', '#8f1812', '#b0261b', '#7a1310'];
  for (let i = 0; i < 3; i++) {
    drawLogo(ctx, 'I', iiiX + i * 23, iiiY, 2, iiiRows);
  }
  logoOutline(ctx, 'I', iiiX, iiiY, 2, '#120406');
  logoOutline(ctx, 'I', iiiX + 23, iiiY, 2, '#120406');
  logoOutline(ctx, 'I', iiiX + 46, iiiY, 2, '#120406');

  // blood eating into the letters
  const rnd = mulberry32(777);
  for (let i = 0; i < 54; i++) {
    const sx = 16 + rnd() * (w - 20);
    const sy = 18 + rnd() * 22;
    ctx.fillStyle = rnd() < 0.4 ? '#962a20' : '#420b0c';
    ctx.fillRect(sx, sy, 1 + Math.round(rnd() * 3), 1 + Math.round(rnd() * 2));
  }
  return c;
}

// ------------------------------------------------------------------- facade
export class TitleArt {
  constructor() {
    this.sky = buildSky();
    this.figure = buildKratos();
    this.blades = buildBlades();
    this.banner = buildBanner();
    this.logo = buildLogo();
    this.time = 0;
    this.flash = 0;
    this.nextBolt = 7 + Math.random() * 7;
    this.bolt = null;
    this.embers = Array.from({ length: 52 }, () => ({
      x: Math.random() * 480,
      y: 180 + Math.random() * 90,
      vy: 6 + Math.random() * 20,
      vx: -4 + Math.random() * 12,
      life: Math.random(),
      size: Math.random() < 0.8 ? 1 : 2,
    }));
    this.ash = Array.from({ length: 80 }, () => ({
      x: Math.random() * 480,
      y: Math.random() * 270,
      vy: 5 + Math.random() * 12,
      vx: -7 + Math.random() * 14,
      size: Math.random() < 0.85 ? 1 : 2,
      alpha: 0.14 + Math.random() * 0.4,
    }));
  }

  update(dt) {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 2.6);
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      this.nextBolt = 9 + Math.random() * 12;
      this.flash = 0.9;
      this.bolt = {
        seed: Math.random() * 1000,
        x: 300 + Math.random() * 80,
        life: 0.5,
      };
      this.onThunder?.();
    }
    if (this.bolt) {
      this.bolt.life -= dt;
      if (this.bolt.life <= 0) this.bolt = null;
    }
    for (const e of this.embers) {
      e.y -= e.vy * dt;
      e.x += e.vx * dt;
      if (e.y < 150) {
        e.y = 240 + Math.random() * 40;
        e.x = Math.random() * 480;
      }
    }
    for (const a of this.ash) {
      a.y += a.vy * dt;
      a.x += a.vx * dt;
      if (a.y > 275) { a.y = -6; a.x = Math.random() * 480; }
      if (a.x < -6) a.x = 486;
      if (a.x > 486) a.x = -6;
    }
  }

  drawBackground(ctx, t = this.time) {
    ctx.drawImage(this.sky, 0, 0, 480, 270);

    // sun breathing
    ctx.save();
    ctx.globalAlpha = 0.09 + Math.sin(t * 0.7) * 0.025;
    glow(ctx, 452, 132, 58, '#ffdfae', 0.5, 5);
    ctx.restore();

    // dark halo behind the head so the silhouette pops
    ctx.save();
    ctx.globalAlpha = 0.28;
    glow(ctx, 392, 108, 100, '#080609', 0.7, 6);
    ctx.restore();

    // drifting fog bands
    for (let i = 0; i < 5; i++) {
      const y = 152 + i * 21;
      const off = (t * (5 + i * 3)) % 560 - 40;
      ctx.save();
      ctx.globalAlpha = 0.045 + i * 0.011;
      ctx.fillStyle = '#9a8d82';
      ctx.beginPath();
      ctx.ellipse(off, y, 150, 9 + i * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(off - 300, y + 4, 130, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // lightning
    if (this.flash > 0.02) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, this.flash * 0.45);
      ctx.fillStyle = '#dfe9ff';
      ctx.fillRect(0, 0, 480, 270);
      ctx.restore();
      if (this.bolt) {
        const rnd = mulberry32(Math.floor(this.bolt.seed));
        ctx.save();
        ctx.globalAlpha = clamp(this.bolt.life * 2, 0, 1);
        let x = this.bolt.x;
        let y = 0;
        ctx.fillStyle = '#eef5ff';
        while (y < 150) {
          const nx = x + (rnd() - 0.5) * 26;
          const ny = y + 8 + rnd() * 14;
          const steps = Math.ceil(Math.hypot(nx - x, ny - y));
          for (let s = 0; s < steps; s++) {
            const pxr = x + ((nx - x) * s) / steps;
            const pyr = y + ((ny - y) * s) / steps;
            ctx.fillRect(Math.round(pxr), Math.round(pyr), 1, 2);
            if (s % 4 === 0) ctx.fillRect(Math.round(pxr) + 1, Math.round(pyr), 1, 1);
          }
          x = nx;
          y = ny;
          if (y > 60 && rnd() < 0.35) break;
        }
        ctx.restore();
      }
    }

    // drifting ash
    for (const a of this.ash) {
      ctx.globalAlpha = a.alpha;
      ctx.fillStyle = '#b9a99a';
      ctx.fillRect(a.x | 0, a.y | 0, a.size, a.size);
    }
    ctx.globalAlpha = 1;
  }

  drawFigure(ctx) {
    ctx.drawImage(this.figure, 0, 0);
    ctx.drawImage(this.blades, 0, 0);

    const flick = 0.75 + Math.sin(this.time * 9) * 0.12 + Math.sin(this.time * 17.3) * 0.08;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 246, 252, 54, '#ff7a1e', 0.18 * flick, 6);
    glow(ctx, 312, 252, 46, '#ff9a2a', 0.15 * flick, 6);
    glow(ctx, 196, 190, 18, '#ffb24a', 0.08 * flick, 4);
    glow(ctx, 352, 188, 16, '#ffb24a', 0.07 * flick, 4);
    for (const e of this.embers) {
      if (e.y > 240) continue;
      const a = clamp((240 - e.y) / 100, 0, 1);
      ctx.globalAlpha = (0.25 + a * 0.6) * flick;
      ctx.fillStyle = a > 0.55 ? '#ffc46a' : '#e0622a';
      ctx.fillRect(e.x | 0, e.y | 0, e.size, e.size + 1);
    }
    ctx.restore();
  }

  drawBannerAndLogo(ctx) {
    ctx.drawImage(this.banner, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.1 + Math.sin(this.time * 1.4) * 0.03;
    glow(ctx, 172, 52, 116, '#c43622', 0.5, 5);
    ctx.restore();
    ctx.drawImage(this.logo, 26, 24);
    drawText(ctx, 'EDICAO PIXEL', 186, 78, {
      scale: 1, color: '#e6c27c', spacing: 2, align: 'center',
      outline: '#1a0507', shadow: '#0a0203',
    });
    ctx.fillStyle = '#5a0d0d';
    ctx.fillRect(112, 88, 148, 1);
    ctx.fillStyle = '#8f1812';
    ctx.fillRect(128, 89, 116, 1);
  }
}
