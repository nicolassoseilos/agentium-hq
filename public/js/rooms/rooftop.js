// Rooftop lounge — sunken infinity pool with the city view, sunbeds and
// cabanas on the left, a proper bar on the right with a backlit back bar,
// and a DJ who never stops (silently). Also exports every spot where people
// can be (sunbeds, stools, the pool edge, the water…) for the rooftop life.
import * as THREE from 'three';
import { M } from '../core/materials.js';
import { box, rbox, cyl, sphere, plane, floorPlane, palm, plant } from '../core/build.js';
import * as T from '../core/textures.js';
import { roomLights, fixtureMat } from './common.js';
import { LIFT, LANE_Z, POOL_CUT } from '../scene/layout.js';
import { makeBottle, BOTTLE_KINDS } from '../scene/drinks.js';

export function buildRooftop(parent, room, y0, makeCharacter) {
  const g = new THREE.Group();
  g.position.y = y0;
  parent.add(g);
  const W = (x, y, z) => new THREE.Vector3(x, y0 + y, z);

  // ---------------------------------------------------------- deck with the pool cut out
  const { x0: px0, x1: px1, z0: pz0, z1: pz1, depth } = POOL_CUT;
  const deckPiece = (xa, xb, za, zb, mat, y = 0.002, tile = 3) => floorPlane(xb - xa, zb - za, mat, (xa + xb) / 2, y, (za + zb) / 2, g, tile);
  deckPiece(-13, px0, -8, 8, M.terrace);
  deckPiece(px1, 13, -8, 8, M.terrace);
  deckPiece(px0, px1, pz1, 8, M.terrace);
  deckPiece(px0, px1, -8, pz0, M.terrace);
  // teak around the pool
  deckPiece(-5.0, px0, -7.8, 4.4, M.deck, 0.006);
  deckPiece(px1, 5.0, -7.8, 4.4, M.deck, 0.006);
  deckPiece(px0, px1, pz1, 4.4, M.deck, 0.006);

  // ---------------------------------------------------------- sunken infinity pool
  const pw = px1 - px0, pd = pz1 - pz0, pcz = (pz0 + pz1) / 2;
  const waterY = -0.06;
  const mosaicMat = new THREE.MeshStandardMaterial({ map: T.mosaic({ repeat: [6, 10] }), roughness: 0.3 });
  const wallMat = new THREE.MeshStandardMaterial({ map: T.mosaic({ repeat: [10, 2], base: '#1a86a0' }), roughness: 0.3, side: THREE.DoubleSide });
  const inner = 0.3; // coping width
  const ix0 = px0 + inner, ix1 = px1 - inner, iz0 = pz0 + 0.2, iz1 = pz1 - inner;
  const floorP = plane(ix1 - ix0, iz1 - iz0, mosaicMat, 0, -depth, (iz0 + iz1) / 2, g);
  floorP.rotation.x = -Math.PI / 2;
  for (const [x, z, w, ry] of [[ix0, (iz0 + iz1) / 2, iz1 - iz0, Math.PI / 2], [ix1, (iz0 + iz1) / 2, iz1 - iz0, -Math.PI / 2], [0, iz1, ix1 - ix0, Math.PI], [0, iz0, ix1 - ix0, 0]]) {
    const wall = plane(w, depth, wallMat, x, -depth / 2, z, g);
    wall.rotation.y = ry;
  }
  // basin shell seen from below (inside the top floor bulkhead)
  box(pw, 0.1, pd, M.charcoal, 0, -depth - 0.1, pcz, g, { cast: false });
  // granite coping flush with the deck
  box(inner, 0.05, pd, M.granite, px0 + inner / 2, -0.01, pcz, g);
  box(inner, 0.05, pd, M.granite, px1 - inner / 2, -0.01, pcz, g);
  box(pw, 0.05, inner, M.granite, 0, -0.01, pz1 - inner / 2, g);
  box(pw, 0.03, 0.2, M.granite, 0, -0.07, pz0 + 0.1, g); // infinity lip, just under the water line
  // steps into the water at the front
  for (let i = 0; i < 4; i++) box(2.2, 0.08, 0.38, M.granite, 0, -0.32 - i * 0.28, iz1 - 0.19 - i * 0.38, g, { cast: false });
  // chrome ladder rails at the steps
  for (const sx of [-1.2, 1.2]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 8, 16, Math.PI), M.chrome);
    rail.position.set(sx, 0.25, iz1 + 0.05);
    rail.rotation.y = Math.PI / 2;
    g.add(rail);
  }

  const waterNormal = T.waterNormal();
  waterNormal.repeat.set(2, 4);
  const water = new THREE.MeshStandardMaterial({
    color: '#55c3d6', roughness: 0.04, metalness: 0.05, transparent: true, opacity: 0.5,
    normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35),
    emissive: '#0fb3d6', emissiveIntensity: 0.05, depthWrite: false,
  });
  const surf = plane(ix1 - ix0, pz1 - inner - pz0, water, 0, waterY, (pz0 + pz1 - inner) / 2, g, { receive: true });
  surf.rotation.x = -Math.PI / 2;
  surf.renderOrder = 4;
  // overflow sheet over the infinity edge
  const sheet = plane(ix1 - ix0, 0.5, water, 0, waterY - 0.25, pz0 - 0.01, g);
  sheet.rotation.y = Math.PI;
  const poolLed = fixtureMat(M.neonCyan, 2.4);
  for (const x of [ix0 + 0.02, ix1 - 0.02]) box(0.02, 0.03, iz1 - iz0, poolLed, x, -0.2, (iz0 + iz1) / 2, g, { cast: false });
  box(ix1 - ix0, 0.03, 0.02, poolLed, 0, -0.2, iz1 - 0.02, g, { cast: false });
  // floating orbs (night)
  const orbs = [];
  const orbMats = ['#9ff4ff', '#ffffff', '#7fe0ff'].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.5 }));
  for (const [x, z, r, m] of [[1.9, -6.2, 0.2, 0], [2.4, -5.4, 0.15, 1], [-2.1, -6.6, 0.17, 2], [-2.2, 0.8, 0.18, 0], [-1.8, 1.4, 0.14, 1]]) {
    const o = sphere(r, orbMats[m], x, waterY, z, g, 20, { cast: false });
    o.userData.base = o.position.clone();
    orbs.push(o);
  }

  // ---------------------------------------------------------- glass balustrade
  const rail = (x, z, len, axis) => {
    const pane = plane(len, 1.05, M.glassTint, x, 0.6, z, g);
    if (axis === 'z') pane.rotation.y = Math.PI / 2;
    pane.renderOrder = 3;
    box(axis === 'x' ? len : 0.06, 0.05, axis === 'x' ? 0.06 : len, M.brass, x, 1.12, z, g);
    box(axis === 'x' ? len : 0.1, 0.08, axis === 'x' ? 0.1 : len, M.blackMetal, x, 0.02, z, g);
  };
  rail(0, -7.95, 25.8, 'x');
  rail(-12.95, 0, 15.8, 'z');
  rail(12.95, (-7.9 + LIFT.z - LIFT.w / 2 - 0.3) / 2, LIFT.z - LIFT.w / 2 - 0.3 + 7.9, 'z');
  rail(12.95, (7.9 + LIFT.z + LIFT.w / 2 + 0.3) / 2, 7.9 - (LIFT.z + LIFT.w / 2 + 0.3), 'z');
  rail(-6.5, 7.95, 12.8, 'x');
  rail(8.0, 7.95, 9.8, 'x');

  // ---------------------------------------------------------- spots (where people can be)
  const spots = [];
  const spot = (o) => {
    const s = { room: 'rooftop', floor: 3, occupant: null, ...o };
    s.pos = W(o.x, o.y ?? 0, o.z);
    s.via = o.via?.map((v) => ({ x: v.x, z: v.z, y: v.y !== undefined ? y0 + v.y : undefined }));
    s.release = (p) => { if (s.occupant === p) s.occupant = null; };
    spots.push(s);
    return s;
  };

  // sunbeds + umbrellas (left)
  const umbrellas = [];
  const beds = [[-9.6, -4.4], [-9.6, -1.5], [-9.6, 1.4], [-6.1, -4.4], [-6.1, -1.5], [-6.1, 1.4]];
  beds.forEach(([x, z], i) => {
    sunbed(g, x, z, i);
    const aisle = x < -8 ? -11.4 : -7.85;
    spot({ id: `sunbed-${i}`, type: 'sunbed', x: x - 0.15, z, face: Math.PI / 2, pose: 'lie', via: [{ x: aisle, z: LANE_Z }, { x: aisle, z }], ceo: { eye: [0.15, 0.95, 0], look: [3, 0.7, 0] } });
  });
  for (const [x, z] of [[-9.6, -2.95], [-6.1, -2.95], [-9.6, -0.05], [-6.1, -0.05]]) umbrellas.push(umbrella(g, x, z));

  // cabanas (back left)
  const cabanaLamps = [];
  for (const [x, z, k] of [[-10.6, -6.6, 0], [-6.8, -6.6, 1]]) {
    cabanaLamps.push(cabana(g, x, z));
    for (const dx of [-0.6, 0.6]) spot({ id: `cabana-${k}-${dx > 0 ? 'r' : 'l'}`, type: 'cabana', x: x + dx, z: z + 0.25, face: 0, pose: 'sit', seat: 0.42, via: [{ x: -7.85, z: LANE_Z }, { x: -7.85, z: -5.3 }, { x: x + dx, z: -5.3 }] });
  }

  // pool edge (sit with legs in the water)
  for (const z of [-5.6, -3.4, -1.2, 1.2]) {
    spot({ id: `edge-l-${z}`, type: 'edge', x: px0 + 0.18, z, face: Math.PI / 2, pose: 'sit-edge', via: [{ x: -4.25, z: LANE_Z }, { x: -4.25, z }] });
    spot({ id: `edge-r-${z}`, type: 'edge', x: px1 - 0.18, z, face: -Math.PI / 2, pose: 'sit-edge', via: [{ x: 4.25, z: LANE_Z }, { x: 4.25, z }] });
  }
  // swimming (up to 4 in the water)
  for (let i = 0; i < 4; i++) {
    spot({ id: `swim-${i}`, type: 'swim', x: 0, y: -depth + 0.04, z: iz1 - 1.5, face: Math.PI, pose: 'wade', via: [{ x: 0, z: LANE_Z }, { x: 0, z: pz1 + 0.35 }, { x: 0, z: iz1 - 0.5, y: -0.55 }] });
  }

  // standing spots by the glass, drink in hand
  const look = (x, z) => Math.atan2(0 - x, -2 - z);
  for (const [x, z] of [[-6.3, 6.3], [-2.2, 6.45], [2.4, 6.45], [8.8, 6.3], [10.9, 6.1], [5.9, -5.6], [-4.2, -7.1]]) {
    spot({ id: `stand-${x}`, type: 'stand', x, z, face: z < 0 ? look(x, z) + Math.PI : look(x, z), pose: 'stand', via: z < 0 ? [{ x: x > 0 ? 4.25 : -4.25, z: LANE_Z }, { x: x > 0 ? 4.25 : -4.25, z }] : null });
  }

  // lounge sofa (front right)
  rbox(2.4, 0.42, 0.9, 0.08, M.fabricCream, 6.2, 0, 5.6, g);
  rbox(2.4, 0.5, 0.25, 0.08, M.fabricCream, 6.2, 0.3, 6.0, g);
  rbox(0.8, 0.36, 0.8, 0.06, M.fabricNavy, 6.2, 0, 3.75, g);
  for (const x of [5.6, 6.8]) spot({ id: `sofa-${x}`, type: 'sofa', x, z: 5.45, face: Math.PI, pose: 'sit', seat: 0.42 });

  // ---------------------------------------------------------- Agentium pylon
  const pylon = new THREE.Group();
  pylon.position.set(-12.2, 0, 4.6);
  box(1.2, 5.6, 0.9, M.white, 0, 0, 0, pylon);
  box(1.24, 0.08, 0.94, M.brass, 0, 5.6, 0, pylon);
  const ptex = verticalSign();
  const pmat = new THREE.MeshStandardMaterial({ map: ptex, transparent: true, emissive: '#ffffff', emissiveMap: ptex, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.35 });
  plane(0.55, 4.2, pmat, 0, 3.1, 0.452, pylon).receiveShadow = false;
  const pf2 = plane(0.55, 4.2, pmat, 0.602, 3.1, 0, pylon);
  pf2.rotation.y = Math.PI / 2;
  g.add(pylon);

  // ---------------------------------------------------------- bar (right)
  const barX = 8.4, bz0 = -4.6, bz1 = 2.0, bcz = (bz0 + bz1) / 2, bl = bz1 - bz0;
  box(0.75, 1.05, bl, M.walnutPanel, barX, 0, bcz, g);
  box(0.95, 0.06, bl + 0.2, M.marbleDark, barX - 0.05, 1.05, bcz, g);
  box(0.03, 0.03, bl + 0.2, M.brass, barX - 0.52, 1.07, bcz, g);
  const barLed = fixtureMat(M.ledWarm, 2);
  box(0.02, 0.03, bl, barLed, barX - 0.39, 0.08, bcz, g, { cast: false });
  const stools = [];
  const STOOLS = 7;
  for (let i = 0; i < STOOLS; i++) {
    const z = bz0 + 0.55 + i * ((bl - 1.1) / (STOOLS - 1));
    barStool(g, barX - 0.85, z);
    const s = spot({ id: `stool-${i}`, type: 'stool', reserved: true, x: barX - 0.85, z, face: Math.PI / 2, pose: 'sit-high', via: [{ x: 6.75, z: LANE_Z }, { x: 6.75, z }], stool: i });
    s.counter = W(barX - 0.22, 1.11, z); // where a drink is placed for this stool
    s.serve = W(barX + 0.55, 0, z); // where the barman stands to serve it
    s.serveFace = -Math.PI / 2;
    s.glassStart = s.counter.clone().add(new THREE.Vector3(0.42, 0, 0.12));
    stools.push(s);
  }
  // the stools are kept for the CEO and whoever he invites; everyone else
  // orders standing at the end of the bar
  const barStands = [];
  for (const x of [8.12, 8.68]) {
    const s = spot({ id: `barstand-${x}`, type: 'barstand', x, z: bz1 + 0.6, face: Math.PI, pose: 'stand' });
    s.counter = W(x, 1.11, bz1 - 0.05);
    s.serve = W(9.15, 0, bz1 - 0.45);
    s.serveFace = -Math.PI / 4;
    s.glassStart = W(8.62, 1.11, bz1 - 0.4);
    barStands.push(s);
  }
  // canopy
  for (const [x, z] of [[9.6, -5.2], [12.6, -5.2], [9.6, 2.6], [12.6, 2.6]]) box(0.14, 3.0, 0.14, M.blackMetal, x, 0, z, g);
  box(3.6, 0.22, 8.4, M.charcoal, 11.1, 3.0, -1.3, g);
  const down = fixtureMat(M.warmLight, 2);
  for (let i = 0; i < 4; i++) cyl(0.08, 0.08, 0.02, down, 10.3, 2.98, -4 + i * 2, g, 12);

  // back bar: backlit niches with every kind of bottle (reference photo)
  const bb = { x: 12.45, z0: -4.9, z1: 2.3 };
  const cols = 6, rows = 3;
  const nicheW = (bb.z1 - bb.z0) / cols;
  box(0.55, 0.95, bb.z1 - bb.z0, M.ebony, bb.x, 0, (bb.z0 + bb.z1) / 2, g);
  box(0.6, 0.05, bb.z1 - bb.z0 + 0.04, M.marbleDark, bb.x - 0.02, 0.95, (bb.z0 + bb.z1) / 2, g);
  box(0.06, 2.0, bb.z1 - bb.z0, M.black, bb.x + 0.24, 1.0, (bb.z0 + bb.z1) / 2, g);
  const nicheGlow = fixtureMat(new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff4e2', emissiveIntensity: 1.6 }), 1.6);
  const backGlow = fixtureMat(new THREE.MeshStandardMaterial({ color: '#2a2622', emissive: '#c8bca8', emissiveIntensity: 0.35 }), 0.35);
  const bottleSlots = [];
  const kindsByRow = [['whisky', 'whisky2', 'champagne', 'vodka', 'gin', 'cognac'], ['whisky2', 'cognac', 'champagne', 'wine', 'rose', 'whisky'], ['vodka', 'gin', 'wine', 'rose', 'cognac', 'champagne']];
  for (let c = 0; c < cols; c++) {
    const zc = bb.z0 + nicheW * (c + 0.5);
    // vertical light frames between niches
    box(0.04, 2.0, 0.04, nicheGlow, bb.x - 0.2, 1.0, bb.z0 + nicheW * c, g, { cast: false });
    for (let r = 0; r < rows; r++) {
      const yb = 1.08 + r * 0.62;
      box(0.4, 0.02, nicheW - 0.06, M.glassTint, bb.x - 0.02, yb - 0.02, zc, g, { cast: false });
      box(0.01, 0.58, nicheW - 0.06, backGlow, bb.x + 0.2, yb, zc, g, { cast: false });
      const kind = kindsByRow[r][c];
      for (let k = 0; k < 4; k++) {
        const bk = k === 3 ? BOTTLE_KINDS[(c * 3 + r + k) % BOTTLE_KINDS.length] : kind;
        const b = makeBottle(bk);
        const z = zc - nicheW / 2 + 0.17 + k * ((nicheW - 0.34) / 3);
        b.position.set(bb.x - 0.04, y0 + yb, z);
        parent.add(b);
        bottleSlots.push({ kind: bk.replace('2', ''), bottle: b, home: b.position.clone(), taken: false, reach: r / 2, z, y: yb });
      }
    }
  }
  box(0.04, 2.0, 0.04, nicheGlow, bb.x - 0.2, 1.0, bb.z1, g, { cast: false });
  box(0.42, 0.04, bb.z1 - bb.z0, nicheGlow, bb.x - 0.02, 2.96, (bb.z0 + bb.z1) / 2, g, { cast: false });
  // glass racks on the back counter
  for (let i = 0; i < 8; i++) cyl(0.035, 0.032, 0.09, M.decanterGlass, bb.x - 0.12, 1.0, bb.z0 + 0.4 + i * 0.12, g, 12, { cast: false });

  // ---------------------------------------------------------- DJ booth (back right)
  const dj = new THREE.Group();
  dj.position.set(9.6, 0, -6.6);
  rbox(2.6, 1.05, 0.8, 0.04, M.glossBlack, 0, 0, 0, dj);
  const djTex = T.textTexture('AGENTIUM', { w: 1024, h: 200, color: '#e8d2a6', font: '500 120px "Cormorant Garamond", serif', spacing: 0.35 });
  plane(2.2, 0.42, new THREE.MeshBasicMaterial({ map: djTex, transparent: true, toneMapped: false }), 0, 0.55, 0.405, dj).receiveShadow = false;
  const eqCanvas = document.createElement('canvas');
  eqCanvas.width = 512;
  eqCanvas.height = 64;
  const eqTex = new THREE.CanvasTexture(eqCanvas);
  eqTex.colorSpace = THREE.SRGBColorSpace;
  plane(2.4, 0.16, new THREE.MeshBasicMaterial({ map: eqTex, transparent: true, toneMapped: false, blending: THREE.AdditiveBlending }), 0, 0.2, 0.405, dj).receiveShadow = false;
  box(2.5, 0.04, 0.7, M.blackMetal, 0, 1.05, 0, dj);
  const platters = [];
  for (const sx of [-0.75, 0.75]) {
    box(0.6, 0.08, 0.5, M.charcoal, sx, 1.09, 0, dj);
    const p = cyl(0.21, 0.21, 0.02, M.black, sx, 1.17, 0, dj, 32);
    box(0.2, 0.004, 0.02, M.chrome, 0, 0.012, 0, p, { cast: false });
    platters.push(p);
  }
  box(0.4, 0.08, 0.45, M.charcoal, 0, 1.09, 0, dj);
  const knobMat = new THREE.MeshStandardMaterial({ color: '#f2c', emissive: '#ff3ec8', emissiveIntensity: 1.6 });
  for (let i = 0; i < 6; i++) sphere(0.018, knobMat, -0.12 + (i % 3) * 0.12, 1.18, -0.1 + Math.floor(i / 3) * 0.15, dj, 8, { cast: false });
  for (const sx of [-1.7, 1.7]) {
    rbox(0.55, 1.4, 0.5, 0.04, M.black, sx, 0, 0.05, dj);
    cyl(0.17, 0.17, 0.03, M.charcoal, sx, 0.85, 0.3, dj, 24).rotation.x = Math.PI / 2;
    cyl(0.1, 0.1, 0.03, M.charcoal, sx, 0.35, 0.3, dj, 20).rotation.x = Math.PI / 2;
  }
  g.add(dj);
  const djChar = makeCharacter('dj');
  djChar.root.position.set(9.6, y0, -7.4);
  parent.add(djChar.root);

  // ---------------------------------------------------------- greenery & lanterns
  palm(g, -11.6, 0, 6.6, { trunkMat: M.trunk, leafMat: M.leaf, potMat: M.white, height: 3.4, seed: 1 });
  palm(g, 5.0, 0, -7.1, { trunkMat: M.trunk, leafMat: M.leaf, potMat: M.white, height: 3.0, seed: 2 });
  palm(g, -12.2, 0, 2.9, { trunkMat: M.trunk, leafMat: M.leaf, potMat: M.white, height: 3.6, seed: 3 });
  palm(g, 12.1, 0, 3.0, { trunkMat: M.trunk, leafMat: M.leaf, potMat: M.white, height: 2.8, seed: 4 });
  for (const x of [-8, -4.5]) {
    box(1.2, 0.5, 0.8, M.white, x, 0, 7.3, g);
    plant(g, x, 0.3, 7.3, { scale: 1.2, pot: M.white, leafMat: M.leafDark, seed: (x * 3) | 0 });
  }
  const lanternMat = fixtureMat(M.warmLight, 2.4);
  for (const [x, z] of [[-3.75, 4.05], [3.75, 4.05], [5.2, 6.4], [-5.2, 6.4], [-12.2, 1.0], [12.2, -6.0]]) lantern(g, x, z, lanternMat);

  const poolLight = new THREE.PointLight('#33dfff', 0, 16, 1.6);
  poolLight.position.set(0, -0.3, -2);
  g.add(poolLight);
  const lights = roomLights(g, [[10.4, 2.7, -1.2], [-7.5, 3, -1.5, 0.8]], { color: '#ffcf95', power: 16, distance: 14, fixtures: [down, barLed, nicheGlow, backGlow, lanternMat] });

  // stations used by the old fixed routine are replaced by random spots
  const stations = { visit: { pos: W(4.6, 0, 1.0), face: 0, pose: 'stand' } };

  function update(dt, t, state, daylight, active) {
    const night = 1 - daylight;
    lights.set(Math.max(active, 0.65), daylight, dt);
    waterNormal.offset.set((t * 0.012) % 1, (t * 0.02) % 1);
    water.emissiveIntensity = 0.05 + night * 0.45;
    poolLight.intensity = night * 10;
    poolLed.emissiveIntensity = 0.4 + night * 2.6;
    orbs.forEach((o, i) => {
      o.visible = night > 0.3;
      o.position.y = o.userData.base.y + Math.sin(t * 1.3 + i) * 0.025;
      o.position.x = o.userData.base.x + Math.sin(t * 0.2 + i * 2) * 0.15;
    });
    umbrellas.forEach((u) => u.set(daylight > 0.35));
    platters.forEach((p, i) => (p.rotation.y += dt * (3.5 + i * 0.3)));
    const eg = eqCanvas.getContext('2d');
    eg.clearRect(0, 0, 512, 64);
    for (let i = 0; i < 32; i++) {
      const v = (Math.sin(t * 6 + i * 0.7) * 0.5 + 0.5) * (Math.sin(t * 2.3 + i * 0.3) * 0.4 + 0.6);
      const hh = 6 + v * 54;
      eg.fillStyle = `hsl(${280 + i * 3},90%,${55 + v * 15}%)`;
      eg.fillRect(i * 16 + 2, 64 - hh, 12, hh);
    }
    eqTex.needsUpdate = true;
    knobMat.emissive.setHSL((0.85 + Math.sin(t * 0.7) * 0.1) % 1, 0.9, 0.55);
    djChar.animateDJ(t);
    pmat.emissiveIntensity = 0.2 + night * 1.0;
    void cabanaLamps;
  }

  return { group: g, stations, update, spots, stools, barStands, bottleSlots, dj: djChar, bar: { x: barX, backX: bb.x, y0 }, waterY: y0 + waterY };
}

function sunbed(parent, x, z, i) {
  const s = new THREE.Group();
  s.position.set(x, 0, z);
  box(2.0, 0.08, 0.78, M.walnut, 0, 0.26, 0, s);
  for (const [lx, lz] of [[-0.9, -0.34], [-0.9, 0.34], [0.9, -0.34], [0.9, 0.34]]) box(0.06, 0.26, 0.06, M.walnut, lx, 0, lz, s);
  rbox(1.3, 0.1, 0.72, 0.04, M.fabricCream, 0.32, 0.34, 0, s);
  const back = rbox(0.75, 0.1, 0.72, 0.04, M.fabricCream, 0, 0, 0, s);
  back.position.set(-0.62, 0.62, 0);
  back.rotation.z = -0.95;
  const pillow = rbox(0.18, 0.2, 0.45, 0.07, i % 2 ? M.fabricNavy : new THREE.MeshStandardMaterial({ color: '#8a2f2a', roughness: 0.9 }), -0.82, 0.78, 0, s);
  pillow.rotation.z = -0.95;
  if (i % 3 === 1) box(0.7, 0.03, 0.74, M.towel, 0.62, 0.39, 0, s, { cast: false }).rotation.y = 0.05;
  cyl(0.2, 0.2, 0.03, M.marble, 0, 0.42, 0.68, s, 20);
  cyl(0.03, 0.03, 0.42, M.brass, 0, 0, 0.68, s, 8);
  parent.add(s);
  return s;
}

function umbrella(parent, x, z) {
  const u = new THREE.Group();
  u.position.set(x, 0, z);
  cyl(0.25, 0.3, 0.12, M.charcoal, 0, 0, 0, u, 16);
  cyl(0.03, 0.03, 2.6, M.walnut, 0, 0.1, 0, u, 8);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.45, 8, 1, true), M.fabricCream.clone());
  canopy.material.side = THREE.DoubleSide;
  canopy.position.y = 2.55;
  canopy.castShadow = true;
  u.add(canopy);
  const closed = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.3, 8), M.fabricCream);
  closed.position.y = 2.05;
  closed.rotation.x = Math.PI;
  u.add(closed);
  parent.add(u);
  return { set(open) { canopy.visible = open; closed.visible = !open; } };
}

function cabana(parent, x, z) {
  const c = new THREE.Group();
  c.position.set(x, 0, z);
  const w = 3.0, d = 1.9, h = 2.6;
  for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) box(0.1, h, 0.1, M.blackMetal, px, 0, pz, c);
  box(w + 0.1, 0.12, d + 0.1, M.blackMetal, 0, h, 0, c);
  box(w - 0.2, 0.06, d - 0.2, M.charcoal, 0, h - 0.04, 0, c, { cast: false });
  rbox(w - 0.3, 0.42, d - 0.3, 0.06, M.fabricNavy, 0, 0, 0, c);
  rbox(w - 0.3, 0.6, 0.2, 0.06, M.fabricNavy, 0, 0.42, -d / 2 + 0.25, c);
  for (const px of [-0.8, 0, 0.8]) rbox(0.5, 0.36, 0.14, 0.06, M.fabricCream, px, 0.44, -d / 2 + 0.42, c);
  const curtainGeo = new THREE.CylinderGeometry(0.12, 0.28, h - 0.15, 10, 1, true);
  for (const [px, pz] of [[-w / 2 + 0.15, d / 2], [w / 2 - 0.15, d / 2], [-w / 2 + 0.15, -d / 2], [w / 2 - 0.15, -d / 2]]) {
    const m = new THREE.Mesh(curtainGeo, M.curtain);
    m.position.set(px, (h - 0.15) / 2, pz);
    m.castShadow = true;
    c.add(m);
  }
  const lamp = sphere(0.09, M.warmLight, w / 2 - 0.4, 0.55, d / 2 - 0.3, c, 12, { cast: false });
  parent.add(c);
  return lamp;
}

function barStool(parent, x, z) {
  const s = new THREE.Group();
  s.position.set(x, 0, z);
  cyl(0.2, 0.22, 0.03, M.blackMetal, 0, 0, 0, s, 16);
  cyl(0.03, 0.03, 0.72, M.blackMetal, 0, 0.03, 0, s, 8);
  cyl(0.2, 0.18, 0.08, M.leatherCognac, 0, 0.74, 0, s, 20);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20), M.brass);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  s.add(ring);
  parent.add(s);
}

function lantern(parent, x, z, glowMat) {
  const l = new THREE.Group();
  l.position.set(x, 0, z);
  box(0.28, 0.04, 0.28, M.blackMetal, 0, 0, 0, l);
  box(0.28, 0.04, 0.28, M.blackMetal, 0, 0.5, 0, l);
  for (const [px, pz] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) box(0.025, 0.5, 0.025, M.blackMetal, px, 0, pz, l);
  cyl(0.05, 0.05, 0.16, glowMat, 0, 0.06, 0, l, 10, { cast: false });
  const ringTop = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 6, 16), M.blackMetal);
  ringTop.position.y = 0.6;
  l.add(ringTop);
  parent.add(l);
}

function verticalSign() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#c9a15e';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '500 92px "Cormorant Garamond", serif';
  [...'AGENTIUM'].forEach((ch, i) => g.fillText(ch, 64, 70 + i * 120));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
