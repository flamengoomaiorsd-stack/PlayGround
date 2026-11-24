import * as THREE from '../vendor/three.module.js';
import { WATER_LEVEL } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SKY_DAY_TOP = new THREE.Color(0x4f97d6);
const SKY_DAY_HORIZON = new THREE.Color(0xcfe7f4);
const SKY_DUSK_TOP = new THREE.Color(0x2a355f);
const SKY_DUSK_HORIZON = new THREE.Color(0xe8863c);
const SKY_NIGHT_TOP = new THREE.Color(0x070d22);
const SKY_NIGHT_HORIZON = new THREE.Color(0x16213e);
const SUN_DAY = new THREE.Color(0xfff4c4);
const SUN_DUSK = new THREE.Color(0xffa94d);
const CLOUD_DAY = new THREE.Color(0xffffff);
const CLOUD_NIGHT = new THREE.Color(0x3a4560);
const OCEAN_DAY = new THREE.Color(0x3f83bd);
const OCEAN_NIGHT = new THREE.Color(0x14243f);

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x9cc7e6, 1);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc9dfef, 62, 150);
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.08, 900);

    this.mode = 'menu';
    this.world = null;
    this.time = 0;
    this.parallax = { x: 0, y: 0, tx: 0, ty: 0 };
    this.cameraPos = new THREE.Vector3();
    this.dayFogColor = new THREE.Color(0xc9dfef);
    this.dayClearColor = new THREE.Color(0x9cc7e6);
    this._cTop = new THREE.Color();
    this._cHorizon = new THREE.Color();
    this._cSun = new THREE.Color();
    this._cFog = new THREE.Color();
    this._cCloud = new THREE.Color();
    this._moonDir = new THREE.Vector3();

    this.buildSky();
    this.buildSun();
    this.buildMoon();
    this.buildClouds();
    this.buildOcean();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  buildSky() {
    const uniforms = {
      topColor: { value: new THREE.Color(0x4f97d6) },
      horizonColor: { value: new THREE.Color(0xcfe7f4) },
      sunColor: { value: new THREE.Color(0xffe4a3) },
      sunDir: { value: new THREE.Vector3(-0.4, 0.58, -0.62).normalize() }
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -1.0, 1.0);
          vec3 col = mix(horizonColor, topColor, smoothstep(-0.04, 0.62, h));
          float sd = max(dot(d, sunDir), 0.0);
          col += sunColor * (pow(sd, 260.0) * 1.25 + pow(sd, 12.0) * 0.18);
          col = mix(col, horizonColor * 0.93, smoothstep(0.0, -0.2, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 20), material);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.skyUniforms = uniforms;
    this.sunDir = uniforms.sunDir.value;
  }

  buildSun() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff4c4,
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });
    this.sun = new THREE.Mesh(new THREE.CircleGeometry(17, 28), mat);
    this.sun.frustumCulled = false;
    this.sun.renderOrder = -9;
    this.scene.add(this.sun);
  }

  buildMoon() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xdfe8ff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide
    });
    this.moon = new THREE.Mesh(new THREE.CircleGeometry(11, 24), mat);
    this.moon.frustumCulled = false;
    this.moon.renderOrder = -9;
    this.moon.visible = false;
    this.scene.add(this.moon);
  }

  buildClouds() {
    this.clouds = new THREE.Group();
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      fog: true
    });
    this.cloudMat = cloudMat;
    const rng = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (let c = 0; c < 26; c++) {
      const cluster = new THREE.Group();
      const pieces = 2 + Math.floor(rng() * 3);
      for (let p = 0; p < pieces; p++) {
        const w = 6 + rng() * 16;
        const d = 5 + rng() * 12;
        const h = 2.2 + rng() * 2.2;
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cloudMat);
        box.position.set((rng() - 0.5) * (w * 0.9), (rng() - 0.5) * 1.5, (rng() - 0.5) * (d * 0.9));
        cluster.add(box);
      }
      cluster.position.set((rng() - 0.5) * 260, 38 + rng() * 12, (rng() - 0.5) * 260);
      cluster.userData.speed = 0.35 + rng() * 0.55;
      this.clouds.add(cluster);
    }
    this.scene.add(this.clouds);
  }

  setCloudsVisible(v) { this.clouds.visible = !!v; }

  /* ---- day / night cycle ---- */
  setDayCycle(dayTime) {
    const angle = (((dayTime % 1) + 1) % 1) * Math.PI * 2;
    const sunHeight = Math.sin(angle);
    const day = clamp((sunHeight + 0.08) / 0.46, 0, 1);
    const night = clamp((-sunHeight + 0.05) / 0.40, 0, 1);

    this.sunDir.set(Math.cos(angle) * 0.82, sunHeight, -0.55).normalize();

    const top = this._cTop.copy(SKY_DUSK_TOP).lerp(SKY_DAY_TOP, day).lerp(SKY_NIGHT_TOP, night);
    const horizon = this._cHorizon.copy(SKY_DUSK_HORIZON).lerp(SKY_DAY_HORIZON, day).lerp(SKY_NIGHT_HORIZON, night);
    this.skyUniforms.topColor.value.copy(top);
    this.skyUniforms.horizonColor.value.copy(horizon);
    const sun = this._cSun.copy(SUN_DUSK).lerp(SUN_DAY, day).multiplyScalar(1 - night * 0.95);
    this.skyUniforms.sunColor.value.copy(sun);

    this.dayFogColor.copy(horizon).lerp(SKY_NIGHT_TOP, night * 0.35);
    this.dayClearColor.copy(horizon).lerp(top, 0.35);
    this.scene.fog.color.copy(this.dayFogColor);
    this.renderer.setClearColor(this.dayClearColor, 1);

    if (this.sun) this.sun.visible = sunHeight > -0.06;
    if (this.moon) this.moon.visible = sunHeight < 0.06;
    if (this.cloudMat) {
      this.cloudMat.opacity = 0.82 - night * 0.55;
      this.cloudMat.color.copy(CLOUD_DAY).lerp(CLOUD_NIGHT, night);
    }
    if (this.ocean) this.ocean.material.color.copy(OCEAN_DAY).lerp(OCEAN_NIGHT, night);
  }

  resetSky() {
    this.setDayCycle(0.22);
    if (this.sun) this.sun.visible = true;
    if (this.moon) this.moon.visible = false;
    if (this.cloudMat) {
      this.cloudMat.opacity = 0.82;
      this.cloudMat.color.setHex(0xffffff);
    }
    if (this.ocean) this.ocean.material.color.setHex(0x3f83bd);
    this.dayFogColor.setHex(0xc9dfef);
    this.dayClearColor.setHex(0x9cc7e6);
    this.scene.fog.color.setHex(0xc9dfef);
    this.renderer.setClearColor(0x9cc7e6, 1);
  }

  buildOcean() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x3f83bd, fog: true });
    const geo = new THREE.PlaneGeometry(1400, 1400);
    this.ocean = new THREE.Mesh(geo, mat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = 8.74;
    this.ocean.renderOrder = -1;
    this.scene.add(this.ocean);
  }

  setPixelRatio(ratio) {
    this.renderer.setPixelRatio(clamp(ratio, 0.75, 2));
  }

  setWorld(world) {
    if (this.world && this.world.group.parent) {
      this.world.group.parent.remove(this.world.group);
    }
    this.world = world;
    this.scene.add(world.group);
    this.clouds.position.set(world.size / 2, 0, world.size / 2);
    this.ocean.position.x = world.size / 2;
    this.ocean.position.z = world.size / 2;
    if (this.mode === 'menu') {
      this.cameraPos.set(NaN, NaN, NaN);
      this.parallax.x = this.parallax.y = 0;
      this.parallax.tx = this.parallax.ty = 0;
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.scene.fog.near = mode === 'game' ? 55 : 62;
    this.scene.fog.far = mode === 'game' ? 150 : 155;
    this.camera.fov = mode === 'game' ? 75 : 74;
    this.camera.updateProjectionMatrix();
  }

  setRenderDistance(chunks) {
    if (this.mode !== 'game') return;
    const far = clamp(chunks * 16, 48, 260);
    this.scene.fog.far = far;
    this.scene.fog.near = far * 0.62;
    this.camera.far = Math.max(400, far + 200);
    this.camera.updateProjectionMatrix();
  }

  setFov(fov) {
    if (this.mode !== 'game') return;
    this.camera.fov = clamp(fov, 40, 120);
    this.camera.updateProjectionMatrix();
  }

  setPointer(nx, ny) {
    this.parallax.tx = clamp(nx, -1, 1);
    this.parallax.ty = clamp(ny, -1, 1);
  }

  updatePanorama(dt) {
    if (!this.world) return;
    const S = this.world.size;
    this.time += dt;
    const t = this.time;
    this.parallax.x += (this.parallax.tx - this.parallax.x) * Math.min(1, dt * 2.2);
    this.parallax.y += (this.parallax.ty - this.parallax.y) * Math.min(1, dt * 2.2);

    const angle = 2.32 + t * 0.018 + this.parallax.x * 0.075;
    const radius = S * 0.375;
    const cx = S / 2 + Math.cos(angle) * radius;
    const cz = S / 2 + Math.sin(angle) * radius;
    const ground = Math.max(this.world.surfaceY(cx, cz), WATER_LEVEL);
    const targetY = Math.max(29, Math.min(ground + 10, 38)) + Math.sin(t * 0.31) * 1.1 + this.parallax.y * 1.6;
    const px = cx + Math.cos(t * 0.07) * 1.2;
    const pz = cz + Math.sin(t * 0.06) * 1.2;

    if (!Number.isFinite(this.cameraPos.x)) this.cameraPos.set(px, targetY, pz);
    this.cameraPos.lerp(new THREE.Vector3(px, targetY, pz), Math.min(1, dt * 2.5));
    this.camera.position.copy(this.cameraPos);

    const lookX = S * 0.33;
    const lookZ = S * 0.33;
    const lookY = 18.5 + this.parallax.y * 2.4;
    this.camera.lookAt(lookX, lookY, lookZ);
    this.camera.fov = 78;
    this.camera.updateProjectionMatrix();
    this.scene.fog.far = 158;
    this.scene.fog.near = 64;
  }

  updateCommon(dt) {
    this.time += this.mode === 'menu' ? 0 : dt;
    if (this.sky) this.sky.position.copy(this.camera.position);
    if (this.sun) {
      this.sun.position.copy(this.camera.position).addScaledVector(this.sunDir, 430);
      this.sun.lookAt(this.camera.position);
    }
    if (this.moon && this.moon.visible) {
      this._moonDir.copy(this.sunDir).multiplyScalar(-1);
      this.moon.position.copy(this.camera.position).addScaledVector(this._moonDir, 430);
      this.moon.lookAt(this.camera.position);
    }
    if (this.clouds && this.clouds.visible) {
      for (const c of this.clouds.children) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 150) c.position.x = -150;
      }
    }
  }

  render(dt) {
    if (this.mode === 'menu') this.updatePanorama(dt);
    this.updateCommon(dt);
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    const mobile = Math.min(w, h) < 600;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
  }
}
