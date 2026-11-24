// Title screen, options, treasures, credits.
import { drawText, px, disc, glow, clamp, measureText, W, H } from './pixel.js';
import { input } from './input.js';
import { Save, TREASURES } from './save.js';
import { TitleArt } from './titleArt.js';

const ITEMS = [
  { id: 'new', label: 'NOVO JOGO' },
  { id: 'load', label: 'CARREGAR JOGO' },
  { id: 'options', label: 'OPCOES' },
  { id: 'treasures', label: 'TESOUROS' },
];

const OPTION_ROWS = [
  { key: 'volume', label: 'VOLUME', type: 'slider' },
  { key: 'shake', label: 'TREMOR DE TELA', type: 'toggle' },
  { key: 'blood', label: 'SANGUE', type: 'toggle' },
  { key: 'crt', label: 'FILTRO CRT', type: 'toggle' },
  { key: 'reset', label: 'APAGAR PROGRESSO', type: 'action' },
];

const GOLD = '#d9ab5c';
const GOLD_DIM = '#8a6534';
const RED = '#8d1b18';
const RED_DIM = '#5a1d1c';
const CREAM = '#efe3cf';
const ASH = '#b9a99a';

function panel(ctx, x, y, w, h, title) {
  ctx.save();
  // recede the title screen behind sub-menus
  ctx.fillStyle = 'rgba(4,2,3,0.52)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.93;
  px(ctx, x, y, w, h, '#0a0709');
  ctx.globalAlpha = 1;
  px(ctx, x, y, w, 1, '#3a2420');
  px(ctx, x, y + h - 1, w, 1, '#241715');
  px(ctx, x, y, 1, h, '#3a2420');
  px(ctx, x + w - 1, y, 1, h, '#241715');
  px(ctx, x + 2, y + 2, w - 4, 1, '#1c1214');
  // corner studs
  for (const [cx, cy] of [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]]) {
    px(ctx, cx, cy, 3, 3, '#6b4a2e');
    px(ctx, cx + 1, cy + 1, 1, 1, GOLD_DIM);
  }
  if (title) {
    px(ctx, x + 10, y + 12, w - 20, 1, '#4a1a16');
    drawText(ctx, title, x + 14, y + 6, { scale: 2, color: GOLD, shadow: '#1a0507', spacing: 1 });
    px(ctx, x + 10, y + 30, w - 20, 1, '#4a1a16');
    px(ctx, x + 10, y + 31, 40, 1, '#8d1b18');
  }
  ctx.restore();
}

export class MenuScene {
  constructor(app) {
    this.app = app;
    this.art = app.titleArt || new TitleArt();
    this.index = 0;
    this.mode = 'root';
    this.optIndex = 0;
    this.treasureIndex = 0;
    this.toast = null;
    this.toastT = 0;
    this.resetArmed = false;
    this.time = 0;
    this.itemFlash = 0;
    this.launching = false;
    this.splash = [];
    this.mouse = { x: -100, y: -100 };
    for (let i = 0; i < 26; i++) {
      this.splash.push({ x: Math.random() * W, y: Math.random() * H, vx: -8 + Math.random() * 16, vy: 4 + Math.random() * 20, life: Math.random() });
    }
  }

  onAudioReady() {
    this.app.audio.setMode('menu');
  }

  hit(r, p) {
    return !!r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  backRect() {
    const layout = {
      options: [56, 40, 368],
      treasures: [40, 32, 400],
      credits: [84, 52, 312],
    }[this.mode];
    if (!layout) return null;
    return { x: layout[0] + layout[2] - 82, y: layout[1] + 4, w: 70, h: 18 };
  }

  creditsRect() {
    return { x: 228, y: 236, w: 74, h: 20 };
  }

  goBack() {
    this.mode = 'root';
    this.resetArmed = false;
    this.app.audio.sfx('back');
  }

  itemRect(i) {
    return { x: 62, y: 122 + i * 22, w: 210, h: 16 };
  }

  optionRect(i) {
    return { x: 92, y: 84 + i * 24, w: 300, h: 20 };
  }

  saveExists() {
    return !!Save.progress.run;
  }

  say(text) {
    this.toast = text;
    this.toastT = 2.6;
  }

  move(delta) {
    const n = this.mode === 'root' ? ITEMS.length : this.mode === 'options' ? OPTION_ROWS.length : this.mode === 'treasures' ? TREASURES.length : 0;
    if (!n) return;
    if (this.mode === 'root') {
      this.index = (this.index + delta + n) % n;
      this.itemFlash = 1;
    } else if (this.mode === 'options') {
      this.optIndex = (this.optIndex + delta + n) % n;
      this.resetArmed = false;
      this.itemFlash = 1;
    } else if (this.mode === 'treasures') {
      this.treasureIndex = (this.treasureIndex + delta + n) % n;
      this.itemFlash = 1;
    }
    this.app.audio.sfx('move');
  }

  activateRoot() {
    if (this.launching) return;
    const id = ITEMS[this.index].id;
    if (id === 'new') {
      this.launchNew();
    } else if (id === 'load') {
      if (!this.saveExists()) {
        this.say('SEM DADOS. INICIE UM NOVO JOGO.');
        this.app.audio.sfx('back');
      } else {
        this.app.audio.sfx('start');
        this.app.beginTransition(() => this.app.startGame({ resume: true }));
      }
    } else if (id === 'options') {
      this.mode = 'options';
      this.optIndex = 0;
      this.resetArmed = false;
      this.app.audio.sfx('select');
    } else if (id === 'treasures') {
      this.mode = 'treasures';
      this.treasureIndex = 0;
      this.app.audio.sfx('select');
    }
  }

  launchNew() {
    this.app.audio.sfx('start');
    this.app.beginTransition(() => this.app.startGame({ resume: false }));
    this.launching = true;
  }

  adjustOption(dir) {
    const row = OPTION_ROWS[this.optIndex];
    const s = Save.settings;
    if (row.type === 'slider') {
      const v = clamp(Math.round((s.volume + dir * 0.1) * 10) / 10, 0, 1);
      Save.setSetting('volume', v);
      this.app.audio.setVolume(v);
      this.app.audio.sfx('move');
    } else if (row.type === 'toggle') {
      Save.setSetting(row.key, !s[row.key]);
      this.applySettings();
      this.app.audio.sfx('select');
    } else if (row.type === 'action') {
      if (!this.resetArmed) {
        this.resetArmed = true;
        this.app.audio.sfx('back');
      } else {
        Save.reset();
        this.applySettings();
        this.resetArmed = false;
        this.say('PROGRESSO APAGADO.');
        this.app.audio.sfx('select');
      }
    }
  }

  applySettings() {
    const s = Save.settings;
    this.app.audio.setVolume(s.volume);
    document.body.classList.toggle('crt-on', !!s.crt);
    this.app.applySettings();
  }

  update(dt) {
    this.time += dt;
    this.art.update(dt);
    if (this.itemFlash > 0) this.itemFlash = Math.max(0, this.itemFlash - dt * 4);
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toast = null;
    }
    for (const s of this.splash) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
      if (s.x < -4) s.x = W + 4;
      if (s.x > W + 4) s.x = -4;
    }

    const ptr = input.pointer;
    this.mouse.x = ptr.x;
    this.mouse.y = ptr.y;

    if (input.justPressed('up')) this.move(-1);
    if (input.justPressed('down')) this.move(1);

    if (this.mode === 'root') {
      // hover
      if (ptr.inside) {
        for (let i = 0; i < ITEMS.length; i++) {
          const r = this.itemRect(i);
          if (ptr.x >= r.x - 14 && ptr.x <= r.x + r.w && ptr.y >= r.y - 4 && ptr.y <= r.y + r.h) {
            if (this.index !== i) {
              this.index = i;
              this.itemFlash = 1;
              this.app.audio.sfx('move');
            }
            break;
          }
        }
      }
      const click = input.consumeClick();
      if (click) {
        if (this.hit(this.creditsRect(), click)) {
          this.mode = 'credits';
          this.app.audio.sfx('select');
        } else {
          for (let i = 0; i < ITEMS.length; i++) {
            const r = this.itemRect(i);
            if (click.x >= r.x - 14 && click.x <= r.x + r.w && click.y >= r.y - 4 && click.y <= r.y + r.h) {
              this.index = i;
              this.activateRoot();
              break;
            }
          }
        }
      }
      if (input.justPressed('confirm') && !this.launching) {
        // ignore confirm generated by the same click that hovered nothing
        this.activateRoot();
      }
      if (input.justPressed('credits')) {
        this.mode = 'credits';
        this.app.audio.sfx('select');
      }
    } else if (this.mode === 'options') {
      if (input.justPressed('left')) this.adjustOption(-1);
      if (input.justPressed('right')) this.adjustOption(1);
      if (input.justPressed('confirm')) this.adjustOption(1);
      const click = input.consumeClick();
      if (click) {
        if (this.hit(this.backRect(), click)) {
          this.goBack();
        } else {
          for (let i = 0; i < OPTION_ROWS.length; i++) {
            const r = this.optionRect(i);
            if (click.y >= r.y - 4 && click.y <= r.y + r.h) {
              this.optIndex = i;
              this.adjustOption(1);
              break;
            }
          }
        }
      }
      if (input.justPressed('back')) this.goBack();
    } else if (this.mode === 'treasures') {
      const click = input.consumeClick();
      if (click) {
        if (this.hit(this.backRect(), click)) {
          this.goBack();
        } else {
          for (let i = 0; i < TREASURES.length; i++) {
            const y = 80 + i * 21;
            if (click.y >= y - 4 && click.y <= y + 19) this.treasureIndex = i;
          }
        }
      }
      if (input.justPressed('back') || input.justPressed('confirm')) this.goBack();
    } else if (this.mode === 'credits') {
      const click = input.consumeClick();
      if (click && (this.hit(this.backRect(), click) || click.x < 84 || click.x > 396 || click.y < 52 || click.y > 212)) {
        this.goBack();
      }
      if (input.justPressed('back') || input.justPressed('confirm')) this.goBack();
    }

    if (this.mode !== 'root') input.consumeClick();
  }

  drawMenuItems(ctx) {
    const menuGlow = 0.5 + Math.sin(this.time * 1.8) * 0.08;
    ctx.save();
    ctx.globalAlpha = 0.72;
    const g = ctx.createLinearGradient(20, 0, 330, 0);
    g.addColorStop(0, 'rgba(4,3,4,0.86)');
    g.addColorStop(0.62, 'rgba(6,4,5,0.55)');
    g.addColorStop(1, 'rgba(8,5,6,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 92, 340, 132);
    ctx.restore();

    for (let i = 0; i < ITEMS.length; i++) {
      const r = this.itemRect(i);
      const sel = i === this.index;
      const y = r.y;
      if (sel) {
        // blood smear behind selection
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#4a0b0c';
        ctx.beginPath();
        ctx.ellipse(r.x + 62, y + 8, 78, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.16 * menuGlow;
        glow(ctx, r.x + 56, y + 8, 40, '#ff5a32', 0.5, 4);
        ctx.restore();
        // marker
        const bob = Math.round(Math.sin(this.time * 5) * 1);
        px(ctx, r.x - 20, y + 4 + bob, 3, 3, '#c43622');
        px(ctx, r.x - 17, y + 6 + bob, 4, 2, '#8d1b18');
        px(ctx, r.x - 21, y + 6 + bob, 2, 1, '#8d1b18');
        // underline
        px(ctx, r.x - 2, y + 16, 84 + (this.itemFlash > 0.6 ? 8 : 0), 1, '#6d1210');
        drawText(ctx, ITEMS[i].label, r.x, y, {
          scale: 2,
          color: this.index === i && this.itemFlash > 0.65 ? '#fff6e2' : CREAM,
          outline: '#180606',
          shadow: '#7e1913',
          spacing: 1,
        });
      } else {
        drawText(ctx, ITEMS[i].label, r.x, y, {
          scale: 2,
          color: '#7c2c26',
          outline: '#160708',
          spacing: 1,
        });
      }
      if (i === 1) {
        const run = Save.progress.run;
        const label = run ? `ONDA ${run.wave}` : '';
        if (label) drawText(ctx, label, r.x + 168, y + 3, { scale: 1, color: '#6b5b4c', spacing: 1 });
      }
    }
    const progress = Save.progress;
    if (progress.bestScore > 0 || progress.maxWave > 0) {
      const best = String(Math.floor(progress.bestScore)).padStart(6, '0');
      drawText(ctx, `MELHOR ${best}  \u00b7  ONDA ${progress.maxWave}/5`, 62, 214, {
        scale: 1, color: '#6b5b4c', spacing: 1, outline: '#0a0505',
      });
    }
  }

  drawFooter(ctx) {
    const y = 244;
    ctx.save();
    const g = ctx.createLinearGradient(0, 232, 0, 270);
    g.addColorStop(0, 'rgba(4,3,4,0)');
    g.addColorStop(0.5, 'rgba(4,3,4,0.55)');
    g.addColorStop(1, 'rgba(4,3,4,0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 228, 380, 42);
    ctx.restore();
    if (this.app.isTouch) {
      drawText(ctx, 'TOQUE SELECIONAR', 46, y, { scale: 1, color: ASH, spacing: 1, outline: '#0a0505' });
    } else {
      drawText(ctx, 'ENTER SELECIONAR', 46, y, { scale: 1, color: ASH, spacing: 1, outline: '#0a0505' });
      drawText(ctx, '\u2191\u2193 NAVEGAR', 158, y, { scale: 1, color: '#7f6f60', spacing: 1, outline: '#0a0505' });
    }
    // credits chip doubles as a touch target (the C key still works on keyboard)
    const cr = this.creditsRect();
    px(ctx, cr.x, cr.y, cr.w, cr.h, 'rgba(18,10,10,0.78)');
    px(ctx, cr.x, cr.y, cr.w, 1, '#5a3a24');
    px(ctx, cr.x, cr.y + cr.h - 1, cr.w, 1, '#2a1512');
    drawText(ctx, this.app.isTouch ? 'CREDITOS' : 'C CREDITOS', cr.x + cr.w / 2, cr.y + 7, {
      scale: 1, color: '#d8c4a6', spacing: 1, align: 'center', outline: '#0a0505',
    });

    drawText(ctx, 'V1.0 \u00b7 ASHES OF OLYMPUS', 18, 261, { scale: 1, color: '#5a4a40', spacing: 1, outline: '#0a0505' });
    if (this.app.isTouch) {
      drawText(ctx, 'TOQUE PARA ESCOLHER', 462, 261, { scale: 1, color: '#6b5b4c', spacing: 1, align: 'right', outline: '#0a0505' });
    }
  }

  drawBackButton(ctx) {
    const r = this.backRect();
    if (!r) return;
    px(ctx, r.x, r.y, r.w, r.h, '#241715');
    px(ctx, r.x, r.y, r.w, 1, '#6b4a2e');
    px(ctx, r.x, r.y + r.h - 1, r.w, 1, '#1a0f10');
    drawText(ctx, 'VOLTAR', r.x + r.w / 2, r.y + 6, {
      scale: 1, color: '#e2b27a', spacing: 1, align: 'center',
    });
  }

  drawOptions(ctx) {
    panel(ctx, 56, 40, 368, 184, 'OPCOES');
    this.drawBackButton(ctx);
    const s = Save.settings;
    for (let i = 0; i < OPTION_ROWS.length; i++) {
      const row = OPTION_ROWS[i];
      const r = this.optionRect(i);
      const sel = i === this.optIndex;
      if (sel) {
        px(ctx, r.x - 6, r.y - 3, r.w + 16, r.h + 2, '#2a0d0c');
        px(ctx, r.x - 6, r.y - 3, 2, r.h + 2, '#a3221b');
        drawText(ctx, '\u25c6', r.x - 16, r.y + 2, { scale: 1, color: '#c43622' });
      }
      drawText(ctx, row.label, r.x + 4, r.y + 2, {
        scale: 2,
        color: sel ? CREAM : '#8a6a58',
        outline: '#120606',
        spacing: 1,
      });
      let val = '';
      if (row.key === 'volume') {
        const filled = Math.round(s.volume * 10);
        for (let k = 0; k < 10; k++) {
          px(ctx, 292 + k * 9, r.y + 6, 6, 6, k < filled ? '#b0261b' : '#2a2020');
          if (k < filled) px(ctx, 292 + k * 9, r.y + 6, 6, 2, '#d64d2c');
        }
        val = `${Math.round(s.volume * 100)}`;
        drawText(ctx, val, 402, r.y + 2, { scale: 2, color: sel ? GOLD : GOLD_DIM, spacing: 1, align: 'right' });
      } else if (row.type === 'toggle') {
        val = s[row.key] ? 'ON' : 'OFF';
        drawText(ctx, val, 402, r.y + 2, {
          scale: 2,
          color: s[row.key] ? '#c98a3e' : '#5a4a44',
          spacing: 1,
          align: 'right',
        });
      } else if (row.type === 'action') {
        drawText(ctx, this.resetArmed ? 'CERTO?' : 'APAGAR', 402, r.y + 2, {
          scale: 2,
          color: this.resetArmed ? '#d64d2c' : '#7c2c26',
          spacing: 1,
          align: 'right',
        });
      }
    }
    const help = this.app.isTouch
      ? 'TOQUE NOS ITENS PARA AJUSTAR'
      : 'ESQUERDA/DIREITA AJUSTAR  \u00b7  ESC VOLTAR';
    drawText(ctx, help, 240, 206, { scale: 1, color: '#6b5b4c', spacing: 1, align: 'center' });
    if (this.resetArmed) {
      drawText(ctx, 'PRESSIONE NOVAMENTE PARA APAGAR', 240, 214, { scale: 1, color: '#b0261b', spacing: 1, align: 'center' });
    }
  }

  drawTreasures(ctx) {
    panel(ctx, 40, 32, 400, 206, 'TESOUROS');
    this.drawBackButton(ctx);
    const unlocked = new Set(Save.progress.unlocked);
    const kills = Save.progress.kills;
    for (let i = 0; i < TREASURES.length; i++) {
      const t = TREASURES[i];
      const y = 80 + i * 21;
      const sel = i === this.treasureIndex;
      const open = t.always || unlocked.has(t.id) || (t.id === 'centurion' && kills >= 25);
      if (sel) {
        px(ctx, 58, y - 3, 364, 19, '#2a0d0c');
        px(ctx, 58, y - 3, 2, 19, '#a3221b');
      }
      // relic medallion
      disc(ctx, 70, y + 5, 5, open ? '#4a2c16' : '#1c1719');
      disc(ctx, 70, y + 5, 3, open ? '#b8894a' : '#2c2426');
      if (open) px(ctx, 69, y + 4, 2, 2, '#f0cf8b');
      drawText(ctx, open ? t.name : '? ? ?', 82, y, {
        scale: 2,
        color: open ? (sel ? CREAM : '#b9a99a') : '#4a3c3a',
        outline: '#100506',
        spacing: 1,
      });
      if (open) drawText(ctx, 'OBTIDO', 412, y + 3, { scale: 1, color: '#8a6534', spacing: 1, align: 'right' });
    }
    const t = TREASURES[this.treasureIndex];
    const open = t.always || unlocked.has(t.id) || (t.id === 'centurion' && kills >= 25);
    px(ctx, 58, 202, 364, 1, '#33201c');
    const desc = open ? t.desc : 'CONTINUE LUTANDO PARA REVELAR ESTA RELIQUIA.';
    drawText(ctx, desc, 240, 208, { scale: 1, color: '#8a7a68', spacing: 1, align: 'center' });
    drawText(ctx, this.app.isTouch ? 'TOQUE EM VOLTAR' : 'ESC VOLTAR', 240, 222, { scale: 1, color: '#5a4a40', spacing: 1, align: 'center' });
  }

  drawCredits(ctx) {
    panel(ctx, 84, 52, 312, 160, 'CREDITOS');
    this.drawBackButton(ctx);
    const lines = [
      ['ASHES OF OLYMPUS', GOLD],
      ['UM TRIBUTO PIXEL AO CLASSICO', ASH],
      ['INSPIRADO EM GOD OF WAR III', '#7c2c26'],
      ['', ASH],
      ['CODIGO + ARTE PIXEL + SOM', CREAM],
      ['FEITO COM CANVAS PURO', ASH],
      ['', ASH],
      ['TODOS OS ASSETS GERADOS EM CODIGO', '#6b5b4c'],
      ['SEM SPRITES OU AUDIO EXTERNOS', '#6b5b4c'],
    ];
    lines.forEach(([txt, color], i) => {
      drawText(ctx, txt, 240, 90 + i * 11, { scale: 1, color, spacing: 1, align: 'center' });
    });
    drawText(ctx, this.app.isTouch ? 'TOQUE EM VOLTAR' : 'ESC / ENTER VOLTAR', 240, 198, { scale: 1, color: '#5a4a40', spacing: 1, align: 'center' });
  }

  drawToast(ctx) {
    if (!this.toast) return;
    const w = measureText(this.toast, 1, 1) + 20;
    const x = 240 - w / 2;
    px(ctx, x, 214, w, 15, 'rgba(10,4,4,0.94)');
    px(ctx, x, 214, w, 1, '#7c2c26');
    px(ctx, x, 228, w, 1, '#3a1512');
    drawText(ctx, this.toast, 240, 218, { scale: 1, color: '#e2b27a', spacing: 1, align: 'center' });
  }

  render(ctx) {
    const t = this.time;
    this.art.drawBackground(ctx, t);
    this.art.drawFigure(ctx);

    // drifting cinders over the figure
    for (const s of this.splash) {
      ctx.globalAlpha = 0.22 + (s.life * 0.3);
      ctx.fillStyle = '#c9a37a';
      ctx.fillRect(s.x | 0, s.y | 0, 1, 1);
    }
    ctx.globalAlpha = 1;

    this.art.drawBannerAndLogo(ctx);

    if (this.mode === 'root') {
      this.drawMenuItems(ctx);
      this.drawFooter(ctx);
    } else if (this.mode === 'options') {
      this.drawOptions(ctx);
    } else if (this.mode === 'treasures') {
      this.drawTreasures(ctx);
    } else if (this.mode === 'credits') {
      this.drawCredits(ctx);
    }
    this.drawToast(ctx);
  }
}
