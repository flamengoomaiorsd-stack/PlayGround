import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ARENA } from './constants.js';
import { createCarModel, radialGlowTexture } from './carModel.js';
import { Arena } from './arena.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeBallTexture() {
  const W = 1024; const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a1520');
  bg.addColorStop(0.5, '#102434');
  bg.addColorStop(1, '#08121c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // hexagon tiling
  const hexR = 34;
  const hexW = Math.sqrt(3) * hexR;
  ctx.strokeStyle = 'rgba(140,240,255,.55)';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(80,230,255,.8)';
  ctx.shadowBlur = 9;
  for (let row = -1; row < H / (hexR * 1.5) + 1; row++) {
    for (let col = -1; col < W / hexW + 1; col++) {
      const cx = col * hexW + (row % 2 ? hexW / 2 : 0);
      const cy = row * hexR * 1.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        const x = cx + Math.cos(a) * hexR;
        const y = cy + Math.sin(a) * hexR;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(40,110,150,.18)' : 'rgba(20,60,90,.22)';
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
  // team bands
  ctx.fillStyle = 'rgba(53,200,255,.22)';
  ctx.fillRect(0, H * 0.08, W, 20);
  ctx.fillStyle = 'rgba(255,140,40,.2)';
  ctx.fillRect(0, H * 0.86, W, 20);
  // brand
  ctx.font = 'italic 900 80px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(220,250,255,.5)';
  ctx.fillText('TURBO', W / 2, H / 2 - 10);
  ctx.fillStyle = 'rgba(255,180,100,.5)';
  ctx.fillText('STRIKE', W / 2, H / 2 + 75);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function makeGlowTexture() {
  return radialGlowTexture('#ffffff');
}

class ParticleSystem {
  constructor(scene, count = 500) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.color = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.data = new Array(count).fill(null).map(() => ({ life: 0, maxLife: 1, vel: new THREE.Vector3(), grav: 0, drag: 0 }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {},
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vColor = aColor; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (260.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main(){
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.06, d) * vAlpha;
          gl_FragColor = vec4(vColor, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.geo = geo;
    this.cursor = 0;
    scene.add(this.points);
  }

  spawn({
    x, y, z, vx = 0, vy = 0, vz = 0, color = '#35f0ff', size = 2.2,
    life = 0.6, gravity = 0, drag = 0.9,
  }) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    const d = this.data[i];
    d.life = life; d.maxLife = life; d.grav = gravity; d.drag = drag;
    d.vel.set(vx, vy, vz);
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    const c = new THREE.Color(color);
    this.color[i * 3] = c.r; this.color[i * 3 + 1] = c.g; this.color[i * 3 + 2] = c.b;
    this.size[i] = size;
    this.alpha[i] = 1;
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      const d = this.data[i];
      if (d.life <= 0) { this.alpha[i] = 0; continue; }
      d.life -= dt;
      if (d.life <= 0) { this.alpha[i] = 0; continue; }
      d.vel.y -= d.grav * dt;
      const dragK = Math.pow(d.drag, dt * 60);
      d.vel.multiplyScalar(dragK);
      this.pos[i * 3] += d.vel.x * dt;
      this.pos[i * 3 + 1] += d.vel.y * dt;
      this.pos[i * 3 + 2] += d.vel.z * dt;
      const k = d.life / d.maxLife;
      this.alpha[i] = Math.min(1, k * 1.8);
      if (this.pos[i * 3 + 1] < 0.05) {
        this.pos[i * 3 + 1] = 0.05;
        d.vel.y *= -0.2;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

export class Renderer {
  constructor(canvas, { quality = 'high' } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality !== 'low',
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.quality = quality;
    this.setQuality(quality);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 900);
    this.scene.fog = new THREE.FogExp2('#071322', 0.0032);
    this.scene.background = new THREE.Color('#050a12');

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new RoomEnvironment();
    this.envMap = pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environment = this.envMap;
    envScene.dispose?.();
    pmrem.dispose();

    // lights
    this.hemi = new THREE.HemisphereLight('#9fd4ff', '#0a1220', 1.15);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#e6f7ff', 2.1);
    this.sun.position.set(-35, 60, 25);
    this.scene.add(this.sun);
    this.fill = new THREE.DirectionalLight('#ff9a5a', 0.55);
    this.fill.position.set(30, 24, -50);
    this.scene.add(this.fill);
    this.goalLightBlue = new THREE.PointLight('#35c8ff', 55, 70, 2);
    this.goalLightBlue.position.set(0, 12, -54);
    this.scene.add(this.goalLightBlue);
    this.goalLightOrange = new THREE.PointLight('#ff8a2e', 55, 70, 2);
    this.goalLightOrange.position.set(0, 12, 54);
    this.scene.add(this.goalLightOrange);

    this.arena = null;
    this.theme = null;
    this.world = null;
    this.carVisuals = new Map();
    this.particles = new ParticleSystem(this.scene, quality === 'low' ? 260 : 620);
    this.effects = [];
    this.cameraState = {
      mode: 'chase',
      menuAngle: 0,
      pos: new THREE.Vector3(0, 28, 100),
      look: new THREE.Vector3(0, 2, 0),
      shake: 0,
      fov: 70,
      goalFocus: 0,
      ballCam: true,
    };
    this.elapsed = 0;
    this.tmpQ = new THREE.Quaternion();
    this.tmpV = new THREE.Vector3();
    this.tmpV2 = new THREE.Vector3();
    this.ballTrailTimer = 0;
    this.boostTimers = new Map();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
    this.createBall();
  }

  setQuality(quality) {
    this.quality = quality;
    const dpr = window.devicePixelRatio || 1;
    const scale = quality === 'low' ? 1 : quality === 'medium' ? Math.min(dpr, 1.3) : Math.min(dpr, 1.8);
    this.renderer.setPixelRatio(scale);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  resize() {
    if (!this.renderer) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  setTheme(theme) {
    if (this.theme?.id === theme.id && this.arena) return;
    this.theme = theme;
    if (this.arena) this.arena.dispose();
    this.scene.fog = new THREE.FogExp2(theme.fog, 0.0034);
    this.scene.background = new THREE.Color(theme.skyTop);
    this.arena = new Arena(this.scene, theme);
    this.hemi.color.set(theme.ambient);
    this.hemi.groundColor.set(theme.fog);
    this.hemi.intensity = theme.id === 'sunset' ? 1.35 : 1.1;
    this.sun.color.set(theme.sun);
    this.sun.intensity = theme.id === 'sunset' ? 2.6 : 2.0;
    this.fill.intensity = theme.id === 'sunset' ? 0.9 : 0.5;
    this.scene.environmentIntensity = theme.id === 'sunset' ? 0.7 : 1.0;
  }

  createBall() {
    const group = new THREE.Group();
    const tex = makeBallTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      metalness: 0.55,
      roughness: 0.3,
      emissive: new THREE.Color('#8fe8ff'),
      emissiveMap: tex,
      emissiveIntensity: 0.5,
      envMapIntensity: 1.4,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(ARENA.ballRadius, 40, 28), mat);
    group.add(sphere);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: '#6fe4ff', transparent: true, opacity: 0.38,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(13, 13, 1);
    group.add(glow);
    // shadow
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA.ballRadius * 3.4, ARENA.ballRadius * 3.4),
      new THREE.MeshBasicMaterial({ map: makeGlowTexture(), color: '#000000', transparent: true, opacity: 0.5, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -ARENA.ballRadius + 0.06;
    group.add(shadow);
    const light = new THREE.PointLight('#7fe8ff', 26, 38, 2);
    light.position.y = 0;
    group.add(light);
    group.visible = false;
    this.scene.add(group);
    this.ballGroup = group;
    this.ballMesh = sphere;
    this.ballShadow = shadow;
    this.ballLight = light;
    this.ballTexture = tex;
  }

  loadWorld(world) {
    this.world = world;
    this.clearCars();
    this.setTheme(world.theme);
    this.ballGroup.visible = true;
    // pads
    if (this.padGroup) {
      this.scene.remove(this.padGroup);
      this.padGroup.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    }
    this.padGroup = new THREE.Group();
    this.scene.add(this.padGroup);
    for (const pad of world.pads) {
      const g = new THREE.Group();
      const color = pad.big ? '#ffd23f' : '#35f0ff';
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(pad.big ? 3.0 : 1.7, pad.big ? 6 : 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.08;
      g.add(disc);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(pad.big ? 3.0 : 1.7, pad.big ? 3.5 : 2.05, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.09;
      g.add(ring);
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(pad.big ? 0.22 : 0.12, pad.big ? 0.22 : 0.12, pad.big ? 1.5 : 0.6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      core.position.y = pad.big ? 0.8 : 0.35;
      g.add(core);
      if (pad.big) {
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(1.2, 2.4, 9, 12, 1, true),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        );
        beam.position.y = 4.6;
        g.add(beam);
      }
      g.position.set(pad.x, 0, pad.z);
      g.userData = { disc, ring, core };
      this.padGroup.add(g);
    }
    // cars
    for (const car of world.cars) {
      this.addCar(car);
    }
    this.cameraState.shake = 0;
    this.cameraState.goalFocus = 0;
  }

  addCar(car) {
    const teamId = car.team;
    const glow = teamId === 0 ? '#35c8ff' : '#ff8a2e';
    const body = teamId === 0 ? '#1a5fb8' : '#c04a10';
    const plate = !car.isLocal || this.world?.mode === 'demo' || this.world?.mode === 'online-guest';
    const name = car.isLocal ? 'VOCÊ' : car.name;
    const model = createCarModel(car.def, {
      bodyColor: body,
      accentColor: car.def.paint.accent,
      glowColor: glow,
      rimColor: car.def.paint.rim,
      teamId,
      name: plate ? name : '',
      plate,
    });
    const pivot = new THREE.Group();
    model.group.position.y = -car.centerY;
    pivot.add(model.group);
    pivot.position.set(car.pos.x, car.pos.y + car.centerY, car.pos.z);
    pivot.quaternion.copy(car.quat);
    this.scene.add(pivot);
    this.carVisuals.set(car.id, { pivot, model, car });
  }

  clearCars() {
    for (const [, visual] of this.carVisuals) {
      this.scene.remove(visual.pivot);
      visual.model.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m.map && m.map !== this.ballTexture) m.map.dispose?.();
            m.dispose?.();
          }
        }
      });
    }
    this.carVisuals.clear();
  }

  setCameraMode(mode) {
    this.cameraState.mode = mode;
  }

  toggleBallCam() {
    this.cameraState.ballCam = !this.cameraState.ballCam;
    return this.cameraState.ballCam;
  }

  addShake(amount) {
    this.cameraState.shake = Math.min(1.4, this.cameraState.shake + amount);
  }

  spawnBoost(car, dt) {
    if (!car.boostActive) return;
    const timerKey = car.id;
    const t = (this.boostTimers.get(timerKey) || 0) - dt;
    if (t > 0) { this.boostTimers.set(timerKey, t); return; }
    this.boostTimers.set(timerKey, 0.022);
    const q = car.quat;
    const back = this.tmpV.set(0, 0, -1).applyQuaternion(q);
    const side = this.tmpV2.set(1, 0, 0).applyQuaternion(q);
    for (const s of [-1, 1]) {
      const px = car.pos.x + back.x * (car.halfL + 0.4) + side.x * s * 0.45;
      const py = car.pos.y + 0.4 + back.z * (car.halfL + 0.4) + side.z * s * 0.45 + 0.4;
      const pz = car.pos.z + back.z * (car.halfL + 0.4) + side.z * s * 0.45;
      this.particles.spawn({
        x: px, y: py, z: pz,
        vx: back.x * 9 + (Math.random() - 0.5) * 2,
        vy: 0.4 + Math.random() * 1.2,
        vz: back.z * 9 + (Math.random() - 0.5) * 2,
        color: car.team === 0 ? '#35d8ff' : '#ff9a3c',
        size: 2.6 + Math.random() * 1.8,
        life: 0.24 + Math.random() * 0.16,
        drag: 0.92,
      });
    }
  }

  handleEvent(event, world) {
    if (!event) return;
    const p = event.pos;
    switch (event.type) {
      case 'hit': {
        if (!p) break;
        const count = Math.round(5 + event.power * 9);
        for (let i = 0; i < count; i++) {
          this.particles.spawn({
            x: p.x, y: p.y, z: p.z,
            vx: (Math.random() - 0.5) * 22, vy: Math.random() * 12, vz: (Math.random() - 0.5) * 22,
            color: Math.random() > 0.5 ? '#eaffff' : '#7fe8ff',
            size: 1.6 + Math.random() * 2.4,
            life: 0.3 + Math.random() * 0.3, gravity: 12, drag: 0.94,
          });
        }
        this.addShake(clamp(event.power * 0.24, 0.05, 0.45));
        break;
      }
      case 'jump': {
        const car = world?.getCar?.(event.carId);
        if (!car) break;
        for (let i = 0; i < 9; i++) {
          this.particles.spawn({
            x: car.pos.x + (Math.random() - 0.5) * 2, y: 0.2, z: car.pos.z + (Math.random() - 0.5) * 3,
            vx: (Math.random() - 0.5) * 7, vy: Math.random() * 2.4, vz: (Math.random() - 0.5) * 7,
            color: car.team === 0 ? '#7fe8ff' : '#ffb271', size: 2, life: 0.4, drag: 0.9,
          });
        }
        break;
      }
      case 'land': {
        const car = world?.getCar?.(event.carId);
        if (!car) break;
        for (let i = 0; i < 8; i++) {
          this.particles.spawn({
            x: car.pos.x + (Math.random() - 0.5) * 3, y: 0.15, z: car.pos.z + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 9, vy: 0.6 + Math.random(), vz: (Math.random() - 0.5) * 9,
            color: '#a9c6de', size: 2.4, life: 0.45, drag: 0.88,
          });
        }
        break;
      }
      case 'drift': {
        if (!p) break;
        this.particles.spawn({
          x: p.x + (Math.random() - 0.5) * 2, y: 0.2, z: p.z + (Math.random() - 0.5) * 3,
          vx: (Math.random() - 0.5) * 4, vy: 0.4 + Math.random(), vz: (Math.random() - 0.5) * 4,
          color: '#c8d8e8', size: 2.8, life: 0.5, drag: 0.9,
        });
        break;
      }
      case 'boost': {
        if (!p) break;
        for (let i = 0; i < (event.big ? 26 : 8); i++) {
          const a = (i / 12) * Math.PI * 2;
          this.particles.spawn({
            x: p.x + Math.cos(a) * 1.4, y: p.y + Math.random() * 1.4, z: p.z + Math.sin(a) * 1.4,
            vx: Math.cos(a) * (3 + Math.random() * 4), vy: 2 + Math.random() * 4, vz: Math.sin(a) * (3 + Math.random() * 4),
            color: event.big ? '#ffd76a' : '#7fe8ff', size: event.big ? 3.4 : 2.2,
            life: 0.5 + Math.random() * 0.3, drag: 0.92, gravity: 3,
          });
        }
        break;
      }
      case 'demolish': {
        if (!p) break;
        for (let i = 0; i < 60; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 6 + Math.random() * 22;
          this.particles.spawn({
            x: p.x, y: p.y + 1 + Math.random(), z: p.z,
            vx: Math.cos(a) * sp, vy: 3 + Math.random() * 14, vz: Math.sin(a) * sp,
            color: Math.random() > 0.4 ? '#ffb02e' : '#ffffff',
            size: 2 + Math.random() * 4, life: 0.5 + Math.random() * 0.7, gravity: 16, drag: 0.95,
          });
        }
        this.addShake(0.85);
        break;
      }
      case 'goal': {
        const z = event.team === 0 ? ARENA.halfL : -ARENA.halfL;
        const color = event.team === 0 ? '#35d8ff' : '#ff8a2e';
        for (let i = 0; i < 120; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 4 + Math.random() * 26;
          this.particles.spawn({
            x: (Math.random() - 0.5) * 24, y: 1 + Math.random() * 12, z: z + (Math.random() - 0.5) * 8,
            vx: Math.cos(a) * sp, vy: 4 + Math.random() * 18, vz: Math.sin(a) * sp,
            color: Math.random() > 0.35 ? color : '#ffffff',
            size: 2.4 + Math.random() * 4.2, life: 0.8 + Math.random() * 1.1, gravity: 9, drag: 0.94,
          });
        }
        this.addShake(0.9);
        this.cameraState.goalFocus = 2.2;
        this.spawnShockwave(z, color);
        break;
      }
      case 'flip': {
        if (!p) break;
        for (let i = 0; i < 12; i++) {
          this.particles.spawn({
            x: p.x + (Math.random() - 0.5) * 2, y: p.y + 0.5, z: p.z,
            vx: (Math.random() - 0.5) * 8, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 8,
            color: '#eafcff', size: 2.2, life: 0.35, drag: 0.9,
          });
        }
        break;
      }
      default: break;
    }
  }

  spawnShockwave(z, color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1, 1.6, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.3, z > 0 ? 55 : -55);
    this.scene.add(ring);
    this.effects.push({ mesh: ring, life: 1.1, maxLife: 1.1, grow: 22 });
    for (let i = 0; i < 3; i++) {
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(2 + i * 1.2, 2.5 + i * 1.2, 48),
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(0, 0.4, z > 0 ? 55 : -55);
      this.scene.add(halo);
      this.effects.push({ mesh: halo, life: 0.9, maxLife: 0.9, grow: 10 + i * 5 });
    }
  }

  update(dt, world, { cameraMode = 'chase', carId = null, paused = false } = {}) {
    this.elapsed += dt;
    if (!world) { this.renderer.render(this.scene, this.camera); return; }
    this.world = world;
    for (const car of world.cars) {
      const visual = this.carVisuals.get(car.id);
      if (!visual) { this.addCar(car); continue; }
      this.updateCarVisual(visual, car, dt);
      this.spawnBoost(car, dt);
    }
    // ball
    const ball = world.ball;
    this.ballGroup.visible = true;
    this.ballGroup.position.copy(ball.pos);
    const speed = ball.vel.length();
    const axis = this.tmpV.set(-ball.vel.z, 0, ball.vel.x).normalize();
    if (axis.lengthSq() > 0.001) {
      this.ballMesh.rotateOnWorldAxis(axis, speed * dt / ball.radius * 0.9);
    }
    this.ballShadow.position.y = -ball.pos.y + 0.06;
    this.ballShadow.material.opacity = clamp(0.5 - ball.pos.y * 0.01, 0.08, 0.5);
    this.ballShadow.scale.setScalar(clamp(1 - ball.pos.y * 0.01, 0.4, 1));
    // ball trail
    this.ballTrailTimer -= dt;
    if (speed > 16 && this.ballTrailTimer <= 0) {
      this.ballTrailTimer = 0.026;
      for (let i = 0; i < 2; i++) {
        this.particles.spawn({
          x: ball.pos.x + (Math.random() - 0.5) * 1.4,
          y: ball.pos.y + (Math.random() - 0.5) * 1.4,
          z: ball.pos.z + (Math.random() - 0.5) * 1.4,
          vx: 0, vy: 0.3, vz: 0,
          color: '#9ff2ff', size: 2.4 + speed * 0.03,
          life: 0.3, drag: 1,
        });
      }
    }
    // pads
    for (let i = 0; i < world.pads.length; i++) {
      const pad = world.pads[i];
      const g = this.padGroup.children[i];
      if (!g) continue;
      g.visible = pad.active;
      const { ring, core } = g.userData;
      const pulse = 1 + Math.sin(this.elapsed * 3 + i) * 0.08;
      ring.scale.setScalar(pulse);
      core.scale.y = pad.big ? 1 + Math.sin(this.elapsed * 5 + i) * 0.25 : 1;
    }
    // arena
    this.arena?.update(dt, this.elapsed);
    this.arena?.updateScreens({
      blue: world.score[0],
      orange: world.score[1],
      time: world.matchTime,
      phase: world.phase,
      overtime: world.overtime,
    });
    // particles & effects
    this.particles.update(dt);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      const k = e.life / e.maxLife;
      const s = 1 + (1 - k) * e.grow;
      e.mesh.scale.set(s, s, s);
      e.mesh.material.opacity = Math.max(0, k) * 0.8;
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
    // camera
    this.updateCamera(dt, world, { carId, mode: cameraMode, paused });
    this.renderer.render(this.scene, this.camera);
  }

  updateCarVisual(visual, car, dt) {
    const { pivot, model } = visual;
    pivot.visible = !car.hidden;
    pivot.position.set(car.pos.x, car.pos.y + car.centerY, car.pos.z);
    pivot.quaternion.copy(car.quat);
    if (car.flip) {
      const t = clamp(car.flip.t / car.flip.duration, 0, 1);
      const ease = Math.sin(t * Math.PI * 0.5);
      const angle = ease * Math.PI * 2;
      const axis = car.flip.axis === 'z' ? this.tmpV.set(0, 0, 1) : this.tmpV.set(1, 0, 0);
      this.tmpQ.setFromAxisAngle(axis, angle * (car.flip.axis === 'z' ? -car.flip.dir : 1));
      pivot.quaternion.multiply(this.tmpQ);
    }
    // wheels
    const steer = car.lastInput?.steer || 0;
    for (const wheel of model.wheels) {
      wheel.spin.rotation.x = car.wheelSpin;
      wheel.group.rotation.y = wheel.front ? steer * 0.4 : 0;
    }
    // flames
    const boosting = car.boostActive && car.boost > 0;
    model.flameGroup.visible = boosting;
    if (boosting) {
      const flicker = 0.85 + Math.sin(this.elapsed * 40 + car.pos.x) * 0.18;
      for (const f of model.flames) {
        f.cone.scale.set(1, flicker * (0.8 + Math.random() * 0.3), 1);
        f.inner.scale.set(1, flicker, 1);
      }
    }
    model.glowPlane.material.opacity = boosting ? 0.9 : 0.35 + Math.sin(this.elapsed * 2.5 + car.pos.z) * 0.06;
    // hit flash
    if (car.hitCooldown > 0) {
      model.bodyMat.emissive.set(car.team === 0 ? '#1e5f9e' : '#a23c0c');
      model.bodyMat.emissiveIntensity = 1.6;
    } else {
      model.bodyMat.emissive.set(car.team === 0 ? '#061a2a' : '#2a1002');
      model.bodyMat.emissiveIntensity = 0.8;
    }
    if (model.nameSprite) {
      model.nameSprite.visible = !car.hidden;
      model.nameSprite.material.opacity = car.isLocal ? 0.55 : 0.9;
    }
  }

  updateCamera(dt, world, { carId, mode, paused }) {
    const cam = this.camera;
    const state = this.cameraState;
    const local = carId ? world.cars.find((c) => c.id === carId) : world.cars.find((c) => c.isLocal);
    const ball = world.ball;
    if (mode === 'menu' || !local) {
      state.menuAngle += dt * 0.055;
      const radius = 108;
      const height = 40 + Math.sin(this.elapsed * 0.13) * 6;
      const targetPos = new THREE.Vector3(
        Math.sin(state.menuAngle) * radius,
        height,
        Math.cos(state.menuAngle) * radius,
      );
      state.pos.lerp(targetPos, 1 - Math.exp(-dt * 2.2));
      state.look.lerp(new THREE.Vector3(Math.sin(state.menuAngle * 0.6) * 8, 4, 0), 1 - Math.exp(-dt * 2));
      cam.position.copy(state.pos);
      cam.lookAt(state.look);
      cam.fov = 58;
      cam.updateProjectionMatrix();
      return;
    }
    const forward = this.tmpV.set(Math.sin(local.yaw), 0, Math.cos(local.yaw));
    const speed = local.vel.length();
    const dist = 10.6 + Math.min(4, speed * 0.06);
    const height = 4.4 + clamp(local.pos.y * 0.22, 0, 3) + (state.goalFocus > 0 ? 2 : 0);
    const ideal = new THREE.Vector3(
      local.pos.x - forward.x * dist,
      local.pos.y + height,
      local.pos.z - forward.z * dist,
    );
    // avoid camera going through walls
    ideal.x = clamp(ideal.x, -ARENA.halfW + 1.5, ARENA.halfW - 1.5);
    ideal.z = clamp(ideal.z, -ARENA.halfL + 1.5, ARENA.halfL - 1.5);
    ideal.y = clamp(ideal.y, 1.4, ARENA.height - 2);
    const smooth = 1 - Math.exp(-dt * (state.goalFocus > 0 ? 2.2 : 7.5));
    state.pos.lerp(ideal, smooth);

    let lookTarget;
    if (state.goalFocus > 0) {
      state.goalFocus -= dt;
      lookTarget = new THREE.Vector3(ball.pos.x, Math.max(1, ball.pos.y), ball.pos.z);
    } else if (state.ballCam) {
      lookTarget = new THREE.Vector3(
        ball.pos.x + ball.vel.x * 0.1,
        Math.max(1.2, ball.pos.y + 1),
        ball.pos.z + ball.vel.z * 0.1,
      );
    } else {
      lookTarget = new THREE.Vector3(
        local.pos.x + forward.x * 9,
        local.pos.y + 1.8,
        local.pos.z + forward.z * 9,
      );
    }
    state.look.lerp(lookTarget, 1 - Math.exp(-dt * (state.goalFocus > 0 ? 3 : 6)));
    cam.position.copy(state.pos);

    if (state.shake > 0.001) {
      const s = state.shake;
      cam.position.x += (Math.random() - 0.5) * s * 1.8;
      cam.position.y += (Math.random() - 0.5) * s * 1.2;
      cam.position.z += (Math.random() - 0.5) * s * 1.8;
      state.shake *= Math.exp(-dt * 5.5);
    }
    cam.lookAt(state.look);
    const targetFov = 68 + clamp(speed * 0.32, 0, 14) + (state.goalFocus > 0 ? 4 : 0);
    state.fov += (targetFov - state.fov) * Math.min(1, dt * 3);
    cam.fov = state.fov;
    cam.updateProjectionMatrix();
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    this.clearCars();
    this.arena?.dispose();
    this.particles.points.geometry.dispose();
    this.particles.points.material.dispose();
    this.renderer.dispose();
  }
}
