import * as THREE from 'three';
import { ARENA } from './constants.js';
import { radialGlowTexture } from './carModel.js';

function makeFieldTexture(theme) {
  const W = 1024;
  const H = 1536;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const px = (x) => ((x / ARENA.halfW / 2) + 0.5) * W;
  const pz = (z) => ((z / ARENA.halfL / 2) + 0.5) * H;
  const sx = W / (ARENA.halfW * 2);
  const sz = H / (ARENA.halfL * 2);

  // base turf with mowing stripes
  ctx.fillStyle = theme.turfA;
  ctx.fillRect(0, 0, W, H);
  const stripe = 12;
  for (let z = -ARENA.halfL; z < ARENA.halfL; z += stripe * 2) {
    ctx.fillStyle = theme.turfB;
    ctx.fillRect(0, pz(z), W, stripe * sz);
  }
  // team tinted halves
  const blueGrad = ctx.createLinearGradient(0, pz(-ARENA.halfL), 0, pz(0));
  blueGrad.addColorStop(0, 'rgba(43,140,255,.12)');
  blueGrad.addColorStop(1, 'rgba(43,140,255,0)');
  ctx.fillStyle = blueGrad; ctx.fillRect(0, pz(-ARENA.halfL), W, H / 2);
  const orangeGrad = ctx.createLinearGradient(0, pz(ARENA.halfL), 0, pz(0));
  orangeGrad.addColorStop(0, 'rgba(255,106,16,.12)');
  orangeGrad.addColorStop(1, 'rgba(255,106,16,0)');
  ctx.fillStyle = orangeGrad; ctx.fillRect(0, pz(0), W, H / 2);

  // turf grain
  for (let i = 0; i < 9000; i++) {
    const gx = Math.random() * W;
    const gy = Math.random() * H;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.016)' : 'rgba(0,0,0,.05)';
    ctx.fillRect(gx, gy, 2 + Math.random() * 3, 1);
  }

  // faint hex grid
  ctx.strokeStyle = 'rgba(255,255,255,.025)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  const lineColor = theme.line;
  ctx.strokeStyle = lineColor;
  ctx.fillStyle = lineColor;
  ctx.shadowColor = lineColor;
  ctx.shadowBlur = 10;
  ctx.lineWidth = 5;
  // boundary
  ctx.strokeRect(px(-ARENA.halfW + 1.5), pz(-ARENA.halfL + 1.5), (ARENA.halfW * 2 - 3) * sx, (ARENA.halfL * 2 - 3) * sz);
  ctx.lineWidth = 3;
  // midline
  ctx.beginPath(); ctx.moveTo(px(-ARENA.halfW), pz(0)); ctx.lineTo(px(ARENA.halfW), pz(0)); ctx.stroke();
  // center circle
  ctx.beginPath(); ctx.ellipse(px(0), pz(0), 13 * sx, 13 * sz, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(px(0), pz(0), 2 * sx, 2 * sz, 0, 0, Math.PI * 2); ctx.fill();

  // goal boxes
  for (const end of [-1, 1]) {
    const zEdge = end * ARENA.halfL;
    const zBox = end * (ARENA.halfL - 15);
    ctx.strokeRect(px(-19), pz(Math.min(zEdge, zBox)), 38 * sx, 15 * sz);
    ctx.strokeRect(px(-ARENA.goalHalfW - 2), pz(Math.min(zEdge, zEdge - end * 5)), (ARENA.goalHalfW * 2 + 4) * sx, 5 * sz);
    // penalty arc
    ctx.beginPath();
    ctx.ellipse(px(0), pz(end * (ARENA.halfL - 15)), 15 * sx, 8 * sz, 0, end > 0 ? Math.PI : 0, end > 0 ? Math.PI * 2 : Math.PI);
    ctx.stroke();
  }

  // corners
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(px(x * (ARENA.halfW - 1.5)), pz(z * (ARENA.halfL - 1.5)), 4 * sx, 4 * sz, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // center emblem
  ctx.save();
  ctx.translate(px(0), pz(0));
  ctx.globalAlpha = 0.78;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 24;
  ctx.font = 'italic 900 64px "Arial Black", Arial, sans-serif';
  ctx.fillStyle = lineColor;
  ctx.fillText('TURBO', 0, -28);
  ctx.fillText('STRIKE', 0, 40);
  ctx.font = '700 17px "Segoe UI", Arial, sans-serif';
  ctx.globalAlpha = 0.5;
  ctx.fillText('A R E N A   D E   C A R R O S', 0, 96);
  ctx.restore();

  // sideline labels
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = lineColor;
  ctx.font = '700 20px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  for (const z of [-32, 32]) {
    ctx.save();
    ctx.translate(px(-ARENA.halfW + 4.5), pz(z));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('TURBO STRIKE', 0, 0);
    ctx.restore();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeGlowLineTexture(theme) {
  const W = 1024; const H = 1536;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.7;
  const px = (x) => ((x / ARENA.halfW / 2) + 0.5) * W;
  const pz = (z) => ((z / ARENA.halfL / 2) + 0.5) * H;
  const sx = W / (ARENA.halfW * 2);
  const sz = H / (ARENA.halfL * 2);
  ctx.strokeRect(px(-ARENA.halfW + 1.5), pz(-ARENA.halfL + 1.5), (ARENA.halfW * 2 - 3) * sx, (ARENA.halfL * 2 - 3) * sz);
  ctx.beginPath(); ctx.moveTo(0, pz(0)); ctx.lineTo(W, pz(0)); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(px(0), pz(0), 13 * sx, 13 * sz, 0, 0, Math.PI * 2); ctx.stroke();
  for (const end of [-1, 1]) {
    const zEdge = end * ARENA.halfL;
    const zBox = end * (ARENA.halfL - 15);
    ctx.strokeRect(px(-19), pz(Math.min(zEdge, zBox)), 38 * sx, 15 * sz);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addGoal(scene, end, theme) {
  const group = new THREE.Group();
  const zLine = end * ARENA.halfL;
  const zBack = end * (ARENA.halfL + ARENA.goalDepth);
  const halfW = ARENA.goalHalfW;
  const h = ARENA.goalHeight;
  const teamColor = end > 0 ? '#ff8a2e' : '#35c8ff';
  const frameMat = new THREE.MeshStandardMaterial({
    color: '#dff6ff', metalness: 0.5, roughness: 0.3,
    emissive: new THREE.Color(teamColor), emissiveIntensity: 1.5,
  });
  const postGeo = new THREE.CylinderGeometry(0.36, 0.42, h + 1.2, 10);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, frameMat);
    post.position.set(side * halfW, (h + 1.2) / 2, zLine);
    group.add(post);
    const glide = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, ARENA.goalDepth, 8), frameMat);
    glide.rotation.x = Math.PI / 2;
    glide.position.set(side * halfW, h + 0.6, zLine + end * ARENA.goalDepth / 2);
    group.add(glide);
    const backPost = postGeo.clone();
    const bp = new THREE.Mesh(backPost, frameMat);
    bp.position.set(side * halfW, (h + 1.2) / 2, zBack);
    bp.scale.y = 0.92;
    group.add(bp);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, halfW * 2 + 0.8, 10), frameMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, h + 1.2, zLine);
  group.add(bar);
  const backBar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, halfW * 2 + 0.4, 8), frameMat);
  backBar.rotation.z = Math.PI / 2;
  backBar.position.set(0, h + 0.3, zBack);
  group.add(backBar);
  for (const side of [-1, 1]) {
    const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, ARENA.goalDepth, 8), frameMat);
    topRail.rotation.x = Math.PI / 2;
    topRail.position.set(side * halfW, h + 0.4, zLine + end * ARENA.goalDepth / 2);
    group.add(topRail);
  }

  // net lines
  const netMat = new THREE.LineBasicMaterial({ color: teamColor, transparent: true, opacity: 0.2 });
  const netGeo = new THREE.BufferGeometry();
  const verts = [];
  const step = 1.8;
  for (let x = -halfW; x <= halfW; x += step) {
    verts.push(x, 0.5, zBack, x, h, zBack);
    verts.push(x, h, zBack, x, h, zLine);
  }
  for (let y = 0.5; y <= h; y += step) {
    verts.push(-halfW, y, zBack, halfW, y, zBack);
    verts.push(-halfW, y, zLine, -halfW, y, zBack);
    verts.push(halfW, y, zLine, halfW, y, zBack);
  }
  for (let z = Math.min(zLine, zBack); z <= Math.max(zLine, zBack); z += step) {
    verts.push(-halfW, h, z, halfW, h, z);
  }
  netGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  group.add(new THREE.LineSegments(netGeo, netMat));

  // goal back panel (dark, slight glow)
  const backPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(halfW * 2 + 2, h + 1),
    new THREE.MeshStandardMaterial({
      color: '#060b14', transparent: true, opacity: 0.88, roughness: 0.8, metalness: 0.3,
      emissive: new THREE.Color(teamColor), emissiveIntensity: 0.12,
    }),
  );
  backPanel.position.set(0, h / 2 + 0.5, zBack + end * 0.03);
  if (end > 0) backPanel.rotation.y = Math.PI;
  group.add(backPanel);

  // goal ground glow
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(halfW * 2 + 8, 10),
    new THREE.MeshBasicMaterial({
      map: radialGlowTexture(teamColor), color: teamColor, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.06, zLine + end * 3);
  group.add(glow);

  scene.add(group);
  return group;
}

function buildStands(theme) {
  const group = new THREE.Group();
  const crowdColors = ['#29425c', '#5c3a2a', '#2a4f4a', '#4b3b6b', '#777f8c', '#2b8cff', '#ff6a10', '#a8c4e0'];
  const palette = crowdColors.map((c) => new THREE.Color(c));
  const positions = [];
  const colors = [];
  const tierMat = new THREE.MeshStandardMaterial({ color: theme.stand, roughness: 0.85, metalness: 0.15 });
  const rows = 5;
  const pushCrowd = (x, y, z, rotation) => {
    positions.push({ x, y, z, rotation, s: 0.42 + Math.random() * 0.22 });
    const c = palette[Math.floor(Math.random() * palette.length)].clone();
    c.multiplyScalar(0.55 + Math.random() * 0.8);
    colors.push(c);
  };

  // side stands (left/right of field)
  for (const side of [-1, 1]) {
    for (let row = 0; row < rows; row++) {
      const x = side * (ARENA.halfW + 9 + row * 3.6);
      const y = 4 + row * 3.3;
      const tier = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.3, 150), tierMat);
      tier.position.set(x, y - 1.65, 0);
      group.add(tier);
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.14, 150),
        new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.28 }),
      );
      strip.position.set(x - side * 1.8, y + 0.02, 0);
      group.add(strip);
      for (let z = -71; z <= 71; z += 2.1) {
        if (Math.random() < 0.12) continue;
        pushCrowd(x - side * 0.2 + (Math.random() - 0.5) * 1.4, y + 0.55, z + (Math.random() - 0.5) * 0.8, side * -Math.PI / 2);
      }
    }
  }
  // end stands
  for (const end of [-1, 1]) {
    for (let row = 0; row < rows; row++) {
      const z = end * (ARENA.halfL + 9 + row * 3.6);
      const y = 4 + row * 3.3;
      const tier = new THREE.Mesh(new THREE.BoxGeometry(150, 3.3, 3.6), tierMat);
      tier.position.set(0, y - 1.65, z);
      group.add(tier);
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(150, 0.14, 0.18),
        new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.28 }),
      );
      strip.position.set(0, y + 0.02, z - end * 1.8);
      group.add(strip);
      for (let x = -71; x <= 71; x += 2.1) {
        if (Math.random() < 0.12) continue;
        pushCrowd(x + (Math.random() - 0.5) * 0.8, y + 0.55, z - end * 0.2 + (Math.random() - 0.5) * 1.4, end > 0 ? Math.PI : 0);
      }
    }
  }

  const crowdGeo = new THREE.BoxGeometry(0.62, 1.1, 0.5);
  const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.05 });
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.rotation, 0);
    dummy.scale.setScalar(p.s * 1.5);
    dummy.updateMatrix();
    crowd.setMatrixAt(i, dummy.matrix);
    crowd.setColorAt(i, colors[i]);
  });
  crowd.instanceMatrix.needsUpdate = true;
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  group.add(crowd);

  // outer wall ring behind stands
  const outerMat = new THREE.MeshStandardMaterial({ color: '#050a11', roughness: 0.95, metalness: 0.2 });
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 170), outerMat);
    wall.position.set(side * (ARENA.halfW + 27), 13, 0);
    group.add(wall);
    const wall2 = new THREE.Mesh(new THREE.BoxGeometry(170, 26, 2), outerMat);
    wall2.position.set(0, 13, side * (ARENA.halfL + 27));
    group.add(wall2);
  }
  return group;
}

function buildFloodlights(theme) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#1a2330', metalness: 0.7, roughness: 0.45 });
  const panelMat = new THREE.MeshStandardMaterial({
    color: '#ffffff', emissive: '#eaf7ff', emissiveIntensity: 3.2, roughness: 0.2,
  });
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const tower = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 34, 8), metal);
      pole.position.y = 17;
      tower.add(pole);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 0.8), metal);
      frame.position.y = 33.5;
      tower.add(frame);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 0.22), panelMat);
          lamp.position.set(-3 + i * 3, 32.8 + j * 1.3, x * z > 0 ? 0.45 : -0.45);
          lamp.lookAt(0, 0, 0);
          tower.add(lamp);
        }
      }
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: radialGlowTexture('#dff8ff'), color: '#dff8ff', transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sprite.scale.set(26, 26, 1);
      sprite.position.y = 33.5;
      tower.add(sprite);
      // beam cone toward center
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(17, 62, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.022, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      beam.position.y = 4;
      beam.rotation.x = Math.PI;
      tower.add(beam);
      tower.position.set(x * (ARENA.halfW + 26), 0, z * (ARENA.halfL + 26));
      group.add(tower);
    }
  }
  return group;
}

function buildSkyline(theme) {
  const group = new THREE.Group();
  const colors = ['#0b1a2a', '#0a1420', '#101b2b', '#0e2233'];
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2 + Math.random() * 0.1;
    const radius = 150 + Math.random() * 60;
    const h = 20 + Math.random() * 60;
    const w = 10 + Math.random() * 16;
    const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.9, metalness: 0.3, emissive: theme.accent, emissiveIntensity: 0.015 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    tower.position.set(Math.cos(angle) * radius, h / 2 - 2, Math.sin(angle) * radius);
    tower.rotation.y = Math.random();
    group.add(tower);
    // window strips
    const stripMat = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? '#ffb26b' : theme.accent, transparent: true, opacity: 0.5 });
    for (let s = 0; s < 3; s++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.3, 0.1), stripMat);
      strip.position.set(tower.position.x, 6 + Math.random() * (h - 12), tower.position.z + w / 2 + 0.06);
      group.add(strip);
    }
  }
  return group;
}

export class Arena {
  constructor(scene, theme) {
    this.scene = scene;
    this.theme = theme;
    this.group = new THREE.Group();
    this.group.name = 'arena';
    scene.add(this.group);
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 1024;
    this.screenCanvas.height = 360;
    this.screenCtx = this.screenCanvas.getContext('2d');
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screens = [];
    this.state = { blue: 0, orange: 0, time: 180, phase: 'countdown', overtime: false };
    this.build();
    this.updateScreens(this.state);
  }

  build() {
    const theme = this.theme;
    // floor
    const floorMat = new THREE.MeshStandardMaterial({
      map: makeFieldTexture(theme),
      roughness: 0.78,
      metalness: 0.15,
      emissive: new THREE.Color(theme.line),
      emissiveIntensity: 0.035,
      emissiveMap: makeGlowLineTexture(theme),
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.halfW * 2, ARENA.halfL * 2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    this.group.add(floor);

    // outer apron
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240),
      new THREE.MeshStandardMaterial({ color: '#05090f', roughness: 0.95, metalness: 0.2 }),
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.06;
    this.group.add(apron);

    // glass walls / barriers
    const barrierMat = new THREE.MeshStandardMaterial({
      color: theme.line, transparent: true, opacity: 0.055, roughness: 0.1, metalness: 0.9,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const trimMat = new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: 0.6 });
    const baseMat = new THREE.MeshStandardMaterial({ color: '#0c1622', metalness: 0.6, roughness: 0.5 });

    const addWall = (w, h, d, x, y, z) => {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), barrierMat);
      glass.position.set(x, y, z);
      this.group.add(glass);
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 1.5, d), baseMat);
      base.position.set(x, 0.75, z);
      this.group.add(base);
    };
    addWall(0.35, ARENA.wallH, ARENA.halfL * 2, -ARENA.halfW, ARENA.wallH / 2, 0);
    addWall(0.35, ARENA.wallH, ARENA.halfL * 2, ARENA.halfW, ARENA.wallH / 2, 0);
    for (const end of [-1, 1]) {
      const z = end * ARENA.halfL;
      const sideW = ARENA.halfW - ARENA.goalHalfW;
      addWall(sideW, ARENA.wallH, 0.35, -(ARENA.goalHalfW + sideW / 2), ARENA.wallH / 2, z);
      addWall(sideW, ARENA.wallH, 0.35, ARENA.goalHalfW + sideW / 2, ARENA.wallH / 2, z);
      addWall(ARENA.goalHalfW * 2, ARENA.wallH - ARENA.goalHeight, 0.35, 0, ARENA.goalHeight + (ARENA.wallH - ARENA.goalHeight) / 2, z);
    }

    // neon top trim
    const trimPieces = [
      [-ARENA.halfW, ARENA.wallH, 0, 0.24, 0.24, ARENA.halfL * 2],
      [ARENA.halfW, ARENA.wallH, 0, 0.24, 0.24, ARENA.halfL * 2],
    ];
    for (const [x, y, z, w, h, d] of trimPieces) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      trim.position.set(x, y, z);
      this.group.add(trim);
    }
    for (const end of [-1, 1]) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(ARENA.halfW * 2, 0.24, 0.24), trimMat);
      trim.position.set(0, ARENA.wallH, end * ARENA.halfL);
      this.group.add(trim);
    }
    // wall vertical ribs
    const ribMat = new THREE.MeshStandardMaterial({ color: '#16283a', metalness: 0.75, roughness: 0.35, emissive: theme.accent, emissiveIntensity: 0.05 });
    for (let z = -ARENA.halfL + 10; z <= ARENA.halfL - 10; z += 10) {
      for (const side of [-1, 1]) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.16, ARENA.wallH, 0.7), ribMat);
        rib.position.set(side * ARENA.halfW, ARENA.wallH / 2, z);
        this.group.add(rib);
      }
    }

    // goals
    addGoal(this.group, -1, theme);
    addGoal(this.group, 1, theme);

    // corner pylons
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        const pylon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7, 1.1, ARENA.wallH + 3, 8),
          new THREE.MeshStandardMaterial({ color: '#14202e', metalness: 0.55, roughness: 0.4, emissive: theme.accent, emissiveIntensity: 0.12 }),
        );
        pylon.position.set(x * ARENA.halfW, (ARENA.wallH + 3) / 2, z * ARENA.halfL);
        this.group.add(pylon);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.4, 8), trimMat);
        cap.position.set(x * ARENA.halfW, ARENA.wallH + 3, z * ARENA.halfL);
        this.group.add(cap);
      }
    }

    // stands + crowd
    this.group.add(buildStands(theme));
    this.group.add(buildFloodlights(theme));
    if (theme.id !== 'sunset') this.group.add(buildSkyline(theme));

    // big screens
    for (const end of [-1, 1]) {
      const screenMat = new THREE.MeshBasicMaterial({ map: this.screenTexture, toneMapped: false });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(30, 10.5), screenMat);
      screen.position.set(0, 21, end * (ARENA.halfL + 12));
      if (end > 0) screen.rotation.y = Math.PI;
      this.group.add(screen);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(32.4, 12.6, 1),
        new THREE.MeshStandardMaterial({ color: '#0a111c', metalness: 0.7, roughness: 0.4, emissive: theme.accent, emissiveIntensity: 0.09 }),
      );
      frame.position.set(0, 21, end * (ARENA.halfL + 12.6));
      this.group.add(frame);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({
        map: radialGlowTexture(theme.accent), color: theme.accent, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      gl.scale.set(44, 22, 1);
      gl.position.set(0, 21, end * (ARENA.halfL + 11));
      this.group.add(gl);
      this.screens.push(screen);
    }

    // sky dome
    const skyGeo = new THREE.SphereGeometry(420, 32, 18);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(theme.skyTop) },
        bottom: { value: new THREE.Color(theme.skyBottom) },
      },
      vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 bottom;
        void main(){ float h = clamp(normalize(vPos).y * 1.4 + 0.15, 0.0, 1.0); vec3 c = mix(bottom, top, pow(h, 0.75)); gl_FragColor = vec4(c, 1.0); }`,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(sky);
    this.sky = sky;

    if (theme.id === 'neon' || theme.id === 'frost') {
      const stars = new THREE.BufferGeometry();
      const starPos = [];
      for (let i = 0; i < 400; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.42;
        const r = 380;
        starPos.push(Math.cos(theta) * Math.sin(phi) * r, Math.cos(phi) * r + 20, Math.sin(theta) * Math.sin(phi) * r);
      }
      stars.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
      this.group.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: '#cfeeff', size: 1.5, transparent: true, opacity: 0.7, depthWrite: false, sizeAttenuation: true })));
    } else {
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(22, 20, 20),
        new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0.9 }),
      );
      sun.position.set(-120, 55, -260);
      this.group.add(sun);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: radialGlowTexture('#ffb26b'), color: '#ffb26b', transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.scale.set(160, 160, 1);
      halo.position.copy(sun.position);
      this.group.add(halo);
    }

    // ambient floating dust
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = [];
    for (let i = 0; i < 160; i++) dustPos.push((Math.random() - 0.5) * 150, Math.random() * 30, (Math.random() - 0.5) * 150);
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPos, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: theme.accent, size: 0.28, transparent: true, opacity: 0.35, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    this.group.add(this.dust);
  }

  updateScreens(state) {
    this.state = { ...this.state, ...state };
    const { blue, orange, time, phase, overtime } = this.state;
    const ctx = this.screenCtx;
    const W = this.screenCanvas.width;
    const H = this.screenCanvas.height;
    ctx.fillStyle = '#050b14';
    ctx.fillRect(0, 0, W, H);
    const grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, 'rgba(43,140,255,.28)');
    grd.addColorStop(0.5, 'rgba(5,11,20,0)');
    grd.addColorStop(1, 'rgba(255,106,16,.25)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // frame lines
    ctx.strokeStyle = 'rgba(120,200,255,.28)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 900 46px "Arial Black", Arial, sans-serif';
    ctx.fillStyle = '#8fd0ff';
    ctx.fillText('AZUL', W * 0.22, 70);
    ctx.fillStyle = '#ffb887';
    ctx.fillText('LARANJA', W * 0.78, 70);
    ctx.font = 'italic 900 150px "Arial Black", Arial, sans-serif';
    ctx.fillStyle = '#eaf7ff';
    ctx.fillText(String(blue), W * 0.22, 200);
    ctx.fillText(String(orange), W * 0.78, 200);
    ctx.font = 'italic 700 52px "Arial Black", Arial, sans-serif';
    const m = Math.floor(Math.max(0, time) / 60);
    const s = Math.floor(Math.max(0, time) % 60);
    ctx.fillStyle = overtime ? '#ff8a2e' : '#bfe8ff';
    ctx.fillText(phase === 'ended' ? 'FIM' : overtime ? 'OT' : `${m}:${String(s).padStart(2, '0')}`, W / 2, 130);
    ctx.font = '700 24px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(160,200,235,.7)';
    ctx.fillText('TURBO STRIKE  •  ARENA DE CARROS', W / 2, 205);
    ctx.font = 'italic 900 30px "Arial Black", Arial, sans-serif';
    ctx.fillStyle = '#7fe4ff';
    ctx.fillText('VS', W / 2, 250);

    // bottom ticker
    ctx.fillStyle = 'rgba(53,240,255,.08)';
    ctx.fillRect(0, H - 58, W, 46);
    ctx.font = '700 20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(200,235,255,.75)';
    ctx.fillText(overtime ? 'PRORROGAÇÃO — PRÓXIMO GOL VENCE' : phase === 'countdown' ? 'PREPARE-SE PARA O KICKOFF' : 'TURBO STRIKE • RANQUEADA ONLINE', W / 2, H - 35);
    this.screenTexture.needsUpdate = true;
  }

  update(dt, elapsed) {
    if (this.dust) {
      const pos = this.dust.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * (0.4 + (i % 5) * 0.12);
        if (y > 32) y = 0;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      this.dust.rotation.y = elapsed * 0.004;
    }
    if (this.sky) this.sky.rotation.y = elapsed * 0.002;
  }

  dispose() {
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
    this.scene.remove(this.group);
  }
}
