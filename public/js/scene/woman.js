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

/** Strand hair grown from the scalp, attached to the head bone. */
export function buildHair(root, info, { style = 'long-wavy', color = [0.16, 0.09, 0.05], seed = 7, part = 0.028 } = {}) {
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
  const shoulderY = info.shoulders[0][1];
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const base = new THREE.Color().setRGB(...color, THREE.SRGBColorSpace);
  const long = style.startsWith('long');
  const wavy = style.includes('wavy');
  const positions = [], colors = [], indices = [];

  // roots: the scalp from the hairline up and round the back (never the face)
  const strands = [];
  for (const r of roots) {
    const front = r.z > c.z + 0.01;
    if (front && r.y < eyeY + 0.05) continue;
    if (!front && r.y < neckY + 0.04) continue;
    for (let k = 0; k < 20; k++) {
      const j = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.02);
      strands.push(r.clone().add(j).sub(c).setLength(R).add(c));
    }
  }

  const step = 0.01;
  for (const r0 of strands) {
    const n0 = r0.clone().sub(c).normalize();
    const side = Math.sign(r0.x - part) || 1;
    const back = r0.z < c.z - 0.01;
    const front = r0.z > c.z + 0.03;
    // flow: from the parting out and down, front hair swept to the side and back
    // side part: hair falls from the parting; the front is swept back off the face
    const flow = back ? new THREE.Vector3(side * 0.15, -1, -0.25) : front ? new THREE.Vector3(side * 0.35, 0.15, -1) : new THREE.Vector3(side * 0.75, -0.7, -0.35);
    let dir = flow.clone().addScaledVector(n0, -flow.dot(n0)).normalize().addScaledVector(n0, 0.06).normalize();
    const len = long ? 0.46 + rnd() * 0.1 - (front ? 0.05 : 0) : 0.2 + rnd() * 0.04;
    const n = Math.round(len / step);
    const phase = rnd() * Math.PI * 2;
    const tone = 0.8 + rnd() * 0.32;
    let p = r0.clone();
    const pts = [p.clone()];
    for (let i = 1; i <= n; i++) {
      dir.add(new THREE.Vector3(0, -0.11, -0.012)).normalize();
      p = p.clone().addScaledVector(dir, step);
      // outside the skull
      const d = p.clone().sub(c);
      if (d.length() < R + 0.002) p = c.clone().add(d.setLength(R + 0.002));
      // keep the face clear: hair falls beside it
      if (p.z > c.z + 0.02 && p.y < eyeY + 0.045 && p.y > eyeY - 0.13 && Math.abs(p.x - c.x) < 0.098) p.x = c.x + Math.sign(p.x - c.x || side) * 0.098;
      // down the back, over the shoulder blades
      if (p.y < neckY + 0.02) {
        const backZ = c.z - 0.088 - Math.max(0, neckY - p.y) * 0.22;
        const ax = Math.abs(p.x - c.x);
        if (ax < 0.15 && p.z > backZ) p.z = backZ;
        if (ax >= 0.15 && ax < 0.24 && p.y > shoulderY - 0.06 && p.z > backZ + 0.02) p.z = backZ + 0.02;
      }
      pts.push(p.clone());
    }
    const start = positions.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const tan = b.clone().sub(a).normalize();
      const out = pts[i].clone().sub(c).normalize();
      const sideV = new THREE.Vector3().crossVectors(tan, out).normalize();
      const w = 0.0014 * (1 - t * 0.55);
      const wave = wavy ? Math.sin(t * 16 + phase) * 0.007 * Math.min(1, t * 2.5) : 0;
      const q = pts[i].clone().addScaledVector(sideV, wave).addScaledVector(out, wavy ? Math.cos(t * 16 + phase) * 0.003 * t : 0).sub(headBind);
      positions.push(q.x - sideV.x * w, q.y - sideV.y * w, q.z - sideV.z * w, q.x + sideV.x * w, q.y + sideV.y * w, q.z + sideV.z * w);
      const col = base.clone().multiplyScalar(tone * (0.75 + t * 0.3));
      colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
      if (i < pts.length - 1) {
        const v = start + i * 2;
        indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.0, envMapIntensity: 0.35 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  head.add(mesh);
  root.traverse((o) => { if (o.isMesh && o.name === 'scalp') o.material.color.copy(base).multiplyScalar(0.65); });
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
      ribbon(pts, 0.00026, 0.00008, hit.n, base.clone().multiplyScalar(1.15 + rnd() * 0.5));
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
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 }));
  mesh.frustumCulled = false;
  head.add(mesh);
  return mesh;
}
