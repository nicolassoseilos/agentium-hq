// Work floor — the Workshop (architect studio, Bob) and the Planning Room
// (long wooden table with a screen wall, Scott).
import * as THREE from 'three';
import { M } from '../core/materials.js';
import { box, rbox, cyl, sphere, plane, floorPlane, wallPlane, screen, windowWall, plant, chairOffice } from '../core/build.js';
import * as T from '../core/textures.js';
import { roomLights, fixtureMat, plaque, trackLights, UI, rr, brandHeader, wrapText } from './common.js';
import { LIFT } from '../scene/layout.js';

const Zb = -7.85;

// ====================================================================== workshop
export function buildWorkshop(parent, room, y0, height) {
  const g = new THREE.Group();
  g.position.y = y0;
  parent.add(g);
  const { x0, x1 } = room;
  const cx = (x0 + x1) / 2;

  floorPlane(x1 - x0, 16, M.oakFloor, cx, 0.002, 0, g, 5);
  const ceil = plane(x1 - x0, 16, M.concrete, cx, height - 0.01, 0, g);
  ceil.rotation.x = Math.PI / 2;
  // concrete beam + column like the studio reference
  box(x1 - x0, 0.45, 0.5, M.concrete, cx, height - 0.45, -4.2, g);
  box(0.55, height, 0.55, M.concrete, x0 + 0.5, 0, -7.4, g);

  windowWall({ parent: g, axis: 'x', from: x0 + 0.8, to: x1 - 0.1, at: Zb - 0.05, y0: 0, h: height - 0.02, mullion: 2.4, frameMat: M.oak, glassMat: M.glass });

  // tall oak bookshelf on the left wall
  const shelfX = x0 + 0.45;
  box(0.55, height - 0.3, 9.6, M.oak, shelfX, 0, -2.0, g);
  const bookMats = [1, 2, 3, 4].map((s) => new THREE.MeshStandardMaterial({ map: T.books({ seed: s * 7 }), roughness: 0.8 }));
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const z = -6.3 + c * 2.4 + 0.6;
      const y = 0.25 + r * 0.66;
      const b = plane(2.2, 0.5, bookMats[(r + c) % 4], shelfX + 0.28, y + 0.25, z, g);
      b.rotation.y = Math.PI / 2;
      box(0.5, 0.03, 2.3, M.oak, shelfX + 0.04, y - 0.03, z, g, { cast: false });
    }
  }

  // two long drafting tables
  const tables = [-4.7, -1.25];
  const bpMats = [1, 2, 3, 4, 5].map((s) => new THREE.MeshStandardMaterial({ map: T.blueprint({ seed: s }), roughness: 0.9 }));
  tables.forEach((tz, ti) => {
    const tx0 = x0 + 1.6, tx1 = x1 - 1.2, tw = tx1 - tx0, tcx = (tx0 + tx1) / 2;
    box(tw, 0.08, 1.55, M.oak, tcx, 0.82, tz, g);
    for (const lx of [tx0 + 0.4, tcx, tx1 - 0.4]) {
      box(0.1, 0.82, 1.3, M.oak, lx, 0, tz, g);
      box(0.1, 0.08, 1.45, M.oak, lx, 0.0, tz, g);
    }
    box(tw - 0.6, 0.07, 0.07, M.oak, tcx, 0.25, tz, g);
    // drawings
    for (let i = 0; i < 4; i++) {
      const p = plane(0.9, 0.62, bpMats[(i + ti) % 5], tx0 + 0.9 + i * 2.6, 0.905, tz + (i % 2 ? 0.2 : -0.15), g);
      p.rotation.set(-Math.PI / 2, 0, (i - 1.5) * 0.06);
    }
    // architectural models
    const models = new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.8 });
    box(0.3, 0.42, 0.3, models, tx0 + 2.2, 0.9, tz - 0.4, g);
    box(0.22, 0.28, 0.4, models, tx0 + 2.6, 0.9, tz - 0.35, g);
    box(0.5, 0.06, 0.4, M.oak, tx0 + 6.6, 0.9, tz - 0.3, g);
    // pencil cup, desk lamp
    cyl(0.05, 0.05, 0.13, M.blackMetal, tx1 - 0.6, 0.9, tz - 0.5, g, 12);
    deskLamp(g, tx0 + 0.5, 0.9, tz - 0.45, 0.6);
  });

  // second monitor on the back table
  imac(g, -4.3, 0.9, -5.15, 0.7, 0.42);

  // Bob's big monitor (front table, facing the camera)
  const bob = screen(g, 1.28, 0.74, -7.0, 1.42, -1.6, 0, { px: 1024, frameMat: M.charcoal, bezel: 0.05 });
  box(0.08, 0.45, 0.06, M.steel, -7.0, 0.9, -1.68, g);
  box(0.36, 0.02, 0.22, M.steel, -7.0, 0.9, -1.68, g);
  box(0.55, 0.02, 0.18, M.charcoal, -7.0, 0.905, -0.92, g); // keyboard
  chairOffice(g, -7.0, 0, 0.05, 0, { seat: M.leatherDark, frame: M.steel });
  chairOffice(g, -3.4, 0, -3.65, Math.PI + 0.3, { seat: M.leatherDark, frame: M.steel });

  // easel near the window
  const easel = new THREE.Group();
  easel.position.set(-11.3, 0, -6.4);
  easel.rotation.y = 0.5;
  for (const s of [-0.35, 0.35]) {
    const leg = box(0.05, 2.0, 0.05, M.oak, s, 0, 0, easel);
    leg.rotation.x = -0.1;
  }
  const board = plane(1.0, 0.75, bpMats[0], 0, 1.35, 0.12, easel);
  board.rotation.x = -0.1;
  g.add(easel);

  plant(g, -1.0, 0, -6.8, { scale: 1.5, pot: M.charcoal, leafMat: M.leaf, seed: 3 });
  plant(g, -11.7, 0, 1.9, { scale: 1.3, pot: M.charcoal, leafMat: M.leaf, seed: 8 });

  const spot = fixtureMat(M.warmLight, 2.4);
  trackLights(g, x0 + 1.5, x1 - 1, height - 0.01, -6, 6, spot);
  trackLights(g, x0 + 1.5, x1 - 1, height - 0.01, -2.3, 6, spot);
  trackLights(g, x0 + 1.5, x1 - 1, height - 0.01, 1.8, 6, spot);

  plaque(g, 'Workshop', x0 + 0.76, 2.6, 4.2, Math.PI / 2);
  box(0.04, height, 6, M.offWhite, x0 + 0.2, 0, 5, g);

  const lights = roomLights(g, [[-9, 3.8, -2], [-3.5, 3.8, -2], [-6, 3.6, 4, 0.5]], { power: 20, fixtures: [spot] });

  const stations = {
    bob: { pos: new THREE.Vector3(-7.0, y0, 0.12), face: Math.PI, pose: 'sit-type' },
    visit: { pos: new THREE.Vector3(-5.8, y0, 0.6), face: Math.PI * 1.2, pose: 'stand' },
  };

  function update(dt, t, state, daylight, active) {
    lights.set(active, daylight, dt);
    drawCode(bob, state.workshop, state.agents?.bob, t);
  }
  return { group: g, stations, update, screens: { bob } };
}

function imac(parent, x, y, z, w, h) {
  box(w + 0.04, h + 0.12, 0.03, M.chrome, x, y + 0.3, z, parent);
  const s = box(w, h, 0.005, M.glossBlack, x, y + 0.36, z + 0.017, parent, { cast: false });
  s.receiveShadow = false;
  box(0.08, 0.3, 0.12, M.chrome, x, y, z - 0.06, parent);
}

export function deskLamp(parent, x, y, z, s = 1) {
  const l = new THREE.Group();
  l.position.set(x, y, z);
  l.scale.setScalar(s);
  cyl(0.12, 0.14, 0.03, M.blackMetal, 0, 0, 0, l);
  const a = box(0.025, 0.6, 0.025, M.blackMetal, 0, 0.02, 0, l);
  a.rotation.z = 0.25;
  const b = box(0.025, 0.5, 0.025, M.blackMetal, -0.15, 0.58, 0, l);
  b.rotation.z = -1.1;
  const head = cyl(0.04, 0.12, 0.14, M.blackMetal, 0.28, 0.72, 0, l, 16);
  head.rotation.z = 0.4;
  parent.add(l);
  return l;
}

const CODE_COLORS = { kw: '#c792ea', str: '#c3e88d', tag: '#82aaff', cm: '#5c6f82', fn: '#ffcb6b', plain: '#d6deeb' };
function tokenColor(line) {
  if (line.trim().startsWith('//')) return CODE_COLORS.cm;
  if (/^\s*(import|export|const|return|function|if|await|async)/.test(line)) return CODE_COLORS.kw;
  if (/^\s*</.test(line)) return CODE_COLORS.tag;
  if (/['"`]/.test(line)) return CODE_COLORS.str;
  return CODE_COLORS.plain;
}

function drawCode(s, ws = {}, bob = {}, t) {
  const lines = ws.lines || [];
  const sig = `${lines.length}|${ws.typing?.length}|${ws.task?.title}|${bob.status}|${Math.floor(t * 2) % 2}`;
  if (s.userData === sig) return;
  s.userData = sig;
  const g = s.ctx, w = s.w, h = s.h;
  g.fillStyle = '#0d1117';
  g.fillRect(0, 0, w, h);
  // title bar
  g.fillStyle = '#161b22';
  g.fillRect(0, 0, w, 70);
  ['#ff5f56', '#ffbd2e', '#27c93f'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(28 + i * 26, 35, 8, 0, 7); g.fill(); });
  g.fillStyle = UI.gold;
  g.font = '600 18px Manrope, sans-serif';
  if ('letterSpacing' in g) g.letterSpacing = '0.25em';
  g.fillText('AGENTIUM', 120, 41);
  if ('letterSpacing' in g) g.letterSpacing = '0em';
  g.fillStyle = '#c9d1d9';
  g.font = '500 20px Manrope, sans-serif';
  g.fillText(ws.task ? `${ws.task.id} · ${ws.task.title}` : 'No task', 270, 41);
  // file tab
  g.fillStyle = '#0d1117';
  g.fillRect(0, 70, 330, 44);
  g.fillStyle = '#8b949e';
  g.font = '500 17px "SF Mono", Menlo, monospace';
  g.fillText(ws.file || '', 20, 98);
  // code
  const maxLines = 15;
  const shown = [...lines, ws.typing ?? ''].slice(-maxLines);
  const startNo = Math.max(1, lines.length + 1 - maxLines + 1);
  g.font = '500 21px "SF Mono", Menlo, monospace';
  shown.forEach((ln, i) => {
    const y = 148 + i * 29;
    g.fillStyle = '#3b4552';
    g.textAlign = 'right';
    g.fillText(String(startNo + i), 56, y);
    g.textAlign = 'left';
    g.fillStyle = tokenColor(ln);
    g.fillText(ln, 76, y);
    if (i === shown.length - 1 && Math.floor(t * 2) % 2 === 0 && bob.status === 'working') {
      g.fillStyle = '#e6edf3';
      g.fillRect(76 + g.measureText(ln).width + 2, y - 20, 11, 25);
    }
  });
  // status bar
  g.fillStyle = bob.status === 'working' ? '#1f6feb' : '#30363d';
  g.fillRect(0, h - 34, w, 34);
  g.fillStyle = '#fff';
  g.font = '500 16px Manrope, sans-serif';
  g.fillText(bob.status === 'working' ? `● Bob is writing — ${bob.activity || ''}` : 'Idle', 16, h - 11);
  s.tex.needsUpdate = true;
}

// ====================================================================== planning room
export function buildPlanning(parent, room, y0, height) {
  const g = new THREE.Group();
  g.position.y = y0;
  parent.add(g);
  const { x0, x1 } = room;
  const cx = (x0 + x1) / 2;

  floorPlane(x1 - x0, 16, M.darkFloor, cx, 0.002, 0, g, 5);
  const ceil = plane(x1 - x0, 16, M.ceilingDark, cx, height - 0.01, 0, g);
  ceil.rotation.x = Math.PI / 2;

  // walnut slat walls: back + right (around the lift door)
  wallPlane(x1 - x0, height, M.walnutPanel, cx, 0, Zb - 0.05, 0, g, 3.2);
  const dz0 = LIFT.z - LIFT.w / 2 - 0.25;
  wallPlane(dz0 + 7.9, height, M.walnutPanel, x1 - 0.16, 0, (dz0 - 7.9) / 2, -Math.PI / 2, g, 3.2);
  const dz1 = LIFT.z + LIFT.w / 2 + 0.25;
  wallPlane(8 - dz1, height, M.walnutPanel, x1 - 0.16, 0, (8 + dz1) / 2, -Math.PI / 2, g, 3.2);
  // cove light along the ceiling edge
  const cove = fixtureMat(M.ledWarm, 1.8);
  box(x1 - x0, 0.04, 0.06, cove, cx, height - 0.32, Zb + 0.08, g, { cast: false });
  box(x1 - x0, 0.3, 0.3, M.ceilingDark, cx, height - 0.3, Zb + 0.15, g);

  // glass partition with walnut frame, door gap at the walkway
  windowWall({ parent: g, axis: 'z', from: Zb, to: LANE_GAP_START, at: x0 + 0.02, y0: 0, h: height - 0.02, mullion: 2.8, frameMat: M.walnut, glassMat: M.glass, transom: false });

  // screen wall
  const wall = screen(g, 9.0, 2.5, 6.6, 2.35, Zb + 0.1, 0, { px: 2048, frameMat: M.black, bezel: 0.12 });

  // long table with an inset map display
  const tz = -2.7, tx0 = 2.5, tx1 = 11.2, tw = tx1 - tx0, tcx = (tx0 + tx1) / 2;
  box(tw, 0.1, 2.2, M.walnut, tcx, 0.74, tz, g);
  box(tw - 1.2, 0.72, 1.0, M.walnut, tcx, 0.02, tz, g); // pedestal
  box(tw - 0.6, 0.02, 1.2, M.walnut, tcx, 0.0, tz, g);
  const mapTex = tableMapTexture();
  const inset = plane(tw - 2.2, 0.72, new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffffff', emissiveMap: mapTex, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.3 }), tcx, 0.845, tz, g);
  inset.rotation.x = -Math.PI / 2;
  inset.receiveShadow = false;
  // chairs along both sides
  const seatsBack = [], seatsFront = [];
  for (let i = 0; i < 5; i++) {
    const x = tx0 + 0.9 + i * ((tw - 1.8) / 4);
    seatsBack.push(confChair(g, x, tz - 1.45, 0));
    if (i !== 2) seatsFront.push(confChair(g, x, tz + 1.45, Math.PI));
    // speaker pucks + tablets
    cyl(0.12, 0.14, 0.04, M.charcoal, x, 0.84, tz - 0.75, g, 20);
    box(0.3, 0.012, 0.22, M.glossBlack, x + 0.25, 0.84, tz + 0.75, g, { cast: false });
  }
  // Scott's chair (front middle)
  const scottChair = confChair(g, tcx, tz + 1.45, Math.PI);

  // credenza + plants
  plant(g, 1.1, 0, -6.9, { scale: 1.5, pot: M.charcoal, leafMat: M.leafDark, seed: 5 });
  plant(g, 12.2, 0, -6.9, { scale: 1.5, pot: M.charcoal, leafMat: M.leafDark, seed: 6 });
  plaque(g, 'Planning Room', 12.82, 2.6, 1.5, -Math.PI / 2);

  const down = fixtureMat(M.warmLight, 2.2);
  for (let i = 0; i < 5; i++) {
    const x = tx0 + 0.9 + i * ((tw - 1.8) / 4);
    cyl(0.1, 0.1, 0.02, down, x, height - 0.03, tz, g, 20);
  }

  const lights = roomLights(g, [[4.5, 3.7, -2.5], [9.2, 3.7, -2.5], [6.5, 3.4, 3.5, 0.5]], { power: 18, fixtures: [down, cove] });

  const stations = {
    scott: { pos: new THREE.Vector3(tcx, y0, tz + 1.42), face: Math.PI, pose: 'sit', chair: scottChair },
    visit: { pos: new THREE.Vector3(tcx + 2.2, y0, tz + 2.3), face: Math.PI, pose: 'stand' },
  };

  function update(dt, t, state, daylight, active) {
    lights.set(active, daylight, dt);
    mapTex.offset.x = (t * 0.004) % 1;
    drawPlanWall(wall, state, t);
  }
  return { group: g, stations, update, screens: { wall } };
}

const LANE_GAP_START = 3.2;

function confChair(parent, x, z, rotY) {
  const c = new THREE.Group();
  c.position.set(x, 0, z);
  c.rotation.y = rotY;
  for (let i = 0; i < 5; i++) {
    const h = new THREE.Group();
    h.rotation.y = (i / 5) * Math.PI * 2;
    box(0.04, 0.035, 0.33, M.blackMetal, 0, 0.04, 0.16, h);
    c.add(h);
  }
  cyl(0.03, 0.03, 0.36, M.blackMetal, 0, 0.06, 0, c, 10);
  rbox(0.56, 0.1, 0.52, 0.04, M.fabricBeige, 0, 0.42, 0, c);
  const back = rbox(0.54, 0.72, 0.1, 0.05, M.fabricBeige, 0, 0.5, -0.26, c);
  back.rotation.x = -0.08;
  parent.add(c);
  return c;
}

function tableMapTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 256;
  const g = c.getContext('2d');
  const r = T.rng(17);
  g.fillStyle = '#05070a';
  g.fillRect(0, 0, 2048, 256);
  g.strokeStyle = 'rgba(120,150,190,.35)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    let x = r() * 2048, y = r() * 256;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 300; y += (r() - 0.5) * 120; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() < 0.2 ? '#ff9b4a' : '#ffe9c2';
    g.globalAlpha = 0.5 + r() * 0.5;
    g.beginPath(); g.arc(r() * 2048, r() * 256, 1 + r() * 2.5, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function drawPlanWall(s, state, t) {
  const p = state.planning || {};
  const sig = `${JSON.stringify(p).length}|${state.agents?.scott?.activity}|${state.session?.active}|${Math.floor(t / 2)}`;
  if (s.userData === sig) return;
  s.userData = sig;
  const g = s.ctx, w = s.w, h = s.h;
  g.fillStyle = '#0c0d10';
  g.fillRect(0, 0, w, h);
  const k = w / 2048;
  const pad = 30 * k;
  const colW = (w - pad * 4) / 3;
  const panel = (i, title, sub) => {
    const x = pad + i * (colW + pad);
    rr(g, x, pad, colW, h - pad * 2, 16 * k);
    g.fillStyle = '#14171c';
    g.fill();
    g.fillStyle = UI.gold;
    g.font = `600 ${16 * k}px Manrope, sans-serif`;
    if ('letterSpacing' in g) g.letterSpacing = '0.3em';
    g.fillText(sub, x + 26 * k, pad + 40 * k);
    if ('letterSpacing' in g) g.letterSpacing = '0em';
    g.fillStyle = UI.text;
    g.font = `500 ${40 * k}px "Cormorant Garamond", serif`;
    g.fillText(title, x + 26 * k, pad + 86 * k);
    return x + 26 * k;
  };

  // 1. shifts
  let x = panel(0, 'Shift Plan', 'TODAY');
  g.font = `500 ${21 * k}px Manrope, sans-serif`;
  (p.shifts || []).slice(0, 6).forEach((sh, i) => {
    const y = pad + 140 * k + i * 46 * k;
    g.fillStyle = UI.dim;
    g.fillText(sh.time, x, y);
    g.fillStyle = sh.done ? '#6f7b8a' : UI.text;
    g.fillText(`${sh.who} — ${sh.what}`.slice(0, 44), x + 90 * k, y);
    if (sh.now) {
      g.fillStyle = UI.gold;
      g.beginPath(); g.arc(x - 12 * k, y - 7 * k, 5 * k, 0, 7); g.fill();
    }
  });

  // 2. future of Agentium
  x = panel(1, 'The Future of Agentium', 'PLAN');
  (p.roadmap || []).slice(0, 6).forEach((r, i) => {
    const y = pad + 140 * k + i * 46 * k;
    g.fillStyle = r.status === 'done' ? UI.green : r.status === 'now' ? UI.gold : UI.dim;
    g.beginPath(); g.arc(x + 6 * k, y - 7 * k, 6 * k, 0, 7); g.fill();
    g.fillStyle = UI.dim;
    g.font = `600 ${17 * k}px Manrope, sans-serif`;
    g.fillText(r.when, x + 24 * k, y);
    g.fillStyle = UI.text;
    g.font = `500 ${21 * k}px Manrope, sans-serif`;
    g.fillText(r.title.slice(0, 40), x + 110 * k, y);
  });

  // 3. team now
  x = panel(2, 'Team Now', state.session?.active ? 'SESSION LIVE' : 'ON A BREAK');
  const ag = state.agents || {};
  ['scott', 'bob', 'tom'].forEach((id, i) => {
    const a = ag[id];
    if (!a) return;
    const y = pad + 140 * k + i * 92 * k;
    g.fillStyle = { scott: '#2c3e66', bob: '#6b4a32', tom: '#4a4f57' }[id];
    g.beginPath(); g.arc(x + 22 * k, y - 4 * k, 22 * k, 0, 7); g.fill();
    g.fillStyle = '#fff';
    g.font = `600 ${20 * k}px Manrope, sans-serif`;
    g.textAlign = 'center';
    g.fillText(a.name[0], x + 22 * k, y + 3 * k);
    g.textAlign = 'left';
    g.fillStyle = UI.text;
    g.fillText(`${a.name} · ${a.role}`, x + 60 * k, y - 8 * k);
    g.fillStyle = UI.dim;
    g.font = `500 ${18 * k}px Manrope, sans-serif`;
    wrapText(g, a.activity || '', x + 60 * k, y + 20 * k, colW - 100 * k, 22 * k, 2);
  });
  s.tex.needsUpdate = true;
}
