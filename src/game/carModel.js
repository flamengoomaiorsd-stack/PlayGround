import * as THREE from 'three';
import { BODY_DIMS } from '../data/cars.js';

const PROFILE = {
  octane: {
    hull: [[0.4, 0.18], [0.06, 0.42], [0.08, 0.72], [0.35, 0.95], [1.0, 1.02], [3.35, 1.02], [3.9, 0.92], [4.3, 0.72], [4.38, 0.42], [4.18, 0.18], [3.2, 0.14], [0.8, 0.14]],
    cabin: [[1.05, 0.99], [1.62, 1.42], [2.85, 1.44], [3.52, 1.0]],
    cabinWidth: 1.78,
  },
  dominus: {
    hull: [[0.3, 0.16], [0.03, 0.5], [0.1, 0.82], [0.6, 0.92], [3.6, 0.92], [4.25, 0.8], [4.66, 0.52], [4.62, 0.28], [4.3, 0.14], [3.4, 0.12], [0.6, 0.12]],
    cabin: [[1.2, 0.9], [1.88, 1.24], [2.9, 1.26], [3.72, 0.92]],
    cabinWidth: 1.82,
  },
  hatch: {
    hull: [[0.3, 0.18], [0.04, 0.46], [0.08, 0.86], [0.4, 1.04], [2.95, 1.06], [3.55, 0.95], [3.82, 0.72], [3.86, 0.4], [3.7, 0.18], [3.0, 0.14], [0.7, 0.14]],
    cabin: [[0.75, 1.04], [1.28, 1.42], [2.85, 1.44], [3.42, 1.04]],
    cabinWidth: 1.72,
  },
  muscle: {
    hull: [[0.35, 0.18], [0.03, 0.48], [0.1, 0.88], [0.55, 0.98], [3.2, 1.0], [3.9, 0.94], [4.5, 0.86], [4.55, 0.2], [4.35, 0.16], [3.6, 0.14], [0.7, 0.14]],
    cabin: [[0.8, 0.97], [1.2, 1.38], [2.4, 1.4], [3.2, 1.0]],
    cabinWidth: 1.84,
  },
  truck: {
    hull: [[0.15, 0.3], [0.15, 1.05], [0.6, 1.1], [0.72, 1.85], [2.6, 1.9], [3.05, 1.3], [4.4, 1.1], [4.75, 0.8], [4.8, 0.4], [4.55, 0.26], [3.8, 0.24], [0.6, 0.24]],
    cabin: [[0.9, 1.78], [1.05, 1.96], [2.35, 1.98], [2.95, 1.32]],
    cabinWidth: 1.86,
  },
  wedge: {
    hull: [[0.4, 0.16], [0.05, 0.4], [0.08, 0.76], [0.5, 0.96], [2.8, 0.98], [3.6, 0.82], [4.35, 0.5], [4.56, 0.28], [4.3, 0.14], [3.3, 0.12], [0.9, 0.12]],
    cabin: [[1.4, 0.95], [2.0, 1.24], [2.92, 1.26], [3.6, 0.95]],
    cabinWidth: 1.7,
  },
  hyper: {
    hull: [[0.3, 0.15], [0.02, 0.38], [0.05, 0.68], [0.4, 0.9], [1.0, 0.94], [3.3, 0.94], [4.0, 0.85], [4.5, 0.6], [4.6, 0.32], [4.4, 0.15], [3.5, 0.11], [0.7, 0.11]],
    cabin: [[1.3, 0.9], [1.8, 1.18], [2.7, 1.2], [3.5, 0.92]],
    cabinWidth: 1.7,
  },
};

const glowCache = new Map();

export function radialGlowTexture(color = '#ffffff') {
  if (glowCache.has(color)) return glowCache.get(color);
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  glowCache.set(color, tex);
  return tex;
}

function extrudeProfile(points, width, {
  bevel = 0.09, bevelSegments = 2, depthJitter = 0,
} = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.2, width - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments,
    steps: 1,
    curveSegments: 5,
  });
  geo.rotateY(-Math.PI / 2);
  geo.translate(width / 2, 0, 0);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (bb) {
    const cx = (bb.min.x + bb.max.x) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    geo.translate(-cx, 0, -cz);
  }
  geo.computeVertexNormals();
  return geo;
}

function createWheel(radius, width, rimColor, tireColor = '#0a0c10') {
  const group = new THREE.Group();
  const spin = new THREE.Group();
  group.add(spin);
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 18, 1);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: tireColor, roughness: 0.92, metalness: 0.05 });
  const tire = new THREE.Mesh(tireGeo, tireMat);
  spin.add(tire);
  const rimGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width * 1.04, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.28, metalness: 0.9, emissive: rimColor, emissiveIntensity: 0.12 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  spin.add(rim);
  const hubGeo = new THREE.BoxGeometry(width * 1.1, radius * 0.16, radius * 0.16);
  const hub = new THREE.Mesh(hubGeo, rimMat);
  spin.add(hub);
  const hub2 = hub.clone();
  hub2.rotation.x = Math.PI / 2;
  spin.add(hub2);
  return { group, spin };
}

export function createCarModel(def, {
  bodyColor, accentColor, glowColor, rimColor, teamId = 0, name = '', plate = true,
} = {}) {
  const dims = BODY_DIMS[def.style] || BODY_DIMS.octane;
  const profile = PROFILE[def.style] || PROFILE.octane;
  const paint = def.paint;
  const teamGlow = glowColor || paint.glow;
  const body = bodyColor || paint.body;
  const accent = accentColor || paint.accent;
  const rim = rimColor || paint.rim;

  const group = new THREE.Group();
  group.name = `car-${def.id}`;
  const tilt = new THREE.Group();
  group.add(tilt);

  const hullGeo = extrudeProfile(profile.hull, dims.w, { bevel: 0.1 });
  const bodyMat = new THREE.MeshStandardMaterial({
    color: body, metalness: 0.62, roughness: 0.3,
    emissive: new THREE.Color(body).multiplyScalar(0.05), emissiveIntensity: 0.7,
  });
  const hull = new THREE.Mesh(hullGeo, bodyMat);
  hull.castShadow = false;
  tilt.add(hull);

  // dark under-body / floor pan
  const panGeo = new THREE.BoxGeometry(dims.w * 0.92, 0.16, dims.l * 0.9);
  const panMat = new THREE.MeshStandardMaterial({ color: '#080b11', metalness: 0.4, roughness: 0.8 });
  const pan = new THREE.Mesh(panGeo, panMat);
  pan.position.y = 0.2;
  tilt.add(pan);

  // glass canopy
  const glassGeo = extrudeProfile(profile.cabin, profile.cabinWidth, { bevel: 0.06, bevelSegments: 2 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#0b1524', metalness: 0.92, roughness: 0.12,
    emissive: new THREE.Color(teamGlow).multiplyScalar(0.08), emissiveIntensity: 0.8,
    envMapIntensity: 1.4,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  tilt.add(glass);

  // roof stripe (team accent)
  const roofHeight = Math.max(...profile.cabin.map((p) => p[1]));
  const roofStart = profile.cabin[1][0];
  const roofEnd = profile.cabin[2][0];
  const roofStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.06, Math.abs(roofEnd - roofStart)),
    new THREE.MeshStandardMaterial({ color: accent, emissive: new THREE.Color(teamGlow), emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.35 }),
  );
  roofStrip.position.set(0, roofHeight + 0.01, -(roofStart + roofEnd) / 2 + dims.l * 0.5);
  tilt.add(roofStrip);

  // side accent blades
  const bladeMat = new THREE.MeshStandardMaterial({
    color: accent, emissive: new THREE.Color(teamGlow), emissiveIntensity: 0.55,
    metalness: 0.5, roughness: 0.3,
  });
  for (const side of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, dims.l * 0.5), bladeMat);
    blade.position.set(side * (dims.w / 2 - 0.02), 0.62, -0.1);
    tilt.add(blade);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, dims.l * 0.46), panMat);
    skirt.position.set(side * (dims.w / 2 - 0.02), 0.3, -0.05);
    tilt.add(skirt);
  }

  // headlights + taillights
  const headMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#d8f6ff', emissiveIntensity: 3.4, roughness: 0.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#ff3040', emissive: '#ff2440', emissiveIntensity: 2.6, roughness: 0.3 });
  const frontZ = dims.l * 0.46;
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), headMat);
    hl.position.set(side * (dims.w * 0.32), profile.hull[profile.hull.length - 3][1] + 0.14, frontZ);
    tilt.add(hl);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.82, 0.09, 0.06), tailMat);
  tail.position.set(0, 0.82, -dims.l * 0.47);
  tilt.add(tail);

  // splitter & diffuser
  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w * 0.96, 0.07, 0.5),
    new THREE.MeshStandardMaterial({ color: '#10141c', metalness: 0.5, roughness: 0.5 }),
  );
  splitter.position.set(0, 0.22, dims.l * 0.44);
  tilt.add(splitter);

  // style extras
  const wingMat = new THREE.MeshStandardMaterial({ color: '#0f141d', metalness: 0.55, roughness: 0.4 });
  if (['hyper', 'wedge'].includes(def.style)) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.94, 0.07, 0.42), wingMat);
    wing.position.set(0, profile.hull[4][1] + 0.55, -dims.l * 0.39);
    tilt.add(wing);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.18), wingMat);
      strut.position.set(side * dims.w * 0.32, profile.hull[4][1] + 0.27, -dims.l * 0.4);
      tilt.add(strut);
    }
    const wingLip = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.94, 0.03, 0.06), bladeMat);
    wingLip.position.set(0, profile.hull[4][1] + 0.59, -dims.l * 0.39 + 0.2);
    tilt.add(wingLip);
  } else if (def.style === 'dominus') {
    const duck = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.8, 0.06, 0.26), wingMat);
    duck.position.set(0, 0.98, -dims.l * 0.42);
    tilt.add(duck);
  } else if (def.style === 'hatch') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.7, 0.06, 0.3), bladeMat);
    spoiler.position.set(0, 1.52, -dims.l * 0.4);
    tilt.add(spoiler);
  } else if (def.style === 'muscle') {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.13, 0.7), panMat);
    scoop.position.set(0, 1.04, dims.l * 0.2);
    tilt.add(scoop);
  } else if (def.style === 'truck') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 1.02, 0.16, 0.2), wingMat);
    bar.position.set(0, 1.12, dims.l * 0.46);
    tilt.add(bar);
    const bar2 = bar.clone();
    bar2.position.y = 0.62;
    tilt.add(bar2);
    for (const side of [-1, 1]) {
      const ver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.12), wingMat);
      ver.position.set(side * dims.w * 0.44, 0.88, dims.l * 0.47);
      tilt.add(ver);
    }
  } else {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.76, 0.05, 0.3), bladeMat);
    lip.position.set(0, 1.0, -dims.l * 0.43);
    tilt.add(lip);
  }

  // exhausts
  const exhaustMat = new THREE.MeshStandardMaterial({ color: '#1a2029', metalness: 0.95, roughness: 0.25 });
  for (const side of [-1, 1]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.24, 10), exhaustMat);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(side * dims.w * 0.22, 0.38, -dims.l * 0.46);
    tilt.add(ex);
  }

  // wheels
  const wheels = [];
  const wheelRadius = dims.h > 1.5 ? 0.58 : 0.51;
  const axleZ = dims.l * 0.31;
  for (const z of [-axleZ, axleZ]) {
    for (const side of [-1, 1]) {
      const { group: wheelGroup, spin } = createWheel(wheelRadius, 0.36, rim);
      wheelGroup.position.set(side * (dims.w / 2 - 0.06), wheelRadius, z);
      group.add(wheelGroup);
      wheels.push({ group: wheelGroup, spin, front: z > 0, side });
    }
  }

  // underglow
  const glowTex = radialGlowTexture(teamGlow);
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex, color: teamGlow, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(dims.w * 2.6, dims.l * 1.5), glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = 0.035;
  group.add(glowPlane);

  // blob shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128; shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d');
  const sgrad = sctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  sgrad.addColorStop(0, 'rgba(0,0,0,.65)');
  sgrad.addColorStop(0.6, 'rgba(0,0,0,.3)');
  sgrad.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = sgrad; sctx.fillRect(0, 0, 128, 128);
  const shTex = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(dims.w * 2.5, dims.l * 1.35), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0.85 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  // boost flames
  const flameGroup = new THREE.Group();
  flameGroup.position.set(0, 0.38, -dims.l * 0.47);
  const flameMat = new THREE.MeshBasicMaterial({
    color: teamGlow, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const innerMat = new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const flames = [];
  for (const side of [-1, 1]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.19, 1.3, 8, 1, true), flameMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(side * dims.w * 0.22, 0, -0.55);
    flameGroup.add(cone);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.8, 6, 1, true), innerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(side * dims.w * 0.22, 0, -0.35);
    flameGroup.add(inner);
    flames.push({ cone, inner });
  }
  flameGroup.visible = false;
  tilt.add(flameGroup);

  // nameplate sprite
  let nameSprite = null;
  if (plate && name) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.font = '700 46px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.9)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#eaf6ff';
    ctx.fillText(name.slice(0, 16).toUpperCase(), 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity: 0.92 });
    nameSprite = new THREE.Sprite(mat);
    nameSprite.scale.set(6.4, 1.6, 1);
    nameSprite.position.set(0, dims.h + 1.7, 0);
    nameSprite.renderOrder = 5;
    group.add(nameSprite);
  }

  return {
    group,
    tilt,
    wheels,
    flameGroup,
    flames,
    bodyMat,
    glowPlane,
    nameSprite,
    dims,
    roofSpark: roofStrip,
    glassMat,
    plate,
  };
}
