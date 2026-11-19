// Top floor — the CEO Penthouse (command desk) and the Vault (billing).
import * as THREE from 'three';
import { M } from '../core/materials.js';
import { box, rbox, cyl, sphere, plane, floorPlane, wallPlane, screen, windowWall, plant, chairOffice, armchair } from '../core/build.js';
import { roomLights, fixtureMat, plaque, UI, rr } from './common.js';
import { LIFT } from '../scene/layout.js';
import { balanceLevel, daysLeft } from '../data/derive.js';

const Zb = -7.85;

// ====================================================================== penthouse
export function buildPenthouse(parent, room, y0, height) {
  const g = new THREE.Group();
  g.position.y = y0;
  parent.add(g);
  const { x0, x1 } = room;
  const cx = (x0 + x1) / 2;

  floorPlane(x1 - x0, 16, M.lightFloor, cx, 0.002, 0, g, 5);
  const rug = plane(8.6, 6.4, M.rugGrey, 5, 0.012, -2.6, g);
  rug.rotation.x = -Math.PI / 2;
  const ceil = plane(x1 - x0, 16, M.ceilingDark, cx, height - 0.01, 0, g);
  ceil.rotation.x = Math.PI / 2;
  // dropped black ceiling edge with a warm cove
  const cove = fixtureMat(M.ledWarm, 1.6);
  box(x1 - x0 - 0.3, 0.35, 0.8, M.black, cx, height - 0.35, Zb + 0.5, g);
  box(x1 - x0 - 0.3, 0.03, 0.04, cove, cx, height - 0.37, Zb + 0.92, g, { cast: false });

  // corner windows with black frames + low ledge (penthouse reference)
  windowWall({ parent: g, axis: 'x', from: x0 + 0.1, to: x1 - 0.1, at: Zb - 0.05, y0: 0.5, h: height - 0.52, mullion: 2.7, frameMat: M.black, glassMat: M.glass, transom: false });
  box(x1 - x0 - 0.2, 0.5, 0.6, M.charcoal, cx, 0, Zb + 0.28, g);
  box(x1 - x0 - 0.2, 0.04, 0.66, M.marble, cx, 0.5, Zb + 0.3, g);
  box(0.6, 0.5, 10, M.charcoal, x1 - 0.42, 0, -2.9, g);
  box(0.66, 0.04, 10, M.marble, x1 - 0.42, 0.5, -2.9, g);

  // partition wall to the vault (ebony) with art
  wallPlane(11.2, height, M.ebony, x0 + 0.08, 0, Zb + 5.6, Math.PI / 2, g, 3);
  box(0.16, height, 11.2, M.ebony, x0 - 0.02, 0, Zb + 5.6, g);
  box(0.16, height - 2.75, LIFT.w + 1.6, M.ebony, x0 - 0.02, 2.75, 4.7, g);
  box(0.2, 0.08, 2.0, M.brass, x0, 2.7, 4.7, g);
  const art = new THREE.MeshStandardMaterial({ color: '#d8cfc0', roughness: 0.9 });
  box(0.05, 1.5, 2.2, M.brass, x0 + 0.13, 1.6, -2.0, g);
  box(0.02, 1.38, 2.08, art, x0 + 0.17, 1.66, -2.0, g, { cast: false });
  box(0.02, 0.8, 0.5, M.navySteel, x0 + 0.185, 1.9, -2.4, g, { cast: false });
  box(0.02, 0.5, 0.9, M.leatherCognac, x0 + 0.19, 2.0, -1.6, g, { cast: false });

  // ---------------------------------------------------------- the desk (bigger than life)
  const dx = 5.0, dz = -3.4, dw = 3.8, dd = 1.6, dh = 0.78;
  box(dw, 0.06, dd, M.glossBlack, dx, dh - 0.06, dz, g);
  box(dw + 0.04, 0.012, dd + 0.04, M.chrome, dx, dh - 0.07, dz, g, { cast: false });
  box(dw - 0.5, 0.16, dd - 0.3, M.glossBlack, dx, dh - 0.22, dz, g); // drawer body
  for (const sx of [-1, 1]) {
    // chrome sled legs
    box(0.06, dh - 0.07, 0.06, M.chrome, dx + sx * (dw / 2 - 0.15), 0, dz - dd / 2 + 0.12, g);
    box(0.06, dh - 0.07, 0.06, M.chrome, dx + sx * (dw / 2 - 0.15), 0, dz + dd / 2 - 0.12, g);
    box(0.06, 0.04, dd - 0.2, M.chrome, dx + sx * (dw / 2 - 0.15), 0, dz, g);
  }
  const top = dh;

  // CEO chair behind the desk, guest armchairs in front
  const ceo = chairOffice(g, dx, 0, dz - 1.15, Math.PI, { seat: M.leatherWhite, frame: M.chrome });
  ceo.scale.setScalar(1.18);
  armchair(g, dx - 1.25, 0, dz + 2.3, Math.PI + 0.25, { leather: M.leatherBlack, legs: M.chrome });
  armchair(g, dx + 1.25, 0, dz + 2.3, Math.PI - 0.25, { leather: M.leatherBlack, legs: M.chrome });

  // monitor (faces the CEO, back toward the room)
  box(1.1, 0.62, 0.03, M.blackMetal, dx + 0.1, top + 0.32, dz - 0.45, g);
  box(0.06, 0.32, 0.06, M.chrome, dx + 0.1, top, dz - 0.4, g);
  box(0.3, 0.015, 0.2, M.chrome, dx + 0.1, top, dz - 0.4, g);

  // arc lamp with brass dome (reference 2)
  const lamp = new THREE.Group();
  lamp.position.set(dx + 1.55, top, dz - 0.45);
  cyl(0.11, 0.13, 0.05, M.black, 0, 0, 0, lamp);
  box(0.03, 0.85, 0.03, M.brass, 0, 0.05, 0, lamp);
  const armL = box(0.025, 0.95, 0.025, M.brass, 0, 0, 0, lamp);
  armL.position.set(-0.34, 0.95, 0.15);
  armL.rotation.set(0.35, 0, 1.05);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.brass);
  dome.position.set(-0.8, 1.08, 0.38);
  dome.castShadow = true;
  lamp.add(dome);
  const bulb = sphere(0.06, M.warmLight, -0.8, 1.04, 0.38, lamp, 12, { cast: false });
  g.add(lamp);
  const lampLight = new THREE.PointLight('#ffcf8f', 0, 4, 2);
  lampLight.position.set(dx + 0.75, top + 0.95, dz - 0.07);
  g.add(lampLight);

  // ---------------------------------------------------------- command items on the desk
  const pickables = [];
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd38a', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });

  // documents tray
  const tray = new THREE.Group();
  tray.position.set(dx - 1.25, top, dz + 0.2);
  rbox(0.5, 0.04, 0.38, 0.01, M.leatherCognac, 0, 0, 0, tray);
  for (const [w, d, x, z] of [[0.5, 0.02, 0, 0.18], [0.5, 0.02, 0, -0.18], [0.02, 0.38, 0.25, 0], [0.02, 0.38, -0.25, 0]]) box(w, 0.07, d, M.brass, x, 0, z, tray);
  const sheets = [];
  for (let i = 0; i < 10; i++) {
    const s = box(0.4, 0.008, 0.29, M.paper, (Math.random() - 0.5) * 0.02, 0.045 + i * 0.012, (Math.random() - 0.5) * 0.02, tray, { cast: false });
    s.rotation.y = (Math.random() - 0.5) * 0.08;
    s.visible = false;
    sheets.push(s);
  }
  const topupCard = box(0.32, 0.01, 0.2, new THREE.MeshStandardMaterial({ color: '#1b1610', emissive: '#c9a15e', emissiveIntensity: 0.5 }), 0.03, 0.05, 0.02, tray, { cast: false });
  const trayGlow = plane(0.7, 0.55, glowMat.clone(), 0, 0.005, 0, tray);
  trayGlow.rotation.x = -Math.PI / 2;
  const trayHit = box(0.6, 0.25, 0.48, new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0, tray, { cast: false });
  trayHit.userData.action = 'tray';
  trayHit.userData.label = 'Documents tray';
  pickables.push(trayHit);
  g.add(tray);

  // decisions folder (burgundy leather, gold clasp)
  const folder = new THREE.Group();
  folder.position.set(dx - 0.45, top, dz + 0.35);
  folder.rotation.y = 0.12;
  rbox(0.34, 0.03, 0.44, 0.01, new THREE.MeshStandardMaterial({ color: '#5a1620', roughness: 0.4 }), 0, 0, 0, folder);
  box(0.07, 0.032, 0.05, M.brass, 0.15, 0.002, 0, folder);
  const ribbon = box(0.02, 0.032, 0.44, M.brass, -0.08, 0.002, 0, folder, { cast: false });
  const folderGlow = plane(0.55, 0.65, glowMat.clone(), 0, 0.004, 0, folder);
  folderGlow.rotation.x = -Math.PI / 2;
  const folderHit = box(0.45, 0.25, 0.55, new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0, folder, { cast: false });
  folderHit.userData.action = 'decisions';
  folderHit.userData.label = 'Decisions';
  pickables.push(folderHit);
  g.add(folder);

  // desk phone
  const phone = new THREE.Group();
  phone.position.set(dx + 0.95, top, dz + 0.25);
  phone.rotation.y = -0.3;
  rbox(0.28, 0.07, 0.24, 0.03, M.glossBlack, 0, 0, 0, phone);
  const hand = rbox(0.06, 0.05, 0.26, 0.025, M.glossBlack, -0.09, 0.07, 0, phone);
  box(0.12, 0.002, 0.09, M.brass, 0.05, 0.071, 0.03, phone, { cast: false });
  const phoneLed = sphere(0.012, new THREE.MeshBasicMaterial({ color: '#3ddc97', toneMapped: false }), 0.1, 0.075, -0.08, phone, 8, { cast: false });
  const phoneHit = box(0.4, 0.25, 0.4, new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 0, phone, { cast: false });
  phoneHit.userData.action = 'phone';
  phoneHit.userData.label = 'Call an agent';
  pickables.push(phoneHit);
  g.add(phone);

  // pen + bowl + notebook
  box(0.24, 0.015, 0.3, M.leatherDark, dx + 0.4, top, dz + 0.35, g, { cast: false });
  cyl(0.008, 0.008, 0.16, M.brass, dx + 0.55, top + 0.02, dz + 0.3, g, 8).rotation.z = Math.PI / 2;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.chrome);
  bowl.position.set(dx + 1.55, top + 0.17, dz + 0.35);
  g.add(bowl);

  // ---------------------------------------------------------- drinks cabinet (cognac & whisky)
  const cab = new THREE.Group();
  cab.position.set(x0 + 0.5, 0, -6.0);
  cab.rotation.y = Math.PI / 2;
  box(2.8, 0.85, 0.55, M.glossBlack, 0, 0, 0, cab);
  for (let i = 0; i < 4; i++) box(0.6, 0.015, 0.01, M.brass, -1.05 + i * 0.7, 0.55, 0.281, cab, { cast: false });
  box(1.1, 0.02, 0.45, M.chrome, 0.4, 0.85, 0, cab);
  decanter(cab, 0.1, 0.87, 0, M.cognac, 0);
  decanter(cab, 0.55, 0.87, 0.05, M.whisky, 1);
  for (let i = 0; i < 3; i++) cyl(0.04, 0.035, 0.09, M.decanterGlass, 0.85 + (i % 2) * 0.1, 0.87, -0.12 + i * 0.1, cab, 12, { cast: false });
  box(0.3, 0.3, 0.26, M.oak, -0.9, 0.85, 0, cab);
  g.add(cab);

  plant(g, x1 - 0.9, 0.54, -7.2, { scale: 1.1, pot: M.white, leafMat: M.leaf, seed: 11 });
  plant(g, x0 + 0.7, 0, 1.6, { scale: 1.6, pot: M.charcoal, leafMat: M.leafDark, seed: 4 });
  plaque(g, 'CEO Penthouse', x0 + 0.13, 2.5, 3.0, Math.PI / 2);

  const down = fixtureMat(M.warmLight, 2);
  for (const [x, z] of [[1, -5], [5, -5], [9, -5], [1, -1], [5, -1], [9, -1], [5, 3], [10, 3]]) cyl(0.09, 0.09, 0.02, down, x, height - 0.03, z, g, 16);

  const lights = roomLights(g, [[2.5, 3.8, -2.5], [8, 3.8, -2.5], [5, 3.6, 3, 0.5]], { power: 18, fixtures: [down, cove] });

  const stations = {
    visit: { pos: new THREE.Vector3(dx - 2.6, y0, dz + 0.9), face: Math.PI / 2, pose: 'stand' },
    scott: { pos: new THREE.Vector3(dx - 2.6, y0, dz + 0.9), face: Math.PI / 2, pose: 'stand' },
  };

  function update(dt, t, state, daylight, active) {
    const lvl = lights.set(Math.max(active, 0.55), daylight, dt);
    lampLight.intensity = (1 - daylight) * 3 + 0.6;
    const ceoState = state.ceo || {};
    const docs = (ceoState.documents || []).filter((d) => !d.read).length;
    const topups = (state.derived?.topups || []).length;
    const pending = (ceoState.decisions || []).filter((d) => d.status === 'pending').length;
    sheets.forEach((s, i) => (s.visible = i < Math.min(10, docs * 2)));
    topupCard.visible = topups > 0;
    topupCard.position.y = 0.05 + Math.min(10, docs * 2) * 0.012;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    trayGlow.material.opacity = docs + topups > 0 ? 0.18 + pulse * 0.25 : 0;
    folderGlow.material.opacity = pending > 0 ? 0.2 + pulse * 0.3 : 0;
    phoneLed.material.color.set(Math.floor(t * 1.5) % 2 && (ceoState.unreadChats || 0) > 0 ? '#ffb547' : '#3ddc97');
    void lvl;
  }

  return { group: g, stations, update, pickables };
}

function decanter(parent, x, y, z, liquid, style) {
  const d = new THREE.Group();
  d.position.set(x, y, z);
  if (style === 0) {
    // round cognac decanter
    const body = sphere(0.13, M.decanterGlass, 0, 0.13, 0, d, 24, { cast: false });
    body.scale.set(1, 0.9, 1);
    const liq = sphere(0.11, liquid, 0, 0.1, 0, d, 20, { cast: false });
    liq.scale.set(1, 0.65, 1);
    cyl(0.03, 0.04, 0.12, M.decanterGlass, 0, 0.24, 0, d, 12, { cast: false });
    sphere(0.045, M.decanterGlass, 0, 0.39, 0, d, 12, { cast: false });
  } else {
    // square whisky decanter
    box(0.17, 0.24, 0.17, M.decanterGlass, 0, 0, 0, d, { cast: false });
    box(0.15, 0.16, 0.15, liquid, 0, 0.01, 0, d, { cast: false });
    cyl(0.03, 0.035, 0.06, M.decanterGlass, 0, 0.24, 0, d, 12, { cast: false });
    box(0.07, 0.07, 0.07, M.decanterGlass, 0, 0.3, 0, d, { cast: false }).rotation.y = Math.PI / 4;
  }
  parent.add(d);
  return d;
}

// ====================================================================== vault
export function buildVault(parent, room, y0, height) {
  const g = new THREE.Group();
  g.position.y = y0;
  parent.add(g);
  const { x0, x1 } = room;
  const cx = (x0 + x1) / 2;
  const w = x1 - x0;

  floorPlane(w, 16, M.marble, cx, 0.002, 0, g, 4);
  const ceil = plane(w, 16, M.ceilingDark, cx, height - 0.01, 0, g);
  ceil.rotation.x = Math.PI / 2;
  // glowing ceiling frame
  const frame = fixtureMat(M.warmLight, 1.6);
  const fw = w - 3, fd = 7;
  for (const [bw, bd, x, z] of [[fw, 0.14, cx, -4.5 - fd / 2], [fw, 0.14, cx, -4.5 + fd / 2], [0.14, fd, cx - fw / 2, -4.5], [0.14, fd, cx + fw / 2, -4.5]]) box(bw, 0.04, bd, frame, x, height - 0.36, z, g, { cast: false });
  box(fw + 0.5, 0.32, fd + 0.5, M.glossBlack, cx, height - 0.33, -4.5, g, { cast: false }).material = M.glossBlack;

  // quilted leather walls (back + left), brass trims
  wallPlane(w, height, M.quiltWall, cx, 0, Zb - 0.05, 0, g, 2.5);
  wallPlane(16, height, M.quiltWall, x0 + 0.18, 0, 0, Math.PI / 2, g, 2.5);
  // hide the facade glass behind leather on this floor's left
  for (const x of [x0 + 0.6, x0 + 2.8, x1 - 2.8, x1 - 0.6]) box(0.08, height - 0.4, 0.06, M.brass, x, 0.2, Zb + 0.02, g, { cast: false });

  // shelving with ledger boxes, ebony drawers below
  const shelfMat = M.blackMetal;
  for (const [a, b] of [[x0 + 0.5, x0 + 2.9], [x1 - 2.9, x1 - 0.5]]) {
    const sw = b - a, scx = (a + b) / 2;
    box(sw, 2.6, 0.04, M.quiltWall, scx, 1.0, Zb + 0.05, g);
    box(sw, 0.04, 0.5, M.brass, scx, 3.6, Zb + 0.28, g);
    for (let r = 0; r < 4; r++) {
      const yy = 1.15 + r * 0.6;
      box(sw - 0.1, 0.03, 0.46, M.brass, scx, yy, Zb + 0.3, g, { cast: false });
      box(sw - 0.1, 0.012, 0.01, M.ledWarm, scx, yy + 0.56, Zb + 0.52, g, { cast: false });
      // ledger boxes and files (no luxury goods)
      for (let k = 0; k < 4; k++) {
        const bx = a + 0.3 + k * ((sw - 0.6) / 3);
        if ((r + k) % 3 === 0) rbox(0.36, 0.26, 0.32, 0.02, M.leatherCognac, bx, yy + 0.03, Zb + 0.32, g);
        else for (let f = 0; f < 5; f++) box(0.05, 0.36, 0.3, f % 2 ? M.leatherDark : M.charcoal, bx - 0.12 + f * 0.06, yy + 0.03, Zb + 0.32, g, { cast: false });
      }
    }
    box(0.04, 2.6, 0.5, M.brass, a, 1.0, Zb + 0.28, g);
    box(0.04, 2.6, 0.5, M.brass, b, 1.0, Zb + 0.28, g);
  }
  // drawer run along the back
  box(w - 0.8, 0.92, 0.6, M.ebony, cx, 0, Zb + 0.33, g);
  box(w - 0.8, 0.04, 0.66, M.leatherDark, cx, 0.92, Zb + 0.35, g);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
    const hx = x0 + 0.9 + c * ((w - 1.8) / 5);
    box(0.08, 0.04, 0.02, M.brass, hx, 0.18 + r * 0.27, Zb + 0.64, g, { cast: false });
  }
  box(w - 0.8, 0.02, 0.02, M.ledWarm, cx, 0.03, Zb + 0.64, g, { cast: false });

  // left wall drawers + round vault door
  box(0.6, 0.92, 7, M.ebony, x0 + 0.5, 0, -2.5, g);
  box(0.66, 0.04, 7, M.leatherDark, x0 + 0.5, 0.92, -2.5, g);
  // left wall: lit display shelves with ledgers and archive boxes (no luxury goods)
  box(0.04, 2.6, 4.4, M.quiltWall, x0 + 0.27, 1.0, -2.6, g);
  box(0.5, 0.04, 4.4, M.brass, x0 + 0.5, 3.6, -2.6, g);
  for (const z of [-4.8, -2.6, -0.4]) box(0.5, 2.6, 0.04, M.brass, x0 + 0.5, 1.0, z, g);
  for (let r = 0; r < 4; r++) {
    const yy = 1.15 + r * 0.6;
    box(0.46, 0.03, 4.36, M.brass, x0 + 0.52, yy, -2.6, g, { cast: false });
    box(0.01, 0.012, 4.3, M.ledWarm, x0 + 0.74, yy + 0.56, -2.6, g, { cast: false });
    for (let k = 0; k < 6; k++) {
      const z = -4.45 + k * 0.72;
      if ((r + k) % 3 === 1) rbox(0.3, 0.24, 0.36, 0.02, M.leatherCognac, x0 + 0.55, yy + 0.03, z, g);
      else for (let f = 0; f < 5; f++) box(0.28, 0.34, 0.05, f % 2 ? M.leatherDark : M.charcoal, x0 + 0.55, yy + 0.03, z - 0.12 + f * 0.06, g, { cast: false });
    }
  }

  // pouf
  cyl(0.32, 0.32, 0.42, M.quiltWall, cx + 1.2, 0, -1.2, g, 32);
  cyl(0.33, 0.33, 0.04, M.brass, cx + 1.2, 0, -1.2, g, 32);

  // balance wall screen
  const scr = screen(g, 4.2, 2.1, cx, 2.25, Zb + 0.08, 0, { px: 1400, frameMat: M.brass, bezel: 0.12 });
  const hit = scr.mesh;
  hit.userData.action = 'vault';
  hit.userData.label = 'Balance tracker';

  plaque(g, 'The Vault · Billing', cx, 3.75, Zb + 0.07, 0, { w: 1.6 });

  const lights = roomLights(g, [[cx, 3.3, -3.5], [cx, 3.2, 3, 0.4]], { color: '#ffe6c4', power: 9, fixtures: [frame] });

  function update(dt, t, state, daylight, active) {
    const urgent = (state.balances || []).some((b) => balanceLevel(b) === 'urgent');
    lights.set(Math.max(active, 0.6), daylight, dt);
    drawBalances(scr, state.balances || [], t, urgent);
  }
  return { group: g, stations: { visit: { pos: new THREE.Vector3(cx, y0, -1), face: Math.PI, pose: 'stand' } }, update, pickables: [hit] };
}

function drawBalances(s, list, t, urgent) {
  const sig = list.map((b) => `${b.id}${b.balance.toFixed(1)}`).join('|') + (urgent ? Math.floor(t * 2) % 2 : '');
  if (s.userData === sig) return;
  s.userData = sig;
  const g = s.ctx, w = s.w, h = s.h;
  const k = w / 1400;
  g.fillStyle = '#0d0b09';
  g.fillRect(0, 0, w, h);
  g.fillStyle = UI.gold;
  g.font = `600 ${18 * k}px Manrope, sans-serif`;
  if ('letterSpacing' in g) g.letterSpacing = '0.3em';
  g.fillText('AGENTIUM · BALANCE TRACKER', 44 * k, 54 * k);
  if ('letterSpacing' in g) g.letterSpacing = '0em';
  g.fillStyle = '#f3ece1';
  g.font = `500 ${44 * k}px "Cormorant Garamond", serif`;
  g.fillText('Services', 44 * k, 104 * k);
  g.fillStyle = UI.dim;
  g.font = `600 ${15 * k}px Manrope, sans-serif`;
  g.fillText('SERVICE', 44 * k, 150 * k);
  g.fillText('BALANCE', 520 * k, 150 * k);
  g.fillText('LASTS ABOUT', 800 * k, 150 * k);
  const rowH = Math.min(92, (h / k - 190) / Math.max(1, list.length)) * k;
  list.forEach((b, i) => {
    const y = 170 * k + i * rowH;
    const lvl = balanceLevel(b);
    const col = lvl === 'urgent' ? UI.red : lvl === 'low' ? UI.amber : UI.green;
    rr(g, 34 * k, y, w - 68 * k, rowH - 12 * k, 10 * k);
    g.fillStyle = lvl === 'urgent' ? 'rgba(255,77,79,.12)' : lvl === 'low' ? 'rgba(255,181,71,.08)' : '#15120f';
    g.fill();
    if (lvl === 'urgent') {
      g.strokeStyle = UI.red;
      g.lineWidth = 2 * k;
      g.stroke();
    }
    const mid = y + (rowH - 12 * k) / 2 + 9 * k;
    g.fillStyle = '#f3ece1';
    g.font = `500 ${28 * k}px Manrope, sans-serif`;
    g.fillText(b.service, 60 * k, mid);
    g.font = `600 ${30 * k}px Manrope, sans-serif`;
    g.fillText(`${b.currency === 'EUR' ? '€' : '$'}${b.balance.toFixed(2)}`, 520 * k, mid);
    const d = daysLeft(b);
    g.fillStyle = col;
    g.fillText(d === Infinity ? '—' : `${Math.max(0, Math.floor(d))} days`, 800 * k, mid);
    // bar
    const bw = 260 * k, bx = w - 34 * k - bw - 30 * k;
    rr(g, bx, mid - 12 * k, bw, 10 * k, 5 * k);
    g.fillStyle = '#26211b';
    g.fill();
    rr(g, bx, mid - 12 * k, bw * Math.min(1, d / 30), 10 * k, 5 * k);
    g.fillStyle = col;
    g.fill();
    g.font = `600 ${14 * k}px Manrope, sans-serif`;
    g.fillText(lvl === 'urgent' ? 'URGENT' : lvl === 'low' ? 'LOW' : 'OK', bx, mid + 22 * k);
  });
  s.tex.needsUpdate = true;
}
