// Realistic rooftop guests: loads the MakeHuman-based model built by
// tools/woman/build_woman.py, gives it believable materials, a relaxed pose
// and strand hair grown from the scalp.
import * as THREE from 'three';

/** Skin with a soft sheen, glossy eyes, fabric bikini. */
export function upgradeMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m.name === 'skin') {
      o.material = new THREE.MeshPhysicalMaterial({
        name: 'skin', map: m.map, roughness: 0.52, metalness: 0,
        sheen: 0.35, sheenColor: new THREE.Color('#ffd9c7'), sheenRoughness: 0.55,
        clearcoat: 0.06, clearcoatRoughness: 0.5,
      });
    } else if (m.name === 'eyes') {
      o.material = new THREE.MeshPhysicalMaterial({ name: 'eyes', vertexColors: true, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
    } else if (m.name === 'bikini') {
      o.material = new THREE.MeshPhysicalMaterial({ name: 'bikini', color: m.color, roughness: 0.42, sheen: 0.6, sheenColor: m.color.clone().offsetHSL(0, 0, 0.2), side: THREE.DoubleSide });
    } else if (m.name === 'hair') {
      o.material = new THREE.MeshStandardMaterial({ name: 'scalp', color: m.color, roughness: 0.6 });
    }
  });
}

const bone = (root, name) => root.getObjectByName(name);

/** A natural standing pose: arms down, a little weight on one leg. */
export function poseRelaxed(root, { weight = 1 } = {}) {
  const pos = (n) => bone(root, n).getWorldPosition(new THREE.Vector3());
  root.updateMatrixWorld(true);
  for (const [side, s] of [['l', 1], ['r', -1]]) {
    const up = bone(root, `upperarm_${side}`);
    const a = pos(`upperarm_${side}`), b = pos(`lowerarm_${side}`);
    const cur = Math.atan2(b.y - a.y, (b.x - a.x) * s);
    const target = -1.38; // arm hanging slightly away from the body
    up.rotation.z += s * (target - cur);
    up.rotation.x = 0.05;
    bone(root, `lowerarm_${side}`).rotation.x = -0.18;
    bone(root, `lowerarm_${side}`).rotation.y = s * 0.3;
    bone(root, `hand_${side}`).rotation.x = -0.1;
  }
  // contrapposto
  bone(root, 'pelvis').rotation.z = 0.035 * weight;
  bone(root, 'thigh_l').rotation.z = -0.06 * weight;
  bone(root, 'thigh_r').rotation.z = 0.0;
  bone(root, 'calf_l').rotation.x = 0.12 * weight;
  bone(root, 'thigh_l').rotation.x = -0.06 * weight;
  bone(root, 'spine_02').rotation.z = -0.03 * weight;
  bone(root, 'neck_01').rotation.z = 0.03 * weight;
  bone(root, 'head').rotation.z = 0.04 * weight;
  root.updateMatrixWorld(true);
}

// bind-pose world position of a joint (joints have identity rotations in bind pose)
function bindPos(node) {
  const p = new THREE.Vector3();
  let n = node;
  while (n && n.isBone) {
    p.add(n.position);
    n = n.parent;
  }
  return p;
}

// one shared strand texture: many fine wispy hairs with alpha, tips thinning out
let strandTex = null;
function hairStrandTexture() {
  if (strandTex) return strandTex;
  const W = 256, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  let s = 3;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const x0 = rnd() * W;
    const len = H * (0.55 + rnd() * 0.45);
    const amp = 2 + rnd() * 5, freq = 0.004 + rnd() * 0.006, ph = rnd() * 6.28;
    const l = 55 + rnd() * 45;
    g.strokeStyle = `hsl(0,0%,${l}%)`;
    g.lineWidth = 0.7 + rnd() * 1.3;
    g.globalAlpha = 0.55 + rnd() * 0.45;
    g.beginPath();
    for (let y = 0; y <= len; y += 8) {
      // edges of the card thin out so cards blend into each other
      const x = x0 + Math.sin(y * freq + ph) * amp + (x0 - W / 2) * (y / H) * 0.12;
      y === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  // soft fade at the card edges and at the tips
  const img = g.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4 + 3;
    const edge = Math.min(1, Math.min(x, W - 1 - x) / (W * 0.18));
    const tip = Math.min(1, (H - y) / (H * 0.25));
    img.data[i] *= edge * (0.4 + 0.6 * tip);
  }
  g.putImageData(img, 0, 0);
  strandTex = new THREE.CanvasTexture(cv);
  strandTex.colorSpace = THREE.SRGBColorSpace;
  strandTex.anisotropy = 8;
  return strandTex;
}

/** Hair made of strand cards grown from the scalp, attached to the head bone. */
export function buildHair(root, info, { style = 'long-wavy', color = [0.16, 0.09, 0.05], seed = 7, part = 0.028, density = 1 } = {}) {
  const head = bone(root, 'head');
  const headBind = bindPos(head);
  const V3 = (a) => new THREE.Vector3(...a);
  const eyeL = V3(info.eyes[0]), eyeR = V3(info.eyes[1]);
  const eyeY = (eyeL.y + eyeR.y) / 2;
  const c = eyeL.clone().add(eyeR).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.022, -0.072)); // skull centre
  const roots = info.hairRoots.map(V3);
  const dists = roots.map((r) => r.distanceTo(c)).sort((a, b) => a - b);
  const R = dists[Math.floor(dists.length / 2)];
  const neckY = info.neck[1];
  const shY = info.shoulders[0][1];
  const shX = Math.abs(info.shoulders[0][0]);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const base = new THREE.Color().setRGB(...color, THREE.SRGBColorSpace);
  const long = style.startsWith('long');
  const wavy = style.includes('wavy');
  const positions = [], uvs = [], colors = [], indices = [];

  // envelope the hair rests on below the skull: back of the neck, then the shoulders/back
  const envelope = (p, side) => {
    if (p.y > neckY + 0.03) return p;
    const drop = neckY + 0.03 - p.y;
    const ax = Math.abs(p.x - c.x);
    const backZ = c.z - 0.085 - Math.min(drop, 0.12) * 0.28;
    // long hair falls down the back, behind the shoulders (no flaring out)
    const limit = ax < shX * 0.7 ? backZ : backZ - 0.02 - Math.min(ax - shX * 0.7, 0.08) * 0.6;
    if (p.z > limit) p.z += (limit - p.z) * 0.6;
    if (ax > shX * 0.95) p.x = c.x + Math.sign(p.x - c.x) * (shX * 0.95 + (ax - shX * 0.95) * 0.3);
    void side;
    return p;
  };

  const roots2 = [];
  for (const r of roots) {
    const front = r.z > c.z + 0.01;
    if (front && r.y < eyeY + 0.05) continue;
    if (!front && r.y < neckY + 0.04) continue;
    for (let k = 0; k < Math.round(5 * density); k++) {
      const j = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.022);
      roots2.push(r.clone().add(j).sub(c).setLength(R).add(c));
    }
  }

  const step = 0.012;
  for (const r0 of roots2) {
    for (let layer = 0; layer < 2; layer++) {
      const n0 = r0.clone().sub(c).normalize();
      const side = Math.sign(r0.x - part) || 1;
      const back = r0.z < c.z - 0.01;
      const front = r0.z > c.z + 0.03;
      const flow = back ? new THREE.Vector3(side * 0.1, -1, -0.2) : front ? new THREE.Vector3(side * 0.5, -0.2, -0.85) : new THREE.Vector3(side * 0.3, -1, -0.2);
      let dir = flow.clone().addScaledVector(n0, -flow.dot(n0)).normalize().addScaledVector(n0, 0.05).normalize();
      const len = (long ? (front ? 0.2 + rnd() * 0.05 : 0.44 + rnd() * 0.12) : 0.2 + rnd() * 0.05) * (layer ? 0.92 : 1);
      const n = Math.max(6, Math.round(len / step));
      const phase = rnd() * Math.PI * 2;
      const lift = R + 0.003 + layer * 0.004;
      let p = r0.clone().sub(c).setLength(lift).add(c);
      const pts = [p.clone()];
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        dir.add(new THREE.Vector3(0, -0.16, -0.01)).normalize();
        p = p.clone().addScaledVector(dir, step);
        const d = p.clone().sub(c);
        if (d.length() < lift) p = c.clone().add(d.setLength(lift));
        // the face stays clear: hair frames it, falling just beside the cheeks
        if (p.z > c.z + 0.02 && p.y < eyeY + 0.05 && p.y > eyeY - 0.14) {
          const minX = 0.095 + layer * 0.004;
          if (Math.abs(p.x - c.x) < minX) p.x = c.x + Math.sign(p.x - c.x || side) * minX;
        }
        envelope(p, side);
        // natural waves grow towards the ends
        if (wavy) {
          const w = Math.sin(t * 13 + phase) * 0.006 * Math.min(1, t * 2);
          p.x += w * side * 0.6;
          p.z += Math.cos(t * 13 + phase) * 0.003 * t;
        }
        pts.push(p.clone());
      }
      // the card
      const start = positions.length / 3;
      const tone = (layer ? 1.0 : 0.82) * (0.85 + rnd() * 0.3);
      const u0 = rnd() > 0.5 ? 0 : 1;
      for (let i = 0; i < pts.length; i++) {
        const t = i / (pts.length - 1);
        const tan = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize();
        const out = pts[i].clone().sub(new THREE.Vector3(c.x, Math.min(pts[i].y, c.y), c.z)).normalize();
        const sideV = new THREE.Vector3().crossVectors(tan, out).normalize();
        const w = (0.011 + rnd() * 0.002) * (1 - t * 0.35);
        const q = pts[i].clone().sub(headBind);
        positions.push(q.x - sideV.x * w, q.y - sideV.y * w, q.z - sideV.z * w, q.x + sideV.x * w, q.y + sideV.y * w, q.z + sideV.z * w);
        uvs.push(u0, t, 1 - u0, t);
        // darker at the roots, sun-lightened towards the ends
        const col = base.clone().multiplyScalar(tone * (0.72 + 0.4 * t));
        colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
        if (i < pts.length - 1) {
          const v = start + i * 2;
          indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: hairStrandTexture(), vertexColors: true, side: THREE.DoubleSide,
    alphaTest: 0.3, alphaToCoverage: true, roughness: 0.55, metalness: 0, envMapIntensity: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  head.add(mesh);
  root.traverse((o) => { if (o.isMesh && o.name === 'scalp') o.visible = false; });
  // cap: covers the scalp from the hairline back to the nape, streaked like hair
  const tilt = 0.4;
  // opaque streaked texture for the cap (the card texture is mostly transparent)
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const cg = cv.getContext('2d');
  cg.fillStyle = '#9a9a9a';
  cg.fillRect(0, 0, 512, 256);
  cg.drawImage(hairStrandTexture().image, 0, 0, 512, 256);
  const capTex = new THREE.CanvasTexture(cv);
  capTex.colorSpace = THREE.SRGBColorSpace;
  capTex.wrapS = THREE.RepeatWrapping;
  capTex.repeat.set(8, 1);
  capTex.rotation = Math.PI / 2;
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(R + 0.0025, 48, 20, 0, Math.PI * 2, 0, 1.68),
    new THREE.MeshStandardMaterial({ map: capTex, color: base.clone().multiplyScalar(0.9), roughness: 0.6 }),
  );
  cap.position.copy(c).sub(headBind);
  cap.rotation.x = -tilt;
  cap.castShadow = true;
  head.add(cap);
  return mesh;
}

/** Eyebrow hairs and eyelashes as fine strands laid on the face (bind pose, before posing). */
export function buildBrowsAndLashes(root, info, { color = [0.12, 0.08, 0.06] } = {}) {
  const head = bone(root, 'head');
  const headBind = bindPos(head);
  const body = root.getObjectByName('body');
  const ray = new THREE.Raycaster();
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const surface = (x, y, zFrom) => {
    // shoot from in front of the face straight back onto the skin (model space)
    const o = new THREE.Vector3(x, y, zFrom).applyMatrix4(root.matrixWorld);
    ray.set(o, new THREE.Vector3(0, 0, -1).transformDirection(root.matrixWorld));
    const hit = ray.intersectObject(body, false)[0];
    if (!hit) return null;
    const p = hit.point.clone().applyMatrix4(inv);
    const n = hit.face.normal.clone();
    return { p, n };
  };
  const base = new THREE.Color().setRGB(...color, THREE.SRGBColorSpace);
  const positions = [], colors = [], indices = [];
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ribbon = (pts, w0, w1, normal, col) => {
    const start = positions.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      const tan = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize();
      const sideV = new THREE.Vector3().crossVectors(tan, normal).normalize();
      const w = w0 + (w1 - w0) * t;
      const q = pts[i].clone().sub(headBind);
      positions.push(q.x - sideV.x * w, q.y - sideV.y * w, q.z - sideV.z * w, q.x + sideV.x * w, q.y + sideV.y * w, q.z + sideV.z * w);
      colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
      if (i < pts.length - 1) {
        const v = start + i * 2;
        indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
  };
  for (const [k, s] of [[0, 1], [1, -1]]) {
    const eye = new THREE.Vector3(...info.eyes[k]);
    // brows: ~90 short hairs along a soft arch, rising at the inner end, sweeping outward
    for (let i = 0; i < 150; i++) {
      const t = rnd();
      const ex = -0.014 + t * 0.046;
      const yc = 0.0215 + 0.0052 * Math.sin(Math.PI * Math.min(1, t * 1.12)) - 0.002 * t;
      const spread = (0.0016 * (1 - t) + 0.0006) * (rnd() * 2 - 1);
      const hit = surface(eye.x + s * ex, eye.y + yc + spread, eye.z + 0.08);
      if (!hit) continue;
      const len = 0.0032 + rnd() * 0.002;
      // inner hairs rise, the rest lie along the arch towards the tail
      const dir = new THREE.Vector3(s * (0.45 + t * 1.1), 0.9 - t * 0.95, 0).normalize();
      const pts = [];
      for (let j = 0; j <= 3; j++) {
        const p = hit.p.clone().addScaledVector(hit.n, 0.0004 + j * 0.0002).addScaledVector(dir, (len * j) / 3);
        pts.push(p);
      }
      ribbon(pts, 0.00026, 0.00008, hit.n, base.clone().multiplyScalar(0.55 + rnd() * 0.25));
    }
    // upper lashes: curl up and out from the lid edge, longer towards the outer corner
    for (let i = 0; i < 42; i++) {
      const t = i / 41;
      const ex = -0.010 + t * 0.028;
      const edge = 0.0046 * Math.cos(Math.max(-1.3, Math.min(1.3, ex / 0.017)));
      const hit = surface(eye.x + s * ex, eye.y + edge, eye.z + 0.06);
      if (!hit) continue;
      const len = 0.0055 + t * 0.003 + rnd() * 0.001;
      const pts = [];
      for (let j = 0; j <= 5; j++) {
        const u = j / 5;
        // out over the eye first, then curling up
        pts.push(hit.p.clone().add(new THREE.Vector3(s * (t - 0.3) * 0.0035 * u, len * 0.9 * u * u, len * 0.95 * u * (1 - u * 0.35))));
      }
      ribbon(pts, 0.00022, 0.00006, new THREE.Vector3(0, 0.2, 1).normalize(), new THREE.Color(0.03, 0.025, 0.025));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 }));
  mesh.frustumCulled = false;
  head.add(mesh);
  return mesh;
}
