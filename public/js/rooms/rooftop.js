// Rooftop lounge — infinity pool with the city view, sunbeds on the left,
// a proper bar on the right, cabanas, and a DJ who never stops (silently).
import * as THREE from 'three';
import { M } from '../core/materials.js';
import { box, rbox, cyl, sphere, plane, floorPlane, palm, plant } from '../core/build.js';
import * as T from '../core/textures.js';
import { roomLights, fixtureMat } from './common.js';
import { LIFT } from '../scene/layout.js';

export function buildRooftop(parent, room, y0, makeCharacter) {
  const g = new THREE.Group();
  g.position.y = y0;
  parent.add(g);

  floorPlane(26, 16, M.terrace, 0, 0.002, 0, g, 3);
  // wooden deck strips around the pool
  floorPlane(10.5, 13.6, M.deck, 0, 0.006, -1.4, g, 3);

  // ---------------------------------------------------------- pool
  const px0 = -3.3, px1 = 3.3, pz0 = -7.7, pz1 = 3.6, ph = 0.55;
  const pw = px1 - px0, pd = pz1 - pz0, pcx = 0, pcz = (pz0 + pz1) / 2;
  const coping = M.granite;
  box(0.28, ph, pd, coping, px0 + 0.14, 0, pcz, g);
  box(0.28, ph, pd, coping, px1 - 0.14, 0, pcz, g);
  box(pw, ph, 0.28, coping, pcx, 0, pz1 - 0.14, g);
  // infinity edge at the back: low lip + glass
  box(pw, ph - 0.08, 0.2, coping, pcx, 0, pz0 + 0.1, g);
  const mosaicMat = new THREE.MeshStandardMaterial({ map: T.mosaic({ repeat: [6, 10] }), roughness: 0.3 });
  const floor = plane(pw - 0.56, pd - 0.48, mosaicMat, pcx, 0.02, pcz + 0.04, g);
  floor.rotation.x = -Math.PI / 2;
  for (const s of [-1, 1]) {
    const side = plane(pd - 0.48, ph - 0.05, mosaicMat, pcx + s * (pw / 2 - 0.285), ph / 2, pcz + 0.04, g);
    side.rotation.y = -s * Math.PI / 2;
  }
  // steps at the front
  for (let i = 0; i < 3; i++) box(2.2, 0.15 * (3 - i), 0.35, coping, pcx, 0.02, pz1 - 0.45 - i * 0.35, g);

  const waterNormal = T.waterNormal();
  waterNormal.repeat.set(2, 4);
  const water = new THREE.MeshStandardMaterial({
    color: '#3ab7cf', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.82,
    normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35),
    emissive: '#0fb3d6', emissiveIntensity: 0.05,
  });
  const surf = plane(pw - 0.5, pd - 0.3, water, pcx, ph - 0.07, pcz - 0.06, g, { receive: true });
  surf.rotation.x = -Math.PI / 2;
  surf.renderOrder = 1;
  // overflow sheet over the infinity edge
  const sheet = plane(pw - 0.5, 0.4, water, pcx, ph - 0.3, pz0 - 0.01, g);
  sheet.rotation.y = Math.PI;
  // LED edge
  const poolLed = fixtureMat(M.neonCyan, 2.4);
  for (const s of [-1, 1]) box(0.03, 0.02, pd - 0.6, poolLed, pcx + s * (pw / 2 - 0.3), ph - 0.12, pcz, g, { cast: false });
  box(pw - 0.6, 0.02, 0.03, poolLed, pcx, ph - 0.12, pz1 - 0.3, g, { cast: false });
  // floating orbs (night)
  const orbs = [];
  const orbMats = ['#9ff4ff', '#ffffff', '#7fe0ff'].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.5 }));
  for (const [x, z, r, m] of [[1.6, -5.6, 0.22, 0], [2.2, -4.9, 0.16, 1], [-1.4, -6.5, 0.18, 2], [0.8, 1.2, 0.2, 0], [1.6, 1.8, 0.15, 1]]) {
    const o = sphere(r, orbMats[m], x, ph - 0.07, z, g, 20, { cast: false });
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

  // lift head-house (glass box on the roof is part of the shaft)

  // ---------------------------------------------------------- sunbeds + umbrellas (left)
  const umbrellas = [];
  const sunbeds = [];
  const beds = [[-9.6, -4.4], [-9.6, -1.5], [-9.6, 1.4], [-6.1, -4.4], [-6.1, -1.5], [-6.1, 1.4]];
  beds.forEach(([x, z], i) => {
    sunbeds.push(sunbed(g, x, z, i));
    if (i < 3) umbrellas.push(umbrella(g, x + 1.75, z));
  });

  // ---------------------------------------------------------- cabanas (back left)
  const cabanaLamps = [];
  for (const [x, z] of [[-10.6, -6.6], [-6.8, -6.6]]) cabanaLamps.push(cabana(g, x, z));

  // ---------------------------------------------------------- Agentium pylon
  const pylon = new THREE.Group();
  pylon.position.set(-12.2, 0, 4.6);
  box(1.2, 5.6, 0.9, M.white, 0, 0, 0, pylon);
  box(1.24, 0.08, 0.94, M.brass, 0, 5.6, 0, pylon);
  const ptex = verticalSign();
  const pmat = new THREE.MeshStandardMaterial({ map: ptex, transparent: true, emissive: '#ffffff', emissiveMap: ptex, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.35 });
  const pf = plane(0.55, 4.2, pmat, 0, 3.1, 0.452, pylon);
  pf.receiveShadow = false;
  const pf2 = plane(0.55, 4.2, pmat, 0.602, 3.1, 0, pylon);
  pf2.rotation.y = Math.PI / 2;
  g.add(pylon);

  // ---------------------------------------------------------- bar (right)
  const barX = 8.4, bz0 = -4.6, bz1 = 2.0, bcz = (bz0 + bz1) / 2, bl = bz1 - bz0;
  box(0.75, 1.05, bl, M.walnutPanel, barX, 0, bcz, g);
  box(0.95, 0.06, bl + 0.2, M.granite, barX - 0.05, 1.05, bcz, g);
  const barLed = fixtureMat(M.ledWarm, 2);
  box(0.02, 0.03, bl, barLed, barX - 0.39, 0.08, bcz, g, { cast: false });
  for (let i = 0; i < 5; i++) barStool(g, barX - 0.85, bz0 + 0.7 + i * (bl - 1.4) / 4);
  // canopy
  for (const [x, z] of [[9.6, -5.2], [12.6, -5.2], [9.6, 2.6], [12.6, 2.6]]) box(0.14, 3.0, 0.14, M.blackMetal, x, 0, z, g);
  box(3.6, 0.22, 8.4, M.charcoal, 11.1, 3.0, -1.3, g);
  const down = fixtureMat(M.warmLight, 2);
  for (let i = 0; i < 4; i++) cyl(0.08, 0.08, 0.02, down, 10.3, 2.98, -4 + i * 2, g, 12);
  // back bar with backlit bottles
  box(0.5, 2.4, bl + 1, M.walnut, 12.45, 0, bcz, g);
  const glowPanel = fixtureMat(M.bottleGlow, 1.4);
  box(0.02, 1.7, bl + 0.6, glowPanel, 12.18, 0.75, bcz, g, { cast: false });
  const bottleCols = ['#3c6b3a', '#7b3a1a', '#c9a15e', '#2d3e58', '#d8d1c0', '#5a2030'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, transparent: true, opacity: 0.85 }));
  for (let r = 0; r < 3; r++) {
    box(0.4, 0.03, bl + 0.6, M.brass, 12.15, 0.8 + r * 0.55, bcz, g, { cast: false });
    for (let k = 0; k < 18; k++) {
      const z = bz0 - 0.2 + k * ((bl + 0.4) / 17);
      const hgt = 0.26 + ((k * 7 + r * 3) % 5) * 0.03;
      cyl(0.04, 0.045, hgt, bottleCols[(k + r) % 6], 12.05, 0.83 + r * 0.55, z, g, 10, { cast: false });
    }
  }
  box(0.5, 1.05, bl, M.walnut, 11.1, 0, bcz, g); // back counter
  box(0.55, 0.04, bl, M.granite, 11.1, 1.05, bcz, g);

  // ---------------------------------------------------------- DJ booth (back right)
  const dj = new THREE.Group();
  dj.position.set(9.6, 0, -6.6);
  rbox(2.6, 1.05, 0.8, 0.04, M.glossBlack, 0, 0, 0, dj);
  const djTex = T.textTexture('AGENTIUM', { w: 1024, h: 200, color: '#e8d2a6', font: '500 120px "Cormorant Garamond", serif', spacing: 0.35 });
  const djFace = plane(2.2, 0.42, new THREE.MeshBasicMaterial({ map: djTex, transparent: true, toneMapped: false }), 0, 0.55, 0.405, dj);
  djFace.receiveShadow = false;
  const eqCanvas = document.createElement('canvas');
  eqCanvas.width = 512;
  eqCanvas.height = 64;
  const eqTex = new THREE.CanvasTexture(eqCanvas);
  eqTex.colorSpace = THREE.SRGBColorSpace;
  const eq = plane(2.4, 0.16, new THREE.MeshBasicMaterial({ map: eqTex, transparent: true, toneMapped: false, blending: THREE.AdditiveBlending }), 0, 0.2, 0.405, dj);
  eq.receiveShadow = false;
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
  // speakers
  for (const sx of [-1.7, 1.7]) {
    rbox(0.55, 1.4, 0.5, 0.04, M.black, sx, 0, 0.05, dj);
    cyl(0.17, 0.17, 0.03, M.charcoal, sx, 0.85, 0.3, dj, 24).rotation.x = Math.PI / 2;
    cyl(0.1, 0.1, 0.03, M.charcoal, sx, 0.35, 0.3, dj, 20).rotation.x = Math.PI / 2;
  }
  g.add(dj);

  const djChar = makeCharacter('dj');
  djChar.root.position.set(9.6, y0, -7.4);
  djChar.root.rotation.y = 0;
  parent.add(djChar.root);

  // ---------------------------------------------------------- greenery & lanterns
  palm(g, -11.6, 0, 6.6, { trunkMat: M.trunk, leafMat: M.leaf, potMat: M.white, height: 3.4, seed: 1 });
  palm(g, 5.0, 0, -7.1, { trunkMat: M.trunk, leafMat: M.leaf, potMat: M.white, height: 3.0, seed: 2 });
  palm(g, -4.8, 0, -7.1, { trunkMat: M.trunk, leafMat: M.leaf, potMat: M.white, height: 3.6, seed: 3 });
  palm(g, 12.1, 0, 3.0, { trunkMat: M.trunk, leafMat: M.leaf, potMat: M.white, height: 2.8, seed: 4 });
  for (const x of [-11.6, -8, -4.5]) {
    box(1.2, 0.5, 0.8, M.white, x, 0, 7.3, g);
    plant(g, x, 0.3, 7.3, { scale: 1.2, pot: M.white, leafMat: M.leafDark, seed: (x * 3) | 0 });
  }
  const lanternMat = fixtureMat(M.warmLight, 2.4);
  const lanternPos = [[-3.9, 3.9], [3.9, 3.9], [-3.9, -2], [3.9, -2], [5.2, 5.6], [-5.2, 5.6]];
  for (const [x, z] of lanternPos) lantern(g, x, z, lanternMat);

  // lounge sofa facing the pool (front right)
  rbox(2.4, 0.42, 0.9, 0.08, M.fabricCream, 6.2, 0, 5.6, g);
  rbox(2.4, 0.5, 0.25, 0.08, M.fabricCream, 6.2, 0.3, 6.0, g);
  rbox(0.8, 0.36, 0.8, 0.06, M.fabricNavy, 6.2, 0, 4.4, g);

  const poolLight = new THREE.PointLight('#33dfff', 0, 16, 1.6);
  poolLight.position.set(0, 0.9, -2);
  g.add(poolLight);
  const lights = roomLights(g, [[10.4, 2.7, -1.2], [-7.5, 3, -1.5, 0.8]], { color: '#ffcf95', power: 16, distance: 14, fixtures: [down, barLed, glowPanel, lanternMat] });

  const stations = {
    scott: { pos: new THREE.Vector3(-6.1 - 0.15, y0, -1.5), face: Math.PI / 2, pose: 'lie' },
    bob: { pos: new THREE.Vector3(-6.1 - 0.15, y0, 1.4), face: Math.PI / 2, pose: 'lie' },
    tom: { pos: new THREE.Vector3(barX - 0.85, y0, bz0 + 0.7 + 2 * (bl - 1.4) / 4), face: Math.PI / 2, pose: 'sit-high' },
    visit: { pos: new THREE.Vector3(4.6, y0, 1.0), face: 0, pose: 'stand' },
  };

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
    // equaliser (silent, just light)
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
  }

  return { group: g, stations, update, sunbeds };
}

function sunbed(parent, x, z, i) {
  const s = new THREE.Group();
  s.position.set(x, 0, z);
  // oriented along x, head at -x, feet toward the pool (+x)
  box(2.0, 0.08, 0.78, M.walnut, 0, 0.26, 0, s);
  for (const [lx, lz] of [[-0.9, -0.34], [-0.9, 0.34], [0.9, -0.34], [0.9, 0.34]]) box(0.06, 0.26, 0.06, M.walnut, lx, 0, lz, s);
  rbox(1.3, 0.1, 0.72, 0.04, M.fabricCream, 0.32, 0.34, 0, s);
  const back = rbox(0.75, 0.1, 0.72, 0.04, M.fabricCream, 0, 0, 0, s);
  back.position.set(-0.62, 0.62, 0);
  back.rotation.z = -0.95;
  const pillow = rbox(0.18, 0.2, 0.45, 0.07, i % 2 ? M.fabricNavy : new THREE.MeshStandardMaterial({ color: '#8a2f2a', roughness: 0.9 }), -0.82, 0.78, 0, s);
  pillow.rotation.z = -0.95;
  if (i % 3 === 1) {
    const towel = box(0.7, 0.03, 0.74, M.towel, 0.62, 0.39, 0, s, { cast: false });
    towel.rotation.y = 0.05;
  }
  // side table
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
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.45, 8, 1, true), M.fabricCream);
  canopy.material = M.fabricCream.clone();
  canopy.material.side = THREE.DoubleSide;
  canopy.position.y = 2.55;
  canopy.castShadow = true;
  u.add(canopy);
  const closed = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.3, 8), M.fabricCream);
  closed.position.y = 2.05;
  closed.rotation.x = Math.PI;
  u.add(closed);
  parent.add(u);
  return {
    set(open) {
      canopy.visible = open;
      closed.visible = !open;
    },
  };
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
  // tied-back curtains
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
  const word = 'AGENTIUM';
  [...word].forEach((ch, i) => g.fillText(ch, 64, 70 + i * 120));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
