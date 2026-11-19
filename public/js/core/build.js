// Small helpers for assembling furniture and architecture from primitives.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}

/** Box positioned by its bottom-centre (y is the bottom). */
export function box(w, h, d, mat, x, y, z, parent, opts) {
  const g = cached(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
  return mesh(g, mat, x, y + h / 2, z, parent, opts);
}

/** Rounded box positioned by bottom-centre. */
export function rbox(w, h, d, r, mat, x, y, z, parent, opts) {
  const g = cached(`r${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)));
  return mesh(g, mat, x, y + h / 2, z, parent, opts);
}

/** Cylinder positioned by bottom-centre. */
export function cyl(rt, rb, h, mat, x, y, z, parent, seg = 24, opts) {
  const g = cached(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
  return mesh(g, mat, x, y + h / 2, z, parent, opts);
}

export function sphere(r, mat, x, y, z, parent, seg = 24, opts) {
  const g = cached(`s${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75)));
  return mesh(g, mat, x, y, z, parent, opts);
}

export function plane(w, h, mat, x, y, z, parent, opts) {
  const g = new THREE.PlaneGeometry(w, h);
  return mesh(g, mat, x, y, z, parent, { cast: false, ...opts });
}

/** Horizontal floor plane with UVs scaled so textures keep a constant size. */
export function floorPlane(w, d, mat, x, y, z, parent, tile = 4) {
  const g = new THREE.PlaneGeometry(w, d);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
  const m = mesh(g, mat, x, y, z, parent, { cast: false });
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Vertical wall plane with world-scaled UVs. */
export function wallPlane(w, h, mat, x, y, z, rotY, parent, tile = 3) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
  const m = mesh(g, mat, x, y + h / 2, z, parent, { cast: false });
  m.rotation.y = rotY;
  return m;
}

/** A glass window wall with mullions, spanning x0..x1 at depth z (or along z if axis='z'). */
export function windowWall({ parent, axis = 'x', from, to, at, y0, h, mullion = 2.2, frameMat, glassMat, transom = true }) {
  const len = to - from;
  const n = Math.max(1, Math.round(len / mullion));
  const step = len / n;
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(len, h), glassMat);
  glass.renderOrder = 2;
  const posAlong = (s) => (axis === 'x' ? [s, 0, at] : [at, 0, s]);
  const [gx, , gz] = posAlong(from + len / 2);
  glass.position.set(gx, y0 + h / 2, gz);
  if (axis === 'z') glass.rotation.y = Math.PI / 2;
  g.add(glass);
  for (let i = 0; i <= n; i++) {
    const s = from + i * step;
    const [x, , z] = posAlong(s);
    box(axis === 'x' ? 0.08 : 0.14, h, axis === 'x' ? 0.14 : 0.08, frameMat, x, y0, z, g);
  }
  const rail = (yy, th) => {
    const [x, , z] = posAlong(from + len / 2);
    box(axis === 'x' ? len : 0.16, th, axis === 'x' ? 0.16 : len, frameMat, x, yy, z, g);
  };
  rail(y0, 0.12);
  rail(y0 + h - 0.12, 0.12);
  if (transom) rail(y0 + 0.55, 0.05);
  parent.add(g);
  return g;
}

/** Simple potted plant. */
export function plant(parent, x, y, z, { scale = 1, pot = null, leafMat, seed = 1 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  cyl(0.22, 0.17, 0.42, pot, 0, 0, 0, g, 20);
  cyl(0.2, 0.2, 0.02, leafMat.userData.soil || pot, 0, 0.4, 0, g, 16);
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const leafGeo = cached('leaf', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.09, 0.3, 0, 0.6);
    shape.quadraticCurveTo(-0.09, 0.3, 0, 0);
    return new THREE.ShapeGeometry(shape, 6);
  });
  for (let i = 0; i < 16; i++) {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(0, 0.42, 0);
    leaf.rotation.set(-0.25 - r() * 0.75, r() * Math.PI * 2, 0, 'YXZ');
    leaf.scale.setScalar(0.7 + r() * 0.7);
    leaf.castShadow = true;
    g.add(leaf);
  }
  parent.add(g);
  return g;
}

/** Palm in a planter for the rooftop. */
export function palm(parent, x, y, z, { trunkMat, leafMat, potMat, height = 3.2, seed = 2 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  box(1, 0.6, 1, potMat, 0, 0, 0, g);
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    cyl(0.11 - t * 0.03, 0.13 - t * 0.03, height / segs + 0.02, trunkMat, Math.sin(t * 1.4) * 0.25, 0.6 + (height / segs) * i, 0, g, 10);
  }
  const top = new THREE.Vector3(Math.sin(1.4) * 0.25, 0.6 + height, 0);
  const frond = cached('frond', () => {
    const geo = new THREE.PlaneGeometry(0.5, 1.9, 1, 8);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const yy = p.getY(i) + 0.95;
      p.setZ(i, -yy * yy * 0.16);
      p.setX(i, p.getX(i) * (1 - (yy / 1.9) * 0.8));
    }
    geo.translate(0, 0.95, 0);
    geo.computeVertexNormals();
    return geo;
  });
  for (let i = 0; i < 11; i++) {
    const f = new THREE.Mesh(frond, leafMat);
    f.position.copy(top);
    f.rotation.set(-1.0 - (i % 3) * 0.18, (i / 11) * Math.PI * 2 + seed, 0, 'YXZ');
    f.castShadow = true;
    g.add(f);
  }
  parent.add(g);
  return g;
}

/** Screen: a plane with a canvas texture that can be redrawn. */
export function screen(parent, w, h, x, y, z, rotY = 0, { px = 1024, bezel = null, frameMat = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.round((px * h) / w);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  if (frameMat) box(w + (bezel ?? 0.06), h + (bezel ?? 0.06), 0.05, frameMat, 0, -(h + (bezel ?? 0.06)) / 2, -0.03, g);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.z = 0.002;
  g.add(m);
  parent.add(g);
  return { group: g, mesh: m, canvas, ctx: canvas.getContext('2d'), tex, w: canvas.width, h: canvas.height };
}

export function chairOffice(parent, x, y, z, rotY, { seat, frame }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  // star base
  for (let i = 0; i < 5; i++) {
    const leg = box(0.05, 0.04, 0.36, frame, 0, 0.06, 0.18, null);
    const holder = new THREE.Group();
    holder.rotation.y = (i / 5) * Math.PI * 2;
    holder.add(leg);
    sphere(0.035, M_BLACK(), 0, 0.035, 0.34, holder, 8);
    g.add(holder);
  }
  cyl(0.03, 0.03, 0.36, frame, 0, 0.08, 0, g, 12);
  rbox(0.56, 0.12, 0.54, 0.05, seat, 0, 0.44, 0, g);
  const back = rbox(0.52, 0.62, 0.1, 0.05, seat, 0, 0.56, 0.26, g);
  back.rotation.x = 0.08;
  box(0.05, 0.22, 0.05, frame, 0.3, 0.5, 0.05, g);
  box(0.05, 0.22, 0.05, frame, -0.3, 0.5, 0.05, g);
  box(0.06, 0.04, 0.32, frame, 0.3, 0.72, 0.05, g);
  box(0.06, 0.04, 0.32, frame, -0.3, 0.72, 0.05, g);
  parent.add(g);
  return g;
}

let _black;
function M_BLACK() {
  return (_black ||= new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.5 }));
}

/** Tufted lounge armchair (penthouse guest chair). */
export function armchair(parent, x, y, z, rotY, { leather, legs }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  // swivel base
  for (let i = 0; i < 4; i++) {
    const h = new THREE.Group();
    h.rotation.y = (i / 4) * Math.PI * 2 + Math.PI / 4;
    box(0.04, 0.03, 0.4, legs, 0, 0.02, 0.2, h);
    g.add(h);
  }
  cyl(0.035, 0.035, 0.3, legs, 0, 0.03, 0, g, 12);
  rbox(0.86, 0.22, 0.8, 0.08, leather, 0, 0.3, 0, g);
  rbox(0.82, 0.14, 0.7, 0.07, leather, 0, 0.5, -0.02, g);
  const back = rbox(0.86, 0.66, 0.2, 0.08, leather, 0, 0.48, 0.32, g);
  back.rotation.x = -0.12;
  rbox(0.16, 0.36, 0.78, 0.07, leather, 0.43, 0.42, 0, g);
  rbox(0.16, 0.36, 0.78, 0.07, leather, -0.43, 0.42, 0, g);
  parent.add(g);
  return g;
}

export function shadowsOff(obj) {
  obj.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
}
