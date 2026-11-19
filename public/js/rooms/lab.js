// Basement — the Testing Lab. Sci-fi: dark gloss, hexagon lights, cyan neon,
// a white robot arm. Tom's test suite runs on the big wall display.
import * as THREE from 'three';
import { M } from '../core/materials.js';
import { box, rbox, cyl, sphere, plane, floorPlane, wallPlane, screen } from '../core/build.js';
import * as T from '../core/textures.js';
import { roomLights, fixtureMat, UI, rr, brandHeader } from './common.js';
import { LIFT } from '../scene/layout.js';
import { drawAgentNote } from './screens.js';
import { agentMeta, SUITS } from '../scene/roster.js';

export function buildLab(parent, room, y0, height) {
  const g = new THREE.Group();
  g.position.y = y0;
  parent.add(g);
  const { x0, x1 } = room;
  const Zb = -7.85;

  // shell
  floorPlane(x1 - x0, 16, M.labFloor, 0, 0.002, 0, g, 6);
  wallPlane(x1 - x0, height, M.labWall, 0, 0, Zb - 0.1, 0, g);
  wallPlane(16, height, M.labWall, x0 + 0.17, 0, 0, Math.PI / 2, g);
  // right wall inner panels around the lift door
  const dz0 = LIFT.z - LIFT.w / 2 - 0.25, dz1 = LIFT.z + LIFT.w / 2 + 0.25;
  wallPlane(dz0 + 7.9, height, M.labWall, x1 - 0.17, 0, (dz0 - 7.9) / 2, -Math.PI / 2, g);
  wallPlane(8 - dz1, height, M.labWall, x1 - 0.17, 0, (8 + dz1) / 2, -Math.PI / 2, g);
  const ceil = plane(x1 - x0, 16, M.ceilingDark, 0, height - 0.01, 0, g);
  ceil.rotation.x = Math.PI / 2;

  // floor light lines framing the walkway
  const neon = fixtureMat(M.neonCyan, 3);
  for (const z of [3.05, 6.4]) box(x1 - x0 - 0.8, 0.01, 0.03, neon, 0, 0, z, g, { cast: false });

  // hexagon ceiling lights
  const hexMat = fixtureMat(M.coolLight, 2.6);
  const hexGeo = new THREE.RingGeometry(0.5, 0.62, 6, 1);
  const hexes = [[-4, -3], [-2.9, -2.4], [-1.8, -3], [-0.7, -2.4], [0.4, -3], [1.5, -2.4], [2.6, -3], [3.7, -2.4], [-2.9, -1.1], [-0.7, -1.1], [1.5, -1.1], [-1.8, 0.2], [0.4, 0.2], [2.6, -4.3], [-4, -4.3], [0.4, -4.3], [-6.5, 0.8], [6.8, -1.3], [7.9, -0.7]];
  for (const [x, z] of hexes) {
    const m = new THREE.Mesh(hexGeo, hexMat);
    m.rotation.x = Math.PI / 2;
    m.position.set(x * 1.15 + 0.6, height - 0.03, z * 1.2 + 1.2);
    g.add(m);
  }

  // back wall: upper cabinets + lower counters, big display in the middle
  const dispX = 1.5, dispW = 4.6;
  for (const [a, b] of [[x0 + 0.4, dispX - dispW / 2 - 0.4], [dispX + dispW / 2 + 0.4, x1 - 0.4]]) {
    const n = Math.max(1, Math.round((b - a) / 1.6));
    const w = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const cx = a + w * (i + 0.5);
      rbox(w - 0.06, 1.0, 0.6, 0.02, M.labCabinet, cx, 2.55, Zb + 0.32, g);
      box(w - 0.3, 0.02, 0.01, M.steel, cx, 2.98, Zb + 0.63, g, { cast: false });
    }
    box(b - a, 0.02, 0.05, neon, (a + b) / 2, 2.52, Zb + 0.55, g, { cast: false });
  }
  box(x1 - x0 - 0.8, 0.92, 0.75, M.labCabinet, 0, 0, Zb + 0.4, g);
  box(x1 - x0 - 0.8, 0.05, 0.8, M.glossBlack, 0, 0.92, Zb + 0.42, g);
  box(x1 - x0 - 0.8, 0.02, 0.02, neon, 0, 0.06, Zb + 0.8, g, { cast: false });

  // bench equipment along the back counter
  const machine = (x, w, h, d, accent) => {
    rbox(w, h, d, 0.04, M.robotWhite, x, 0.97, Zb + 0.45, g);
    const s = box(w * 0.5, h * 0.3, 0.01, accent, x - w * 0.15, 0.97 + h * 0.55, Zb + 0.45 + d / 2 + 0.004, g, { cast: false });
    s.receiveShadow = false;
  };
  const glassBlue = fixtureMat(new THREE.MeshStandardMaterial({ color: '#0af', emissive: '#29b6ff', emissiveIntensity: 1.6 }), 1.6);
  machine(-10.6, 0.9, 0.55, 0.55, glassBlue);
  machine(-9.2, 0.7, 0.4, 0.5, glassBlue);
  machine(8.2, 0.85, 0.6, 0.55, glassBlue);
  machine(9.6, 0.7, 0.45, 0.5, glassBlue);
  machine(11.1, 0.8, 0.5, 0.55, glassBlue);

  // big wall display — the test suite
  const wall = screen(g, dispW, 2.2, dispX, 2.3, Zb + 0.06, 0, { px: 2400, frameMat: M.black, bezel: 0.1 });
  // neon brand above it
  const signTex = T.textTexture('AGENTIUM · TESTING LAB', { w: 1600, h: 160, color: '#7ff3ff', font: '600 78px Manrope, sans-serif', spacing: 0.35 });
  const sign = plane(4.6, 0.46, new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, color: '#9ff' }), dispX, 3.85, Zb + 0.05, g);
  sign.receiveShadow = false;

  // server racks on the left wall
  const leds = [];
  for (let i = 0; i < 3; i++) {
    const z = -5.6 + i * 1.0;
    box(0.8, 2.3, 0.9, M.labCabinet, x0 + 0.6, 0, z, g);
    for (let k = 0; k < 9; k++) {
      const led = box(0.01, 0.025, 0.4, (k + i) % 3 ? neon : glassBlue, x0 + 1.01, 0.3 + k * 0.22, z, g, { cast: false });
      leds.push(led);
    }
  }

  // central island
  const ix0 = -5.2, ix1 = 5.8, iz = -2.2;
  box(ix1 - ix0, 0.88, 1.9, M.labCabinet, (ix0 + ix1) / 2, 0.06, iz, g);
  for (let x = ix0 + 1.1; x < ix1; x += 2.2) box(0.02, 0.6, 0.01, M.steel, x, 0.22, iz + 0.955, g, { cast: false });
  box(ix1 - ix0 - 0.4, 0.04, 0.02, neon, (ix0 + ix1) / 2, 0.06, iz + 0.9, g, { cast: false });
  box(ix1 - ix0 + 0.2, 0.06, 2.1, M.glossBlack, (ix0 + ix1) / 2, 0.94, iz, g);
  box(ix1 - ix0 + 0.2, 0.012, 0.01, neon, (ix0 + ix1) / 2, 0.97, iz + 1.055, g, { cast: false });

  // robot arm
  const arm = robotArm(g, -3.2, 1.0, iz - 0.2);

  // holographic glass panel with data
  const holoTex = hologramTexture();
  const holo = plane(2.4, 1.2, new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), -0.4, 1.65, iz - 0.6, g);
  holo.receiveShadow = false;
  box(2.5, 0.04, 0.06, M.steel, -0.4, 1.0, iz - 0.6, g);

  // yellow-accent compute box (from the reference)
  rbox(0.8, 0.85, 0.6, 0.04, M.black, 2.0, 0.97, iz - 0.2, g);
  box(0.82, 0.04, 0.62, new THREE.MeshStandardMaterial({ color: '#f5b400', emissive: '#f5a000', emissiveIntensity: 0.6 }), 2.0, 0.97, iz - 0.2, g);
  box(0.5, 0.5, 0.01, M.blackMetal, 2.0, 1.15, iz + 0.11, g, { cast: false });

  // Tom's curved monitor (mirrors the suite)
  const mon = screen(g, 1.3, 0.72, 3.9, 1.48, iz - 0.15, 0, { px: 1400, frameMat: M.black, bezel: 0.04 });
  box(0.06, 0.4, 0.06, M.blackMetal, 3.9, 0.97, iz - 0.25, g);
  box(0.4, 0.02, 0.25, M.blackMetal, 3.9, 0.97, iz - 0.25, g);

  // second tester's monitor (two testers: Voice and Chat)
  const mon2 = screen(g, 1.1, 0.62, 0.95, 1.45, iz - 0.15, 0, { px: 1200, frameMat: M.black, bezel: 0.04 });
  box(0.06, 0.38, 0.06, M.blackMetal, 0.95, 0.97, iz - 0.25, g);
  box(0.36, 0.02, 0.22, M.blackMetal, 0.95, 0.97, iz - 0.25, g);

  // vials
  const vialMat = new THREE.MeshStandardMaterial({ color: '#7fdcff', emissive: '#1fb5ff', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 8; i++) cyl(0.03, 0.03, 0.18, vialMat, 4.9 + (i % 4) * 0.1, 0.98, iz - 0.4 + Math.floor(i / 4) * 0.12, g, 10);
  box(0.5, 0.04, 0.3, M.steel, 5.05, 0.97, iz - 0.34, g);

  // sculptural white stool
  const stool = new THREE.Group();
  // a couple of metres from Tom's bench, turned towards him so you can sit and talk
  const stoolFace = Math.atan2(3.9 - 6.7, -0.95);
  stool.position.set(6.7, 0, iz + 2.4);
  stool.rotation.y = stoolFace + Math.PI;
  cyl(0.28, 0.32, 0.05, M.black, 0, 0, 0, stool);
  cyl(0.06, 0.08, 0.6, M.black, 0, 0.05, 0, stool, 12);
  rbox(0.5, 0.06, 0.45, 0.02, M.robotWhite, 0, 0.66, 0, stool);
  for (let i = 0; i < 4; i++) {
    const s = rbox(0.5, 0.04, 0.06, 0.02, M.robotWhite, 0, 0.75 + i * 0.1, 0.24 + i * 0.015, stool);
    s.rotation.x = 0.1;
  }
  g.add(stool);

  // floor computer towers with recycling glyph
  rbox(0.35, 0.7, 0.55, 0.02, M.black, ix1 - 0.6, 0.0, iz + 1.4, g);

  const lights = roomLights(g, [[-4, 3.1, -0.5], [6.5, 3.1, -0.5], [1, 2.6, 4.2, 0.45]], { color: '#d6f2ff', power: 34, distance: 20, fixtures: [hexMat, neon, glassBlue] });

  const stations = {
    visit: { pos: new THREE.Vector3(-1.6, y0, iz + 1.7), face: Math.PI, pose: 'stand' },
  };
  // a bench (with its monitor) for each tester, and room for visitors
  const slots = [
    { pos: new THREE.Vector3(3.9, y0, iz + 1.45), face: Math.PI, pose: 'stand-work', ranks: ['tester'], screen: mon },
    { pos: new THREE.Vector3(0.95, y0, iz + 1.45), face: Math.PI, pose: 'stand-work', ranks: ['tester'], screen: mon2 },
    { pos: new THREE.Vector3(-1.9, y0, iz + 1.75), face: Math.PI * 0.9, pose: 'stand' },
    { pos: new THREE.Vector3(-4.3, y0, iz + 1.7), face: Math.PI * 1.05, pose: 'stand' },
  ];

  let ledT = 0;
  function update(dt, t, state, daylight, active) {
    lights.set(active, daylight, dt);
    arm.update(t, state.tests?.running);
    ledT += dt;
    if (ledT > 0.25) {
      ledT = 0;
      for (const l of leds) l.visible = Math.random() > 0.15;
    }
    holoTex.offset.x = (t * 0.02) % 1;
    // the wall: both departments' suites side by side (or the latest run before live data)
    if (state.testsByDept) drawTestsDual(wall, state.testsByDept, t);
    else drawTests(wall, state.tests, t, true);
    // each tester's monitor: their live note, with their department's run underneath
    for (const sl of slots.filter((x) => x.screen)) {
      const id = sl.takenBy;
      const a = id ? state.agents?.[id] : null;
      if (!a) {
        drawTests(sl.screen, state.tests, t, false);
        continue;
      }
      const dept = agentMeta(id, a).dept;
      const tests = state.testsByDept?.[dept] || state.tests || {};
      drawAgentNote(sl.screen, id, a, t, {
        extraSig: `${tests.passed}|${tests.failed}|${tests.left}|${tests.running}`,
        extra: (g2, x, y, w, h, k) => miniTests(g2, tests, x, y, w, h, k),
      });
    }
  }

  // the stool is a seat you can take
  const seats = [{ id: 'lab-stool', room: 'lab', floor: 0, kind: 'stoolLab', pos: new THREE.Vector3(6.7, y0, iz + 2.4), face: stoolFace, lookDown: -0.15, eye: 1.42, back: 0.05, chair: stool }];
  return { group: g, stations, slots, update, seats, screens: { wall, mon, mon2 }, inspect: [{ mesh: wall.mesh, room: 'lab', w: dispW, h: 2.2 }, { mesh: mon.mesh, room: 'lab', w: 1.3, h: 0.72 }, { mesh: mon2.mesh, room: 'lab', w: 1.1, h: 0.62 }] };
}

function robotArm(parent, x, y, z) {
  const base = new THREE.Group();
  base.position.set(x, y, z);
  parent.add(base);
  cyl(0.28, 0.32, 0.12, M.black, 0, 0, 0, base);
  const yaw = new THREE.Group();
  yaw.position.y = 0.12;
  base.add(yaw);
  cyl(0.2, 0.24, 0.32, M.robotWhite, 0, 0, 0, yaw);
  const ring = new THREE.MeshStandardMaterial({ color: '#2f8', emissive: '#22ff88', emissiveIntensity: 1.2 });
  cyl(0.205, 0.205, 0.03, ring, 0, 0.26, 0, yaw);
  const shoulder = new THREE.Group();
  shoulder.position.y = 0.42;
  yaw.add(shoulder);
  sphere(0.17, M.robotWhite, 0, 0, 0, shoulder);
  const upper = rbox(0.2, 0.9, 0.22, 0.09, M.robotWhite, 0, 0, 0, shoulder);
  upper.position.y = 0.45;
  const elbow = new THREE.Group();
  elbow.position.y = 0.9;
  shoulder.add(elbow);
  sphere(0.14, M.charcoal, 0, 0, 0, elbow);
  const fore = rbox(0.16, 0.75, 0.18, 0.07, M.robotWhite, 0, 0, 0, elbow);
  fore.position.y = 0.375;
  const wrist = new THREE.Group();
  wrist.position.y = 0.75;
  elbow.add(wrist);
  sphere(0.1, M.charcoal, 0, 0, 0, wrist);
  cyl(0.08, 0.08, 0.16, M.robotWhite, 0, 0.02, 0, wrist, 16);
  cyl(0.085, 0.085, 0.02, ring, 0, 0.12, 0, wrist, 16);
  const f1 = box(0.03, 0.14, 0.05, M.black, 0.04, 0.18, 0, wrist);
  const f2 = box(0.03, 0.14, 0.05, M.black, -0.04, 0.18, 0, wrist);
  base.traverse((o) => o.isMesh && (o.castShadow = true));
  return {
    update(t, busy) {
      const s = busy ? 1 : 0.25;
      yaw.rotation.y = Math.sin(t * 0.7 * s) * 1.1 + 0.6;
      shoulder.rotation.z = -0.5 + Math.sin(t * 0.9 * s) * 0.25;
      elbow.rotation.z = 1.35 + Math.sin(t * 1.1 * s + 1) * 0.35;
      wrist.rotation.z = 0.6 + Math.sin(t * 1.5 * s) * 0.3;
      const grip = 0.04 + Math.max(0, Math.sin(t * 2 * s)) * 0.03;
      f1.position.x = grip;
      f2.position.x = -grip;
    },
  };
}

function hologramTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  g.strokeStyle = '#38e1ff';
  g.fillStyle = '#38e1ff';
  g.lineWidth = 2;
  g.globalAlpha = 0.25;
  g.strokeRect(6, 6, 1012, 500);
  g.globalAlpha = 0.9;
  // helix
  for (let i = 0; i < 60; i++) {
    const x = 60 + i * 7;
    const y1 = 256 + Math.sin(i * 0.3) * 90, y2 = 256 - Math.sin(i * 0.3) * 90;
    g.beginPath(); g.arc(x, y1, 3, 0, 7); g.fill();
    g.beginPath(); g.arc(x, y2, 3, 0, 7); g.fill();
    if (i % 3 === 0) { g.globalAlpha = 0.35; g.beginPath(); g.moveTo(x, y1); g.lineTo(x, y2); g.stroke(); g.globalAlpha = 0.9; }
  }
  // bars
  for (let i = 0; i < 14; i++) {
    const h = 30 + ((i * 53) % 140);
    g.globalAlpha = 0.6;
    g.fillRect(560 + i * 30, 420 - h, 18, h);
  }
  g.globalAlpha = 0.9;
  g.beginPath();
  for (let i = 0; i <= 40; i++) {
    const x = 560 + i * 10.5, y = 140 + Math.sin(i * 0.5) * 40 + Math.cos(i * 0.21) * 20;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  g.font = '600 28px Manrope, sans-serif';
  g.fillText('QA · COVERAGE', 560, 60);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

let lastSig = '';
function drawTests(s, tests = {}, t, big) {
  const sig = `${big}|${tests.passed}|${tests.failed}|${tests.left}|${tests.running}|${(tests.failures || []).length}|${Math.floor(t * 2)}`;
  if (s.userData === sig) return;
  s.userData = sig;
  const g = s.ctx, w = s.w, h = s.h;
  const k = w / 1400;
  g.fillStyle = UI.bg;
  g.fillRect(0, 0, w, h);
  brandHeader(g, w, 'Test Suite', tests.suite ? `${tests.suite}` : '', { color: UI.cyan, size: k });

  const total = tests.total || 1;
  const stats = [
    ['PASSED', tests.passed ?? 0, UI.green],
    ['FAILED', tests.failed ?? 0, UI.red],
    ['LEFT', tests.left ?? 0, UI.dim],
  ];
  stats.forEach(([label, n, col], i) => {
    const x = 40 * k + i * 300 * k, y = 130 * k;
    rr(g, x, y, 280 * k, 150 * k, 14 * k);
    g.fillStyle = UI.panel;
    g.fill();
    if (label === 'FAILED' && n > 0) {
      g.strokeStyle = UI.red;
      g.lineWidth = 3 * k;
      g.stroke();
    }
    g.fillStyle = UI.dim;
    g.font = `600 ${18 * k}px Manrope, sans-serif`;
    g.fillText(label, x + 22 * k, y + 38 * k);
    g.fillStyle = col;
    g.font = `600 ${76 * k}px Manrope, sans-serif`;
    g.fillText(String(n), x + 22 * k, y + 120 * k);
  });

  // progress bar
  const px = 40 * k, py = 305 * k, pw = 880 * k, ph = 14 * k;
  rr(g, px, py, pw, ph, 7 * k);
  g.fillStyle = '#1b2430';
  g.fill();
  const pp = (tests.passed || 0) / total, pf = (tests.failed || 0) / total;
  g.fillStyle = UI.green;
  g.fillRect(px, py, pw * pp, ph);
  g.fillStyle = UI.red;
  g.fillRect(px + pw * pp, py, pw * pf, ph);

  // status line
  g.font = `500 ${22 * k}px Manrope, sans-serif`;
  g.fillStyle = tests.running ? UI.cyan : (tests.failed ? UI.red : UI.green);
  const dots = '.'.repeat(1 + (Math.floor(t * 2) % 3));
  g.fillText(tests.running ? `Running${dots}` : tests.failed ? 'Finished with failures' : (tests.passed ? 'All green' : 'Waiting for a build'), px, 370 * k);

  // log / failures
  const x2 = 960 * k;
  rr(g, x2, 130 * k, w - x2 - 40 * k, h - 170 * k, 14 * k);
  g.fillStyle = UI.panel;
  g.fill();
  g.fillStyle = UI.dim;
  g.font = `600 ${16 * k}px Manrope, sans-serif`;
  g.fillText('LATEST', x2 + 20 * k, 165 * k);
  const log = (tests.log || []).slice(-8);
  g.font = `500 ${17 * k}px "SF Mono", Menlo, monospace`;
  log.forEach((l, i) => {
    g.fillStyle = l.ok ? UI.green : UI.red;
    g.fillText(l.ok ? '✓' : '✗', x2 + 20 * k, (200 + i * 30) * k);
    g.fillStyle = l.ok ? '#c9d4e0' : '#ffb3b3';
    const txt = l.name.length > 30 ? l.name.slice(0, 29) + '…' : l.name;
    g.fillText(txt, x2 + 46 * k, (200 + i * 30) * k);
  });

  if (big && tests.failures?.length) {
    g.fillStyle = UI.red;
    g.font = `600 ${18 * k}px Manrope, sans-serif`;
    g.fillText('FAILURES', px, 420 * k);
    g.font = `500 ${19 * k}px "SF Mono", Menlo, monospace`;
    tests.failures.slice(0, 4).forEach((f, i) => {
      g.fillStyle = '#ff8a8a';
      g.fillText(`✗ ${f.name}`, px, (455 + i * 34) * k);
    });
  }
  s.tex.needsUpdate = true;
}

// a tester's department run in a strip under their note
function miniTests(g, tests, x, y, w, h, k) {
  rr(g, x, y, w, h, 10 * k);
  g.fillStyle = UI.panel;
  g.fill();
  const items = [['PASSED', tests.passed ?? 0, UI.green], ['FAILED', tests.failed ?? 0, UI.red], ['LEFT', tests.left ?? 0, UI.dim]];
  items.forEach(([l, n, c], i) => {
    const cx = x + 20 * k + i * (w / 3);
    g.fillStyle = UI.dim;
    g.font = `600 ${14 * k}px Manrope, sans-serif`;
    g.fillText(l, cx, y + 28 * k);
    g.fillStyle = c;
    g.font = `600 ${40 * k}px Manrope, sans-serif`;
    g.fillText(String(n), cx, y + 72 * k);
  });
  g.fillStyle = tests.running ? UI.cyan : tests.failed ? UI.red : UI.green;
  g.font = `500 ${16 * k}px Manrope, sans-serif`;
  g.fillText(tests.suite ? `${tests.running ? 'Running' : 'Last run'} · ${tests.suite}` : 'Waiting for a build', x + 20 * k, y + Math.min(h - 14 * k, 104 * k));
}

/** The big wall: Voice and Chat test runs side by side. */
function drawTestsDual(s, by, t) {
  const sig = ['voice', 'chat'].map((d) => { const x = by[d] || {}; return `${x.passed}|${x.failed}|${x.left}|${x.running}|${(x.failures || []).length}|${x.at}`; }).join('/') + (Object.values(by).some((x) => x?.running) ? Math.floor(t * 2) : '');
  if (s.userData === sig) return;
  s.userData = sig;
  const g = s.ctx, w = s.w, h = s.h;
  const k = w / 1400;
  g.fillStyle = UI.bg;
  g.fillRect(0, 0, w, h);
  brandHeader(g, w, 'Test Suites', 'Voice · Chat', { color: UI.cyan, size: k });
  const colW = (w - 120 * k) / 2;
  ['voice', 'chat'].forEach((dept, ci) => {
    const tests = by[dept] || {};
    const x0 = 40 * k + ci * (colW + 40 * k);
    const y0 = 120 * k;
    rr(g, x0, y0, colW, h - y0 - 30 * k, 14 * k);
    g.fillStyle = UI.panel;
    g.fill();
    g.fillStyle = SUITS[dept].builder;
    g.fillRect(x0, y0, colW, 8 * k);
    g.fillStyle = UI.text;
    g.font = `600 ${28 * k}px Manrope, sans-serif`;
    g.fillText(dept === 'voice' ? 'Voice' : 'Chat', x0 + 24 * k, y0 + 50 * k);
    g.fillStyle = UI.dim;
    g.font = `500 ${18 * k}px Manrope, sans-serif`;
    g.fillText(tests.suite || 'no run yet', x0 + 130 * k, y0 + 50 * k);
    const stats = [['PASSED', tests.passed ?? 0, UI.green], ['FAILED', tests.failed ?? 0, UI.red], ['LEFT', tests.left ?? 0, UI.dim]];
    stats.forEach(([label, n, col], i) => {
      const x = x0 + 24 * k + i * ((colW - 48 * k) / 3);
      g.fillStyle = UI.dim;
      g.font = `600 ${15 * k}px Manrope, sans-serif`;
      g.fillText(label, x, y0 + 96 * k);
      g.fillStyle = col;
      g.font = `600 ${58 * k}px Manrope, sans-serif`;
      g.fillText(String(n), x, y0 + 156 * k);
    });
    const total = tests.total || (tests.passed || 0) + (tests.failed || 0) + (tests.left || 0) || 1;
    const px = x0 + 24 * k, py = y0 + 180 * k, pw = colW - 48 * k;
    rr(g, px, py, pw, 12 * k, 6 * k);
    g.fillStyle = '#1b2430';
    g.fill();
    g.fillStyle = UI.green;
    g.fillRect(px, py, pw * ((tests.passed || 0) / total), 12 * k);
    g.fillStyle = UI.red;
    g.fillRect(px + pw * ((tests.passed || 0) / total), py, pw * ((tests.failed || 0) / total), 12 * k);
    g.font = `500 ${19 * k}px Manrope, sans-serif`;
    g.fillStyle = tests.running ? UI.cyan : tests.failed ? UI.red : tests.passed ? UI.green : UI.dim;
    const dots = '.'.repeat(1 + (Math.floor(t * 2) % 3));
    g.fillText(tests.running ? `Running${dots}` : tests.failed ? 'Finished with failures' : tests.passed ? 'All green' : 'Waiting for a build', px, py + 44 * k);
    // failures (or the latest results)
    g.font = `500 ${16 * k}px "SF Mono", Menlo, monospace`;
    const rows = tests.failures?.length ? tests.failures.map((f) => ({ ok: false, name: f.name })) : (tests.log || []).slice(-6).reverse();
    rows.slice(0, 6).forEach((l, i) => {
      g.fillStyle = l.ok ? UI.green : UI.red;
      g.fillText(`${l.ok ? '✓' : '✗'} ${String(l.name).slice(0, 42)}`, px, py + 82 * k + i * 26 * k);
    });
  });
  s.tex.needsUpdate = true;
}
