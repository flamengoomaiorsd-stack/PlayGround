import * as THREE from '../vendor/three.module.js';
import { BLOCKS, TILE, IS_SOLID, IS_PLANT, tileDataURL } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function pixelTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function armCanvas(zombie) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const palette = zombie
    ? ['#7d9a58', '#739050', '#88a562', '#698647', '#93b06e', '#5f7c40']
    : ['#c69a76', '#bd906c', '#cca27f', '#b98b66', '#d0a883'];
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 4) {
      g.fillStyle = palette[(Math.random() * palette.length) | 0];
      g.fillRect(x, y, 4, 4);
    }
  }
  if (zombie) {
    for (let i = 0; i < 10; i++) {
      const x = (Math.random() * 56) | 0;
      const y = (Math.random() * 56) | 0;
      g.fillStyle = 'rgba(28,48,16,.72)';
      g.fillRect(x, y, 4, 4);
    }
  }
  g.fillStyle = zombie ? 'rgba(18,32,10,.55)' : 'rgba(90,60,40,.35)';
  g.fillRect(0, 44, 64, 3);
  g.fillStyle = zombie ? '#c7d5ae' : '#e6c8aa';
  for (let x = 4; x < 64; x += 12) g.fillRect(x, 43, 5, 2);
  g.strokeStyle = 'rgba(22,32,14,.72)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 61, 61);
  return c;
}

function sleeveCanvas(zombie) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  const palette = zombie
    ? ['#2f5d74', '#2a5368', '#376a83', '#25495c']
    : ['#3e6fa8', '#39679c', '#4579b3', '#335d8f'];
  for (let y = 0; y < 32; y += 4) {
    for (let x = 0; x < 32; x += 4) {
      g.fillStyle = palette[(Math.random() * palette.length) | 0];
      g.fillRect(x, y, 4, 4);
    }
  }
  if (zombie) {
    g.fillStyle = 'rgba(10,20,26,.8)';
    for (let x = 0; x < 32; x += 8) {
      g.fillRect(x, 26, 4, 6);
      g.fillRect(x + 3, 23, 3, 4);
    }
  }
  g.strokeStyle = 'rgba(10,18,26,.75)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, 30, 30);
  return c;
}



const BLOCK_COLORS = {
  [BLOCKS.GRASS]: 0x6aa84f,
  [BLOCKS.DIRT]: 0x8a6142,
  [BLOCKS.STONE]: 0x8b8b8b,
  [BLOCKS.COBBLE]: 0x777777,
  [BLOCKS.SAND]: 0xe2d2a2,
  [BLOCKS.LOG]: 0x7a5837,
  [BLOCKS.PLANKS]: 0xb28a57,
  [BLOCKS.LEAVES]: 0x3a762e,
  [BLOCKS.SNOW]: 0xf2f7fb,
  [BLOCKS.WATER]: 0x4a90d9
};

const HOTBAR = [
  { block: BLOCKS.GRASS, tile: TILE.GRASS_SIDE, name: 'block.grass' },
  { block: BLOCKS.DIRT, tile: TILE.DIRT, name: 'block.dirt' },
  { block: BLOCKS.STONE, tile: TILE.STONE, name: 'block.stone' },
  { block: BLOCKS.COBBLE, tile: TILE.COBBLE, name: 'block.cobble' },
  { block: BLOCKS.SAND, tile: TILE.SAND, name: 'block.sand' },
  { block: BLOCKS.LOG, tile: TILE.LOG_SIDE, name: 'block.log' },
  { block: BLOCKS.PLANKS, tile: TILE.PLANKS, name: 'block.planks' },
  { block: BLOCKS.LEAVES, tile: TILE.LEAVES, name: 'block.leaves' },
  { block: BLOCKS.SNOW, tile: TILE.SNOW, name: 'block.snow' }
];

export class Game {
  constructor({ viewer, world, app, options, worldMeta, t }) {
    this.viewer = viewer;
    this.world = world;
    this.app = app;
    this.options = options;
    this.worldMeta = worldMeta;
    this.t = t;
    this.lang = app.lang;
    this.mods = { ...(worldMeta.mods || {}) };
    this.reach = this.mods.longReach ? 9 : 6;
    this.swingPhase = 1;
    this.handTime = 0;
    this.handBase = { x: 0.52, y: -0.42, z: -0.52, rx: 0.24, ry: 0.62, rz: 0.34 };

    this.canvas = viewer.canvas;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.creative = worldMeta.mode !== 'survival';
    this.paused = true;
    this.locked = false;
    this.hintVisible = false;
    this.destroyed = false;

    this.keys = new Set();
    this.jumpHeld = false;
    this.hotbar = HOTBAR;
    this.selected = 0;
    this.labelTimer = null;
    this.breakTimer = null;
    this.stats = { broken: 0, placed: 0, firstBreak: false, firstPlace: false, firstFly: false };

    this.player = {
      pos: new THREE.Vector3(world.spawn.x, world.spawn.y, world.spawn.z),
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: -0.06,
      onGround: false,
      fly: false,
      bob: 0,
      inWater: false,
      stepAccum: 0,
      lastSpace: 0
    };

    const S = world.size;
    const dx = S * 0.3 - this.player.pos.x;
    const dz = S * 0.3 - this.player.pos.z;
    this.player.yaw = Math.atan2(-dx, -dz);

    this.fps = 60;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    this.debug = false;
    this.currentFov = options.fov;
    this.particles = [];
    this.underwater = false;

    this.mpHandlers = {};
    this.dom = {
      hud: document.getElementById('hud'),
      hotbar: document.getElementById('hotbar'),
      label: document.getElementById('block-label'),
      hint: document.getElementById('game-hint'),
      hintName: document.getElementById('hint-name'),
      hintControls: document.querySelector('#game-hint .hint-controls'),
      touch: document.getElementById('touch-controls'),
      touchPause: document.getElementById('touch-pause'),
      debug: document.getElementById('debug-panel'),
      fpsNote: document.getElementById('fps-note'),
      joystick: document.getElementById('joystick'),
      knob: document.getElementById('joystick-knob')
    };

    this.joystick = { x: 0, y: 0, active: false, id: null };
    this.lookTouch = null;

    this.setupScene();
    this.buildHud();
    this.bind();
    this.updateCamera(0);
    this.showHud();
  }

  /* ---------------- setup ---------------- */
  setupScene() {
    this.viewer.setWorld(this.world);
    this.viewer.setMode('game');
    this.viewer.setRenderDistance(this.options.renderDistance);
    this.viewer.setCloudsVisible(this.options.clouds);
    this.viewer.camera.rotation.order = 'YXZ';
    this.viewer.camera.fov = this.options.fov;
    this.viewer.camera.updateProjectionMatrix();

    const box = new THREE.BoxGeometry(1.005, 1.005, 1.005);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthTest: true })
    );
    box.dispose();
    this.highlight.visible = false;
    this.highlight.renderOrder = 5;
    this.viewer.scene.add(this.highlight);

    this.particleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    this.particleMats = new Map();
    this.particleGroup = new THREE.Group();
    this.viewer.scene.add(this.particleGroup);

    document.body.classList.toggle('night-vision', !!this.mods.nightVision);
    this.buildHand();
  }

  buildHand() {
    const zombie = this.mods.zombieArm !== false;
    this.viewer.scene.add(this.viewer.camera);

    this.armGroup = new THREE.Group();
    this.handMaterials = [];
    this.handLights = new THREE.Group();
    const ambient = new THREE.AmbientLight(0xffffff, 0.82);
    const keyLight = new THREE.PointLight(0xfff4de, 0.9, 4.5, 2);
    keyLight.position.set(0.8, 1.1, -0.5);
    this.handLights.add(ambient, keyLight);
    this.viewer.camera.add(this.handLights);

    const skinMat = new THREE.MeshLambertMaterial({
      map: pixelTexture(armCanvas(zombie)), fog: false, depthTest: false, depthWrite: false
    });
    const sleeveMat = new THREE.MeshLambertMaterial({
      map: pixelTexture(sleeveCanvas(zombie)), fog: false, depthTest: false, depthWrite: false
    });
    this.handMaterials.push(skinMat, sleeveMat);

    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.23, 0.54), skinMat);
    armMesh.position.set(0, 0, -0.27);

    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.268, 0.268, 0.2), sleeveMat);
    sleeve.position.set(0, 0, -0.09);

    const meshes = [armMesh, sleeve];
    meshes.forEach((mesh, i) => {
      mesh.renderOrder = 30 + i;
      mesh.frustumCulled = false;
      this.armGroup.add(mesh);
    });

    this.armGroup.scale.setScalar(0.74);
    const b = this.handBase;
    this.armGroup.position.set(b.x, b.y, b.z);
    this.armGroup.rotation.set(b.rx, b.ry, b.rz);
    this.viewer.camera.add(this.armGroup);
  }

  swingHand() {
    this.swingPhase = 0;
  }

  updateHand(dt) {
    if (!this.armGroup) return;
    this.handTime += dt;
    const p = this.player;
    const aspect = this.viewer.camera.aspect || 1;
    const narrow = clamp(aspect / 1.33, 0.34, 1);
    const hspeed = Math.hypot(p.vel.x, p.vel.z);
    const walk = p.onGround && !p.fly ? clamp(hspeed / 4.15, 0, 1) : 0;
    this.swingPhase = Math.min(1, this.swingPhase + dt * 3.8);
    const s = this.swingPhase < 1 ? Math.sin(this.swingPhase * Math.PI) : 0;
    const idle = Math.sin(this.handTime * 1.7) * 0.006;
    const bobX = Math.sin(p.bob * 2.4) * 0.014 * walk;
    const bobY = Math.abs(Math.cos(p.bob * 2.4)) * 0.016 * walk;
    const b = this.handBase;
    this.armGroup.scale.setScalar(0.74 * clamp(narrow, 0.72, 1));
    this.armGroup.position.set(
      0.5 * narrow + bobX - s * 0.05,
      b.y - bobY + idle + s * 0.02,
      b.z + s * 0.16
    );
    this.armGroup.rotation.set(
      b.rx - s * 0.72,
      0.62 * clamp(narrow, 0.5, 1) + s * 0.16,
      b.rz + s * 0.22
    );
  }

  showHud() {
    this.dom.hud.hidden = false;
    this.dom.touch.hidden = !this.isTouch;
    this.dom.touchPause.hidden = !this.isTouch;
    this.dom.fpsNote.textContent = this.isTouch ? '' : '';
    if (this.isTouch) {
      document.body.classList.add('touch');
      this.dom.touch.hidden = false;
      this.dom.touchPause.hidden = false;
      this.select(0, true);
      this.started = true;
      this.paused = false;
      this.hideHint();
    } else {
      this.showHint();
    }
  }

  showHint() {
    this.hintVisible = true;
    this.dom.hint.hidden = false;
    this.dom.hintName.textContent = this.worldMeta.name;
    this.dom.hint.querySelector('.hint-play').textContent = this.t('game.clickToPlay');
    this.dom.hintControls.textContent = this.isTouch ? this.t('game.controlsTouch') : this.t('game.controls');
    this.dom.hintControls.hidden = this.isTouch;
  }

  hideHint() {
    this.hintVisible = false;
    this.dom.hint.hidden = true;
  }

  buildHud() {
    this.dom.hotbar.innerHTML = '';
    this.dom.hotbar.classList.toggle('interactive', this.isTouch);
    this.hotbar.forEach((item, i) => {
      const slot = document.createElement('div');
      slot.className = 'hot-slot' + (i === this.selected ? ' selected' : '');
      slot.dataset.index = String(i);
      const img = document.createElement('img');
      img.src = tileDataURL(item.tile, 4);
      img.alt = '';
      img.draggable = false;
      const num = document.createElement('span');
      num.className = 'hot-num';
      num.textContent = String(i + 1);
      slot.appendChild(img);
      slot.appendChild(num);
      if (this.isTouch) {
        slot.addEventListener('pointerdown', e => {
          e.stopPropagation();
          this.select(i);
        });
      }
      this.dom.hotbar.appendChild(slot);
    });
    this.select(this.selected, true);
  }

  select(index, silent = false) {
    this.selected = clamp(index, 0, this.hotbar.length - 1);
    [...this.dom.hotbar.children].forEach((el, i) => el.classList.toggle('selected', i === this.selected));
    if (!silent) {
      this.app.audio?.click();
      this.showBlockLabel();
    }
  }

  showBlockLabel() {
    const item = this.hotbar[this.selected];
    this.dom.label.textContent = this.t(item.name);
    this.dom.label.classList.add('show');
    clearTimeout(this.labelTimer);
    this.labelTimer = setTimeout(() => this.dom.label.classList.remove('show'), 1500);
  }

  /* ---------------- input ---------------- */
  bind() {
    const canvas = this.canvas;

    this.h = this.h || {};
    this.h.onPointerLockChange = () => {
      this.locked = document.pointerLockElement === canvas;
      if (this.locked) {
        this.hideHint();
        if (!this.paused) this.app.clearPause?.();
      } else if (!this.paused) {
        this.setPaused(true);
        this.app.showPause?.();
      }
    };
    document.addEventListener('pointerlockchange', this.h.onPointerLockChange);

    this.h.onMouseMove = e => {
      if (!this.locked || this.paused) return;
      const sens = (this.options.sensitivity / 100) * 0.0022;
      this.player.yaw -= e.movementX * sens;
      this.player.pitch -= e.movementY * sens;
      this.player.pitch = clamp(this.player.pitch, -1.53, 1.53);
    };
    document.addEventListener('mousemove', this.h.onMouseMove);

    this.h.onKeyDown = e => {
      if (this.paused && !['Escape'].includes(e.code)) return;
      if (['F3'].includes(e.code)) {
        e.preventDefault();
        this.debug = !this.debug;
        this.dom.debug.hidden = !this.debug;
        this.dom.fpsNote.style.display = this.debug ? 'none' : '';
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        const now = performance.now();
        if (this.creative && now - this.player.lastSpace < 300) {
          this.player.fly = !this.player.fly;
          this.player.vel.y = 0;
          if (this.player.fly && !this.stats.firstFly) {
            this.stats.firstFly = true;
            this.app.showAdvancement?.(this.t('game.broken'), this.t('game.flyDesc'), tileDataURL(TILE.GRASS_TOP, 4));
          }
        }
        this.player.lastSpace = now;
      }
      if (this.isTouch) return;
      this.keys.add(e.code);
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) this.select(n - 1);
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    document.addEventListener('keydown', this.h.onKeyDown);

    this.h.onKeyUp = e => {
      this.keys.delete(e.code);
    };
    document.addEventListener('keyup', this.h.onKeyUp);

    this.h.onWheel = e => {
      if (this.paused || !this.locked) return;
      e.preventDefault();
      const dir = Math.sign(e.deltaY);
      if (dir) this.select((this.selected + dir + this.hotbar.length) % this.hotbar.length);
    };
    canvas.addEventListener('wheel', this.h.onWheel, { passive: false });

    this.h.onCanvasMouseDown = e => {
      if (this.paused) {
        if (this.hintVisible) this.beginPlay();
        return;
      }
      if (!this.locked) {
        if (!this.isTouch) this.requestLock();
        return;
      }
      if (e.button === 0) { this.breakBlock(); this.startMining(); }
      else if (e.button === 2) { this.placeBlock(); }
    };
    canvas.addEventListener('mousedown', this.h.onCanvasMouseDown);

    this.h.onMouseUp = e => {
      if (e.button === 0) this.stopMining();
    };
    document.addEventListener('mouseup', this.h.onMouseUp);

    this.h.onContext = e => e.preventDefault();
    canvas.addEventListener('contextmenu', this.h.onContext);

    this.h.onCanvasClick = () => {
      if (this.isTouch) return;
      if (!this.paused) return;
      if (this.hintVisible) this.beginPlay();
    };
    canvas.addEventListener('click', this.h.onCanvasClick);

    // touch look
    this.h.onTouchStart = e => {
      if (!this.isTouch || this.paused) return;
      if (e.pointerType !== 'touch') return;
      this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    canvas.addEventListener('pointerdown', this.h.onTouchStart);
    this.h.onTouchMove = e => {
      if (!this.lookTouch || e.pointerId !== this.lookTouch.id) return;
      const dx = e.clientX - this.lookTouch.x;
      const dy = e.clientY - this.lookTouch.y;
      this.lookTouch.x = e.clientX;
      this.lookTouch.y = e.clientY;
      const sens = (this.options.sensitivity / 100) * 0.0042;
      this.player.yaw -= dx * sens;
      this.player.pitch = clamp(this.player.pitch - dy * sens, -1.53, 1.53);
    };
    window.addEventListener('pointermove', this.h.onTouchMove);
    this.h.onTouchEnd = e => {
      if (this.lookTouch && e.pointerId === this.lookTouch.id) this.lookTouch = null;
    };
    window.addEventListener('pointerup', this.h.onTouchEnd);
    window.addEventListener('pointercancel', this.h.onTouchEnd);

    // joystick
    this.h.onJoyDown = e => {
      e.preventDefault();
      e.stopPropagation();
      this.joystick.active = true;
      this.joystick.id = e.pointerId;
      this.dom.joystick.setPointerCapture(e.pointerId);
      this.moveJoystick(e);
    };
    this.h.onJoyMove = e => {
      if (!this.joystick.active || e.pointerId !== this.joystick.id) return;
      e.preventDefault();
      this.moveJoystick(e);
    };
    this.h.onJoyUp = e => {
      if (e.pointerId !== this.joystick.id) return;
      this.joystick.active = false;
      this.joystick.x = 0;
      this.joystick.y = 0;
      this.dom.knob.style.transform = '';
    };
    this.dom.joystick.addEventListener('pointerdown', this.h.onJoyDown);
    this.dom.joystick.addEventListener('pointermove', this.h.onJoyMove);
    this.dom.joystick.addEventListener('pointerup', this.h.onJoyUp);
    this.dom.joystick.addEventListener('pointercancel', this.h.onJoyUp);

    // touch buttons
    document.querySelectorAll('[data-touch]').forEach(btn => {
      const action = btn.dataset.touch;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        if (action === 'jump') { this.jumpHeld = true; }
        if (action === 'break') { this.breakBlock(); this.startMining(); }
        if (action === 'place') { this.placeBlock(); }
      });
      btn.addEventListener('pointerup', e => {
        e.preventDefault();
        if (action === 'jump') this.jumpHeld = false;
        if (action === 'break') this.stopMining();
      });
      btn.addEventListener('pointercancel', () => {
        if (action === 'jump') this.jumpHeld = false;
        if (action === 'break') this.stopMining();
      });
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });

    this.h.onTouchPause = () => this.app.showPause?.();
    this.dom.touchPause.addEventListener('click', this.h.onTouchPause);

    this.h.onBlur = () => { this.keys.clear(); this.jumpHeld = false; this.stopMining(); };
    window.addEventListener('blur', this.h.onBlur);

    this.h.onResize = () => {};
    window.addEventListener('orientationchange', this.h.onResize);
  }

  moveJoystick(e) {
    const rect = this.dom.joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = rect.width * 0.32;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    this.dom.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.joystick.x = dx / max;
    this.joystick.y = dy / max;
  }

  beginPlay() {
    this.paused = false;
    this.hideHint();
    this.keys.clear();
    if (!this.isTouch) this.requestLock();
    else this.app.clearPause?.();
  }

  requestLock() {
    if (this.isTouch) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* ignore */ }
  }

  setPaused(paused) {
    this.paused = paused;
    this.keys.clear();
    this.jumpHeld = false;
    this.stopMining();
    if (paused) {
      this.highlight.visible = false;
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    } else if (!this.isTouch) {
      this.requestLock();
    }
  }

  resume() {
    this.setPaused(false);
    if (!this.isTouch) {
      setTimeout(() => {
        if (!this.destroyed && !this.locked && !this.paused) this.showHint();
      }, 600);
    }
  }

  /* ---------------- physics & camera ---------------- */
  collides(x = this.player.pos.x, y = this.player.pos.y, z = this.player.pos.z) {
    const half = 0.3;
    const minX = Math.floor(x - half + 0.0001);
    const maxX = Math.floor(x + half - 0.0001);
    const minY = Math.floor(y + 0.0001);
    const maxY = Math.floor(y + 1.79);
    const minZ = Math.floor(z - half + 0.0001);
    const maxZ = Math.floor(z + half - 0.0001);
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (IS_SOLID(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }

  updatePlayer(dt) {
    const p = this.player;
    const keys = this.keys;
    const waterBlock = this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y + 0.9), Math.floor(p.pos.z));
    p.inWater = waterBlock === BLOCKS.WATER;

    let ix = 0, iz = 0;
    if (this.isTouch) {
      ix = this.joystick.x;
      iz = -this.joystick.y;
    } else {
      if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    }
    if (Math.hypot(ix, iz) > 1) { const l = Math.hypot(ix, iz); ix /= l; iz /= l; }

    const sprinting = !p.fly && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && iz > 0;
    const speedBoost = this.mods.rabbitBoots ? 1.4 : 1;
    const speed = (p.fly ? 10.5 : p.inWater ? 3.2 : sprinting ? 5.9 : 4.15) * speedBoost;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const dirX = -sin * iz + cos * ix;
    const dirZ = -cos * iz - sin * ix;
    const targetX = dirX * speed, targetZ = dirZ * speed;
    const accel = p.fly ? 12 : p.onGround ? 16 : p.inWater ? 6 : 4.5;
    const k = Math.min(1, accel * dt);
    p.vel.x += (targetX - p.vel.x) * k;
    p.vel.z += (targetZ - p.vel.z) * k;

    const jump = this.jumpHeld || (this.isTouch ? false : keys.has('Space'));
    if (p.fly) {
      let vy = 0;
      if (jump) vy += 7.5;
      if (keys.has('ShiftLeft') || keys.has('ShiftRight')) vy -= 7.5;
      p.vel.y += (vy - p.vel.y) * Math.min(1, 12 * dt);
    } else if (p.inWater) {
      p.vel.y -= 7 * dt;
      if (jump) p.vel.y = 4.0;
      p.vel.y = Math.max(p.vel.y, -3.0);
      p.vel.x *= 0.995;
      p.vel.z *= 0.995;
    } else {
      p.vel.y -= 28 * dt;
      if (jump && p.onGround) { p.vel.y = 8.4 * (this.mods.slimeJump ? 1.3 : 1); p.onGround = false; }
      if (p.vel.y < -40) p.vel.y = -40;
    }

    // integrate with small collision steps
    const maxSpeed = p.fly ? 12 : 10;
    p.vel.x = clamp(p.vel.x, -maxSpeed, maxSpeed);
    p.vel.z = clamp(p.vel.z, -maxSpeed, maxSpeed);
    const dx = p.vel.x * dt, dy = p.vel.y * dt, dz = p.vel.z * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.1));
    const sdt = dt / steps;
    let hitY = false;
    for (let i = 0; i < steps; i++) {
      p.pos.x += p.vel.x * sdt;
      if (this.collides()) { p.pos.x -= p.vel.x * sdt; p.vel.x = 0; }
      p.pos.z += p.vel.z * sdt;
      if (this.collides()) { p.pos.z -= p.vel.z * sdt; p.vel.z = 0; }
      p.pos.y += p.vel.y * sdt;
      if (this.collides()) {
        p.pos.y -= p.vel.y * sdt;
        if (p.vel.y < 0) { p.onGround = true; hitY = true; }
        p.vel.y = 0;
      }
    }

    const limit = this.world.size - 1.2;
    p.pos.x = clamp(p.pos.x, 1.2, limit);
    p.pos.z = clamp(p.pos.z, 1.2, limit);
    if (p.pos.y < -8) {
      p.pos.set(this.world.spawn.x, this.world.spawn.y + 2, this.world.spawn.z);
      p.vel.set(0, 0, 0);
    }

    if (!hitY) {
      p.onGround = this.collides(p.pos.x, p.pos.y - 0.06, p.pos.z);
    }
    if (p.fly && p.onGround) {
      // keep flying, but hover just above ground
      if (p.vel.y < 0) p.vel.y = 0;
    }

    // footsteps + bob
    const hspeed = Math.hypot(p.vel.x, p.vel.z);
    if (p.onGround && hspeed > 1.2 && !p.fly) {
      p.stepAccum += hspeed * dt;
      p.bob += hspeed * dt;
      if (p.stepAccum > 2.1) { p.stepAccum = 0; this.app.audio?.step(); }
    } else {
      p.bob *= Math.pow(0.001, dt);
      p.stepAccum = Math.min(p.stepAccum, 1.6);
    }

    this.sprinting = sprinting;
  }

  eyeHeight() { return 1.62; }

  updateCamera(dt) {
    const p = this.player;
    const moving = p.onGround && Math.hypot(p.vel.x, p.vel.z) > 0.8 && !p.fly;
    const bob = moving ? Math.sin(p.bob * 2.4) * 0.035 : 0;
    this.viewer.camera.position.set(p.pos.x, p.pos.y + this.eyeHeight() + bob, p.pos.z);
    this.viewer.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');

    const targetFov = this.options.fov + (this.sprinting && moving ? 5 : 0) + (p.fly ? 2 : 0);
    if (Math.abs(targetFov - this.currentFov) > 0.02) {
      this.currentFov += (targetFov - this.currentFov) * Math.min(1, dt * 8);
      this.viewer.camera.fov = this.currentFov;
      this.viewer.camera.updateProjectionMatrix();
    }

    const eyeBlock = this.world.getBlock(
      Math.floor(p.pos.x), Math.floor(p.pos.y + this.eyeHeight()), Math.floor(p.pos.z)
    );
    const underwater = eyeBlock === BLOCKS.WATER;
    if (underwater !== this.underwater) {
      this.underwater = underwater;
      document.body.classList.toggle('underwater', underwater);
      const fog = this.viewer.scene.fog;
      if (underwater) {
        this._fogColor = fog.color.getHex();
        this._fogNear = fog.near;
        this._fogFar = fog.far;
        fog.color.setHex(0x2c6fa8);
        fog.near = 0.5;
        fog.far = 22;
        this.viewer.renderer.setClearColor(0x2c6fa8, 1);
      } else {
        fog.color.setHex(this._fogColor ?? 0xc9dfef);
        fog.near = this._fogNear ?? 55;
        fog.far = this._fogFar ?? 150;
        this.viewer.renderer.setClearColor(0x9cc7e6, 1);
      }
    }
  }

  update(dt) {
    if (this.destroyed) return;
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum > 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    if (!this.paused) {
      if (this.isTouch || this.locked) {
        this.updatePlayer(dt);
        this.updateHighlight();
        this.updateParticles(dt);
      }
    }
    this.updateCamera(dt);
    this.updateHand(dt);
    if (!this.paused && (this.isTouch || this.locked)) {
      if (this.debug) this.updateDebug();
      if (this.isTouch) this.dom.fpsNote.textContent = '';
    }
  }

  updateHighlight() {
    const hit = this.raycast(this.reach);
    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.highlight.visible = false;
    }
  }

  updateDebug() {
    const p = this.player;
    const dirs = ['sul', 'sudoeste', 'oeste', 'noroeste', 'norte', 'nordeste', 'leste', 'sudeste'];
    const index = Math.round((((p.yaw * 180 / Math.PI) % 360) + 360) % 360 / 45) % 8;
    const dirNames = this.lang === 'pt' ? dirs : ['south', 'southwest', 'west', 'northwest', 'north', 'northeast', 'east', 'southeast'];
    const item = this.hotbar[this.selected];
    this.dom.debug.textContent =
      `${this.t('debug.fps')}: ${this.fps}\n` +
      `${this.t('debug.xyz')}: ${p.pos.x.toFixed(1)} / ${p.pos.y.toFixed(1)} / ${p.pos.z.toFixed(1)}\n` +
      `${this.t('debug.chunk')}: ${Math.floor(p.pos.x / 16)}, ${Math.floor(p.pos.z / 16)}\n` +
      `${this.t('debug.facing')}: ${dirNames[index]}\n` +
      `${this.t('debug.mode')}: ${this.creative ? this.t('mode.creative') : this.t('mode.survival')}${p.fly ? ' • ✈' : ''}\n` +
      `${this.t('debug.block')}: ${this.t(item.name)}\n` +
      `${this.t('debug.hint')}`;
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particleGroup.remove(pt.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      pt.vel.y -= 24 * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      pt.mesh.rotation.x += dt * 5;
      pt.mesh.rotation.y += dt * 4;
      const s = Math.max(0.02, pt.life / pt.maxLife);
      pt.mesh.scale.setScalar(s);
      if (pt.mesh.position.y < 0) pt.life = 0;
    }
  }

  /* ---------------- interaction ---------------- */
  raycast(maxDist = 6) {
    const p = this.player;
    const origin = new THREE.Vector3(p.pos.x, p.pos.y + this.eyeHeight(), p.pos.z);
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(p.pitch, p.yaw, 0, 'YXZ'));

    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x);
    const tDeltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y);
    const tDeltaZ = dir.z === 0 ? Infinity : Math.abs(1 / dir.z);
    let tMaxX = dir.x === 0 ? Infinity : (stepX > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tDeltaX;
    let tMaxY = dir.y === 0 ? Infinity : (stepY > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tDeltaY;
    let tMaxZ = dir.z === 0 ? Infinity : (stepZ > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tDeltaZ;
    let normal = [0, 0, 0];
    let t = 0;

    for (let i = 0; i < 200; i++) {
      const b = this.world.getBlock(x, y, z);
      if (b !== BLOCKS.AIR && b !== BLOCKS.WATER) {
        return { x, y, z, block: b, normal };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; normal = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; normal = [0, -stepY, 0];
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; normal = [0, 0, -stepZ];
      }
      if (t > maxDist) break;
      if (y < -1 || y >= this.world.height) break;
    }
    return null;
  }

  startMining() {
    this.stopMining();
    this.breakTimer = setInterval(() => {
      if (!this.paused && (this.isTouch || this.locked)) this.breakBlock();
    }, 240);
  }

  stopMining() {
    if (this.breakTimer) { clearInterval(this.breakTimer); this.breakTimer = null; }
  }

  breakBlock() {
    if (this.paused) return;
    this.swingHand();
    const hit = this.raycast(this.reach);
    if (!hit) return;
    if (hit.block === BLOCKS.BEDROCK) return;
    this.world.setBlock(hit.x, hit.y, hit.z, BLOCKS.AIR);
    if (IS_PLANT(hit.block) && hit.y > 0) {
      // nothing above plants
    }
    this.world.rebuildAround(hit.x, hit.z);
    this.spawnParticles(hit.x, hit.y, hit.z, hit.block);
    this.app.audio?.breakBlock(hit.block);
    this.app.recordEdit?.(hit.x, hit.y, hit.z, BLOCKS.AIR);
    this.app.addEmeralds?.(1);
    this.stats.broken++;
    if (!this.stats.firstBreak && !IS_PLANT(hit.block)) {
      this.stats.firstBreak = true;
      this.app.showAdvancement?.(this.t('game.broken'), this.t('game.brokenDesc'), tileDataURL(TILE.COBBLE, 4));
    }
  }

  placeBlock() {
    if (this.paused) return;
    this.swingHand();
    const hit = this.raycast(this.reach);
    if (!hit) return;
    const tx = hit.x + hit.normal[0];
    const ty = hit.y + hit.normal[1];
    const tz = hit.z + hit.normal[2];
    if (ty < 0 || ty >= this.world.height) return;
    const existing = this.world.getBlock(tx, ty, tz);
    if (!(existing === BLOCKS.AIR || existing === BLOCKS.WATER || IS_PLANT(existing))) return;
    const p = this.player;
    const overlap =
      tx + 1 > p.pos.x - 0.3 && tx < p.pos.x + 0.3 &&
      tz + 1 > p.pos.z - 0.3 && tz < p.pos.z + 0.3 &&
      ty + 1 > p.pos.y && ty < p.pos.y + 1.8;
    if (overlap) return;
    const block = this.hotbar[this.selected].block;
    const old = existing;
    this.world.setBlock(tx, ty, tz, block);
    this.world.rebuildAround(tx, tz);
    this.spawnParticles(tx, ty, tz, old === BLOCKS.AIR ? block : old);
    this.app.audio?.placeBlock();
    this.app.recordEdit?.(tx, ty, tz, block);
    this.stats.placed++;
    if (!this.stats.firstPlace && this.stats.placed >= 3) {
      this.stats.firstPlace = true;
      this.app.showAdvancement?.(this.t('game.broken'), this.t('game.placedDesc'), tileDataURL(TILE.PLANKS, 4));
    }
  }

  spawnParticles(x, y, z, block) {
    const color = BLOCK_COLORS[block] ?? 0x999999;
    let mat = this.particleMats.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color });
      this.particleMats.set(color, mat);
    }
    const count = 9;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6);
      const life = 0.45 + Math.random() * 0.35;
      const vel = new THREE.Vector3((Math.random() - 0.5) * 4.5, 1.5 + Math.random() * 3.5, (Math.random() - 0.5) * 4.5);
      const scale = 0.55 + Math.random() * 0.6;
      mesh.scale.setScalar(scale);
      this.particleGroup.add(mesh);
      this.particles.push({ mesh, vel, life, maxLife: life });
    }
  }

  /* ---------------- lifecycle ---------------- */
  dispose() {
    this.destroyed = true;
    this.stopMining();
    clearTimeout(this.labelTimer);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    document.removeEventListener('pointerlockchange', this.h.onPointerLockChange);
    document.removeEventListener('mousemove', this.h.onMouseMove);
    document.removeEventListener('keydown', this.h.onKeyDown);
    document.removeEventListener('keyup', this.h.onKeyUp);
    document.removeEventListener('mouseup', this.h.onMouseUp);
    this.canvas.removeEventListener('wheel', this.h.onWheel);
    this.canvas.removeEventListener('mousedown', this.h.onCanvasMouseDown);
    this.canvas.removeEventListener('contextmenu', this.h.onContext);
    this.canvas.removeEventListener('click', this.h.onCanvasClick);
    this.canvas.removeEventListener('pointerdown', this.h.onTouchStart);
    window.removeEventListener('pointermove', this.h.onTouchMove);
    window.removeEventListener('pointerup', this.h.onTouchEnd);
    window.removeEventListener('pointercancel', this.h.onTouchEnd);
    window.removeEventListener('blur', this.h.onBlur);
    window.removeEventListener('orientationchange', this.h.onResize);
    if (this.dom.touchPause) this.dom.touchPause.removeEventListener('click', this.h.onTouchPause);

    this.viewer.scene.remove(this.highlight);
    this.highlight.geometry.dispose();
    this.highlight.material.dispose();
    this.viewer.scene.remove(this.particleGroup);
    this.particleGeo.dispose();
    for (const m of this.particleMats.values()) m.dispose();
    this.particles = [];

    if (this.handLights) {
      this.viewer.camera.remove(this.handLights);
      this.handLights = null;
    }
    if (this.armGroup) {
      this.viewer.camera.remove(this.armGroup);
      for (const mesh of this.armGroup.children) {
        mesh.geometry.dispose();
      }
      for (const mat of this.handMaterials) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
      this.handMaterials = [];
      this.armGroup = null;
    }

    document.body.classList.remove('underwater', 'night-vision');
    this.dom.hud.hidden = true;
    this.dom.hint.hidden = true;
    this.dom.touch.hidden = true;
    this.dom.touchPause.hidden = true;
    this.dom.label.classList.remove('show');
    this.dom.debug.hidden = true;
  }
}
