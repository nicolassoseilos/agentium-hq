// The Agentium tower shell: podium, slabs, columns, facade glass, status glows,
// hover volumes and the glass lift.
import * as THREE from 'three';
import { M } from '../core/materials.js';
import { box, cyl, plane, windowWall, plant } from '../core/build.js';
import * as T from '../core/textures.js';
import { BASE, H, SLAB, X0, X1, Z0, Z1, LIFT, ROOMS, FLOORS, floorY, ceilY } from './layout.js';

const STATUS_COLORS = {
  working: new THREE.Color('#ffb860'),
  idle: new THREE.Color('#3a3530'),
  problem: new THREE.Color('#ff2a1f'),
};

export function buildTower(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // ---------------------------------------------------------------- podium
  box(X1 - X0 + 4, BASE, Z1 - Z0 + 4, M.marbleDark, 0, 0, 0, group);
  box(X1 - X0 + 4.4, 0.08, Z1 - Z0 + 4.4, M.brass, 0, BASE - 0.08, 0, group);
  // front steps
  for (let i = 0; i < 4; i++) box(10 - i * 0.6, BASE * ((i + 1) / 4), 0.45, M.stone, 0, 0, Z1 + 2 + 1.8 - i * 0.45, group);
  // gold AGENTIUM lettering on the podium face, left and right of the steps
  const signTex = T.textTexture('AGENTIUM', { w: 1024, h: 160, font: '500 118px "Cormorant Garamond", serif', spacing: 0.42 });
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, metalness: 1, roughness: 0.3, color: '#ffe2a8', emissive: '#c9a15e', emissiveMap: signTex, emissiveIntensity: 0.25 });
  for (const sx of [-10.2, 10.2]) {
    const s = plane(7.2, 1.12, signMat, sx, BASE / 2, Z1 + 2.03, group);
    s.receiveShadow = false;
  }
  // planters on the plaza
  for (const [x, z] of [[-17.5, 13], [17.5, 13], [-17.5, -11], [-6.5, 13.4], [6.5, 13.4]]) {
    box(1.6, 0.8, 1.6, M.marbleDark, x, 0, z, group);
    plant(group, x, 0.5, z, { scale: 2.2, pot: M.marbleDark, leafMat: M.leafDark, seed: (x * 13) | 0 });
  }

  // ---------------------------------------------------------------- slabs
  const slabEdgeMat = M.navySteel;
  for (let i = 0; i <= 3; i++) {
    const y = BASE + i * H;
    box(X1 - X0 + 0.4, SLAB, Z1 - Z0 + 0.4, M.charcoal, 0, y, 0, group);
    // front fascia band
    box(X1 - X0 + 0.44, SLAB + 0.04, 0.12, slabEdgeMat, 0, y - 0.02, Z1 + 0.2, group);
  }

  // corner columns
  for (const x of [X0, X1]) for (const z of [Z0, Z1]) box(0.5, 3 * H + SLAB, 0.5, M.navySteel, x, BASE, z, group);
  // mid columns on the facade
  for (const x of [-4.5, 4.5]) box(0.34, 3 * H, 0.34, M.navySteel, x, BASE, Z0 - 0.05, group);

  // ---------------------------------------------------------------- facade glass (sides)
  for (let f = 1; f <= 2; f++) {
    const y0 = floorY(f), h = ceilY(f) - y0;
    windowWall({ parent: group, axis: 'z', from: Z0 + 0.25, to: Z1 - 0.25, at: X0 - 0.02, y0, h, mullion: 2.6, frameMat: M.navySteel, glassMat: M.glassFacade });
    // right side: glass up to the lift door opening
    windowWall({ parent: group, axis: 'z', from: Z0 + 0.25, to: LIFT.z - LIFT.w / 2 - 0.3, at: X1 + 0.02, y0, h, mullion: 2.6, frameMat: M.navySteel, glassMat: M.glassFacade });
    box(0.2, h, Z1 - (LIFT.z + LIFT.w / 2 + 0.3), M.navySteel, X1 + 0.02, y0, (Z1 + LIFT.z + LIFT.w / 2 + 0.3) / 2, group);
  }
  // lab level: solid dark side walls (basement)
  {
    const y0 = floorY(0), h = ceilY(0) - y0;
    box(0.3, h, Z1 - Z0, M.marbleDark, X0 - 0.1, y0, 0, group);
    box(0.3, h, LIFT.z - LIFT.w / 2 - Z0 - 0.3, M.marbleDark, X1 + 0.1, y0, (Z0 + LIFT.z - LIFT.w / 2 - 0.3) / 2, group);
    box(0.3, h, Z1 - (LIFT.z + LIFT.w / 2 + 0.3), M.marbleDark, X1 + 0.1, y0, (Z1 + LIFT.z + LIFT.w / 2 + 0.3) / 2, group);
  }
  // lift door frames on every floor
  for (let f = 0; f <= 3; f++) {
    const y0 = floorY(f);
    const fh = 2.7;
    box(0.3, 0.16, LIFT.w + 0.4, M.brass, X1 + 0.05, y0 + fh, LIFT.z, group);
    box(0.3, fh, 0.14, M.brass, X1 + 0.05, y0, LIFT.z - LIFT.w / 2 - 0.13, group);
    box(0.3, fh, 0.14, M.brass, X1 + 0.05, y0, LIFT.z + LIFT.w / 2 + 0.13, group);
    if (f < 3) box(0.3, ceilY(f) - y0 - fh - 0.16, LIFT.w + 0.4, M.navySteel, X1 + 0.05, y0 + fh + 0.16, LIFT.z, group);
  }

  // ---------------------------------------------------------------- status glow, veils, hover volumes
  const rooms = {};
  for (const room of Object.values(ROOMS)) {
    const y0 = floorY(room.floor);
    const y1 = room.floor === 3 ? y0 + 3.4 : ceilY(room.floor);
    const w = room.x1 - room.x0;
    const cx = (room.x0 + room.x1) / 2;

    // LED strip on the slab fascia under the room
    const stripMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: STATUS_COLORS.idle.clone(), emissiveIntensity: 1.5, toneMapped: true });
    box(w - 0.3, 0.05, 0.03, stripMat, cx, y0 - 0.17, Z1 + 0.28, group, { cast: false });

    // front veil (dims empty rooms, tints problem rooms) — only shown in tower view
    const veilMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, depthWrite: false });
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, y1 - y0 - 0.02), veilMat);
    veil.position.set(cx, (y0 + y1) / 2, Z1 + 0.05);
    veil.renderOrder = 5;
    group.add(veil);

    // invisible hover/click volume
    const pick = new THREE.Mesh(new THREE.BoxGeometry(w, y1 - y0, Z1 - Z0), new THREE.MeshBasicMaterial());
    pick.position.set(cx, (y0 + y1) / 2, 0);
    pick.visible = false;
    pick.userData.roomId = room.id;
    group.add(pick);

    rooms[room.id] = { stripMat, veilMat, veil, pick, status: 'idle', level: 0, alarmPos: new THREE.Vector3(cx, y0 + 2.4, Z1 - 1.5) };
  }

  // one red wash light, moved to whichever room has a problem
  const alarm = new THREE.PointLight('#ff2a1f', 0, 16, 1.6);
  group.add(alarm);

  // ---------------------------------------------------------------- lift
  const lift = new Lift(group);

  // ---------------------------------------------------------------- api
  let towerView = true;
  function setTowerView(v) {
    towerView = v;
  }

  function setRoomStatus(id, status) {
    if (rooms[id]) rooms[id].status = status;
  }

  function update(dt, t, daylight) {
    alarm.intensity = 0;
    for (const [id, r] of Object.entries(rooms)) {
      const target = r.status === 'working' ? 1 : r.status === 'problem' ? 1 : 0;
      r.level += (target - r.level) * Math.min(1, dt * 2.5);
      const pulse = 0.55 + 0.45 * Math.sin(t * 4.2);
      if (r.status === 'problem') {
        r.stripMat.emissive.copy(STATUS_COLORS.problem);
        r.stripMat.emissiveIntensity = 2.2 + pulse * 2.5;
        r.veilMat.color.set('#ff1a10');
        r.veilMat.opacity = towerView ? 0.02 + pulse * 0.05 : 0;
        alarm.position.copy(r.alarmPos);
        alarm.intensity = (towerView ? 16 : 6) * (0.5 + pulse * 0.5);
      } else {
        r.stripMat.emissive.copy(STATUS_COLORS.idle).lerp(STATUS_COLORS.working, r.level);
        r.stripMat.emissiveIntensity = 0.6 + r.level * 2.4;
        r.veilMat.color.set('#05070b');
        const dim = id === 'rooftop' ? 0.16 : 0.42 - daylight * 0.12;
        r.veilMat.opacity = towerView ? (1 - r.level) * dim : 0;
      }
      r.veil.visible = r.veilMat.opacity > 0.005;
    }
    lift.update(dt);
  }

  return { group, rooms, lift, setRoomStatus, setTowerView, update, pickables: Object.values(rooms).map((r) => r.pick) };
}

// ------------------------------------------------------------------ lift
export class Lift {
  constructor(parent) {
    const g = new THREE.Group();
    parent.add(g);
    const top = floorY(3) + 3.6;
    const half = LIFT.w / 2 + 0.25;
    const x = LIFT.x, z = LIFT.z;

    // shaft: brass posts + glass
    for (const dx of [-half, half]) for (const dz of [-half, half]) box(0.12, top - BASE, 0.12, M.brass, x + dx, BASE, z + dz, g);
    for (let f = 0; f <= 3; f++) {
      const y = floorY(f) - SLAB;
      for (const [dx, dz, w, d] of [[0, -half, half * 2, 0.1], [0, half, half * 2, 0.1], [half, 0, 0.1, half * 2]]) box(w, SLAB, d, M.navySteel, x + dx, y, z + dz, g);
    }
    box(half * 2 + 0.2, 0.2, half * 2 + 0.2, M.navySteel, x, top, z, g);
    const gl = (w, h, px, py, pz, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glassTint);
      m.position.set(px, py, pz);
      m.rotation.y = ry;
      m.renderOrder = 3;
      g.add(m);
    };
    gl(half * 2, top - BASE, x, (top + BASE) / 2, z + half, 0);
    gl(half * 2, top - BASE, x, (top + BASE) / 2, z - half, 0);
    gl(half * 2, top - BASE, x + half, (top + BASE) / 2, z, Math.PI / 2);

    // cab
    this.cab = new THREE.Group();
    const cab = this.cab;
    const cw = LIFT.w - 0.15;
    box(cw, 0.1, cw, M.brass, 0, -0.1, 0, cab);
    box(cw - 0.1, 0.02, cw - 0.1, M.marbleDark, 0, 0, 0, cab, { cast: false });
    box(cw, 0.12, cw, M.navySteel, 0, 2.75, 0, cab);
    const lamp = box(cw - 0.5, 0.03, cw - 0.5, M.warmLight, 0, 2.72, 0, cab, { cast: false });
    lamp.receiveShadow = false;
    for (const dx of [-cw / 2, cw / 2]) for (const dz of [-cw / 2, cw / 2]) box(0.06, 2.75, 0.06, M.brass, dx, 0, dz, cab);
    const cabGlass = (w, px, pz, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.7), M.glass);
      m.position.set(px, 1.37, pz);
      m.rotation.y = ry;
      cab.add(m);
    };
    cabGlass(cw, 0, cw / 2, 0);
    cabGlass(cw, 0, -cw / 2, 0);
    cabGlass(cw, cw / 2, 0, Math.PI / 2);
    box(0.04, 0.05, cw * 0.6, M.brass, cw / 2 - 0.04, 1.0, 0, cab); // handrail
    // sliding doors (face the building, -x)
    this.doors = [];
    for (const s of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(cw / 2, 2.7), M.glassTint);
      d.rotation.y = Math.PI / 2;
      d.position.set(-cw / 2 - 0.02, 1.37, (s * cw) / 4);
      d.userData.side = s;
      cab.add(d);
      this.doors.push(d);
    }
    this.light = new THREE.PointLight('#ffd9a0', 4, 5, 2);
    this.light.position.set(0, 2.4, 0);
    cab.add(this.light);

    cab.position.set(x, floorY(3), z);
    g.add(cab);

    this.y = floorY(3);
    this.queue = [];
    this.job = null;
    this.phase = 'idle';
    this.doorOpen = 0;
    this.speed = 0;
  }

  /** An agent asks to ride from one floor to another. */
  request(agent, from, to) {
    if (this.queue.some((j) => j.agent === agent) || this.job?.agent === agent) return;
    this.queue.push({ agent, from, to, boarded: false, done: false });
  }

  isReadyFor(agent, floor) {
    return this.job && this.job.agent === agent && this.phase === 'boarding' && this.job.from === floor;
  }

  hasArrivedFor(agent) {
    return this.job && this.job.agent === agent && this.phase === 'alighting';
  }

  board(agent) {
    if (this.job?.agent === agent) this.job.boarded = true;
  }

  alight(agent) {
    if (this.job?.agent === agent) this.job.done = true;
  }

  get position() {
    return this.cab.position;
  }

  update(dt) {
    if (!this.job && this.queue.length) {
      this.job = this.queue.shift();
      this.phase = 'fetch';
    }
    let target = this.y;
    let wantOpen = false;
    if (this.job) {
      if (this.phase === 'fetch') target = floorY(this.job.from);
      if (this.phase === 'travel') target = floorY(this.job.to);
      if (this.phase === 'boarding' || this.phase === 'alighting') wantOpen = true;
    }
    // doors
    const doorTarget = wantOpen ? 1 : 0;
    this.doorOpen += Math.sign(doorTarget - this.doorOpen) * Math.min(Math.abs(doorTarget - this.doorOpen), dt * 1.6);
    const cw = LIFT.w - 0.15;
    for (const d of this.doors) d.position.z = d.userData.side * (cw / 4 + (this.doorOpen * cw) / 4.2);

    const doorsShut = this.doorOpen < 0.02;
    const dist = target - this.y;
    if (Math.abs(dist) > 0.002 && doorsShut) {
      const maxV = Math.min(2.6, Math.sqrt(Math.abs(dist) * 2 * 1.4) + 0.05);
      this.speed = Math.min(maxV, this.speed + dt * 1.4);
      const step = Math.sign(dist) * Math.min(Math.abs(dist), this.speed * dt);
      this.y += step;
    } else {
      this.speed = 0;
      if (this.job) {
        if (this.phase === 'fetch' && Math.abs(dist) <= 0.002) this.phase = 'boarding';
        else if (this.phase === 'boarding' && this.job.boarded && doorsShut === false && this.doorOpen > 0.98) this.phase = 'closing';
        else if (this.phase === 'closing') this.phase = 'travel';
        else if (this.phase === 'travel' && Math.abs(dist) <= 0.002) this.phase = 'alighting';
        else if (this.phase === 'alighting' && this.job.done) {
          this.job = null;
          this.phase = 'idle';
        }
      }
    }
    this.cab.position.y = this.y;
  }
}

export { STATUS_COLORS, FLOORS };
