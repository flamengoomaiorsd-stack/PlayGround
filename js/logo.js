/* Procedural Minecraft-style stone logo, rendered on a canvas. */

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function stonePattern() {
  const c = makeCanvas(320, 180);
  const g = c.getContext('2d');
  const rnd = mulberry32(2011);
  g.fillStyle = '#9b9b9b';
  g.fillRect(0, 0, c.width, c.height);
  const shades = ['#8b8b8b', '#a7a7a7', '#949494', '#b3b3b3', '#7e7e7e', '#c0c0c0'];
  for (let i = 0; i < 150; i++) {
    g.fillStyle = shades[(rnd() * shades.length) | 0];
    const w = 2 + (rnd() * 9 | 0), h = 2 + (rnd() * 7 | 0);
    g.globalAlpha = 0.35 + rnd() * 0.4;
    g.fillRect((rnd() * c.width) | 0, (rnd() * c.height) | 0, w, h);
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = rnd() < .6 ? 'rgba(82,82,82,.5)' : 'rgba(58,58,58,.38)';
    g.lineWidth = 1;
    let x = (rnd() * c.width) | 0, y = (rnd() * c.height) | 0;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rnd() - 0.5) * 18;
      y += (rnd() - 0.5) * 10;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 80; i++) {
    g.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.22)' : 'rgba(55,55,55,.25)';
    g.fillRect((rnd() * c.width) | 0, (rnd() * c.height) | 0, 1, 1);
  }
  return c;
}

function tinted(source, color) {
  const c = makeCanvas(source.width, source.height);
  const g = c.getContext('2d');
  g.drawImage(source, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export async function drawLogo(canvas) {
  const W = canvas.width, H = canvas.height;
  try {
    await document.fonts.load('230px "Press Start 2P"');
  } catch { /* fallback font */ }

  const measure = makeCanvas(W, H).getContext('2d');
  const fontSize = 232;
  const font = `${fontSize}px "Press Start 2P", monospace`;
  measure.font = font;
  const charW = measure.measureText('M').width;
  const wordW = charW * 9;
  const targetW = W * 0.90;
  const scaleX = Math.min(1, targetW / wordW);
  const baseY = H * 0.485;

  const rnd = mulberry32(7319);
  const letters = [];
  const startX = W / 2 - (wordW * scaleX) / 2;
  for (let i = 0; i < 9; i++) {
    letters.push({
      ch: 'MINECRAFT'[i],
      x: startX + (i + 0.5) * charW * scaleX,
      y: baseY + (rnd() - 0.5) * 7,
      rot: (rnd() - 0.5) * 0.045
    });
  }

  const drawLetters = (g, mode, color, lineWidth) => {
    for (const L of letters) {
      g.save();
      g.translate(L.x, L.y);
      g.rotate(L.rot);
      g.scale(scaleX, 1);
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (mode === 'fill') {
        g.fillStyle = color;
        g.fillText(L.ch, 0, 0);
      } else {
        g.strokeStyle = color;
        g.lineWidth = lineWidth;
        g.lineJoin = 'miter';
        g.miterLimit = 2;
        g.strokeText(L.ch, 0, 0);
      }
      g.restore();
    }
  };

  // 1. Glyph mask
  const mask = makeCanvas(W, H);
  const mg = mask.getContext('2d');
  mg.imageSmoothingEnabled = false;
  drawLetters(mg, 'fill', '#ffffff', 0);

  // 2. Stone face
  const face = makeCanvas(W, H);
  const fg = face.getContext('2d');
  const pattern = stonePattern();
  const pat = fg.createPattern(pattern, 'repeat');
  fg.fillStyle = pat;
  fg.fillRect(0, 0, W, H);
  fg.globalCompositeOperation = 'destination-in';
  fg.drawImage(mask, 0, 0);
  fg.globalCompositeOperation = 'source-atop';

  const grad = fg.createLinearGradient(0, baseY - 120, 0, baseY + 140);
  grad.addColorStop(0, 'rgba(255,255,255,.46)');
  grad.addColorStop(0.32, 'rgba(255,255,255,.06)');
  grad.addColorStop(0.62, 'rgba(0,0,0,.04)');
  grad.addColorStop(1, 'rgba(0,0,0,.52)');
  fg.fillStyle = grad;
  fg.fillRect(0, 0, W, H);

  // highlight on upper-left edge
  const hl = tinted(mask, 'rgba(255,255,255,.28)');
  fg.globalCompositeOperation = 'source-atop';
  fg.drawImage(hl, -4, -5);

  // bevel shadow on lower edge
  const ds = tinted(mask, 'rgba(30,30,30,.20)');
  fg.drawImage(ds, 5, 6);

  // tiny cracks
  const crackRnd = mulberry32(8123);
  fg.strokeStyle = 'rgba(60,60,60,.45)';
  fg.lineWidth = 1.5;
  for (let i = 0; i < 22; i++) {
    let x = W * 0.18 + crackRnd() * W * 0.68;
    let y = baseY - 70 + crackRnd() * 150;
    fg.beginPath();
    fg.moveTo(x, y);
    for (let s = 0; s < 3; s++) {
      x += (crackRnd() - 0.5) * 14;
      y += 5 + crackRnd() * 10;
      fg.lineTo(x, y);
    }
    fg.stroke();
  }

  // 3. Compose final logo
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.imageSmoothingEnabled = false;

  // soft dark halo
  const halo = tinted(mask, 'rgba(0,0,0,.9)');
  g.save();
  g.shadowColor = 'rgba(0,0,0,.65)';
  g.shadowBlur = 22;
  g.drawImage(halo, 0, 0);
  g.restore();

  // extruded depth
  const depth = 26;
  for (let d = depth; d >= 2; d -= 2) {
    const shade = Math.round(28 + (d / depth) * 18);
    const ext = tinted(mask, `rgb(${shade},${shade},${shade})`);
    g.drawImage(ext, d * 0.72, d);
  }

  // outline
  drawLetters(g, 'stroke', 'rgba(12,12,12,.92)', 16);

  // face
  g.drawImage(face, 0, 0);

  // crisp top highlight line
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const shine = tinted(mask, 'rgba(255,255,255,.10)');
  g.drawImage(shine, -2, -3);
  g.restore();

  return canvas;
}

export function pickSplash(list, previous) {
  if (!list || !list.length) return '';
  let value = list[Math.floor(Math.random() * list.length)];
  if (list.length > 1 && value === previous) {
    value = list[(list.indexOf(value) + 1) % list.length];
  }
  return value;
}
