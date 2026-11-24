import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCarModel } from '../game/carModel.js';

export class CarPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.scene.environment = (() => {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const env = new RoomEnvironment();
      const tex = pmrem.fromScene(env, 0.04).texture;
      env.dispose?.();
      pmrem.dispose();
      return tex;
    })();
    this.hemi = new THREE.HemisphereLight('#cfe8ff', '#0b1220', 1.4);
    this.scene.add(this.hemi);
    const key = new THREE.DirectionalLight('#ffffff', 3.2);
    key.position.set(4, 7, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#59e6ff', 2.2);
    rim.position.set(-6, 3, -5);
    this.scene.add(rim);
    const warm = new THREE.PointLight('#ff9a52', 30, 20, 2);
    warm.position.set(-3, 2, 4);
    this.scene.add(warm);

    this.carGroup = null;
    this.angle = 0;
    this.visible = false;
    this.raf = null;
    this.last = performance.now();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.resize();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth || 480;
    const h = parent.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setCar(def) {
    if (this.carDef === def) return;
    this.carDef = def;
    if (this.carGroup) {
      this.scene.remove(this.carGroup);
      this.carGroup.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) { m.map?.dispose?.(); m.dispose?.(); }
        }
      });
    }
    const model = createCarModel(def, {
      bodyColor: def.paint.body,
      accentColor: def.paint.accent,
      glowColor: def.paint.glow,
      rimColor: def.paint.rim,
      teamId: 0,
      plate: false,
    });
    const group = new THREE.Group();
    // scale & center the car nicely
    const box = new THREE.Box3().setFromObject(model.group);
    const height = box.max.y - box.min.y;
    const scale = 1.7 / height;
    model.group.scale.setScalar(scale);
    model.group.position.y = 0;
    group.add(model.group);
    // platform glow
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 40),
      new THREE.MeshBasicMaterial({ color: def.paint.glow, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    group.add(glow);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.3, 3.55, 64),
      new THREE.MeshBasicMaterial({ color: def.paint.glow, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);
    this.scene.add(group);
    this.carGroup = group;
    this.model = model;
    this.camera.position.set(5.6, 3.1, 6.4);
    this.camera.lookAt(0, 0.9, 0);
    this.render(0);
  }

  setVisible(visible) {
    this.visible = visible;
    if (visible) {
      this.resize();
      if (!this.raf) {
        this.last = performance.now();
        const loop = (t) => {
          if (!this.visible) { this.raf = null; return; }
          const dt = Math.min(0.05, (t - this.last) / 1000);
          this.last = t;
          this.angle += dt * 0.42;
          this.render(dt);
          this.raf = requestAnimationFrame(loop);
        };
        this.raf = requestAnimationFrame(loop);
      }
    }
  }

  render(dt) {
    if (!this.carGroup) return;
    this.carGroup.rotation.y = this.angle;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.visible = false;
    this.resizeObserver.disconnect();
    this.renderer.dispose();
  }
}
