// The Agentium tower shell: podium, slabs, columns, facade glass, status glows,
// and hover volumes. The lift lives in lift.js.
import * as THREE from 'three';
import { M } from '../core/materials.js';
import { box, cyl, plane, windowWall, plant } from '../core/build.js';
import * as T from '../core/textures.js';
import { BASE, H, SLAB, X0, X1, Z0, Z1, LIFT, ROOMS, FLOORS, POOL_CUT, floorY, ceilY } from './layout.js';

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
    if (i < 3) box(X1 - X0 + 0.4, SLAB, Z1 - Z0 + 0.4, M.charcoal, 0, y, 0, group);
    else {
      // roof slab with an opening for the sunken pool
      const { x0, x1, z0, z1 } = POOL_CUT;
      box(x0 - (X0 - 0.2), SLAB, Z1 - Z0 + 0.4, M.charcoal, (X0 - 0.2 + x0) / 2, y, 0, group);
      box(X1 + 0.2 - x1, SLAB, Z1 - Z0 + 0.4, M.charcoal, (x1 + X1 + 0.2) / 2, y, 0, group);
      box(x1 - x0, SLAB, Z1 + 0.2 - z1, M.charcoal, 0, y, (z1 + Z1 + 0.2) / 2, group);
      box(x1 - x0, SLAB, z0 - (Z0 - 0.2), M.charcoal, 0, y, (Z0 - 0.2 + z0) / 2, group);
    }
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

  // ceiling bulkhead in the top floor that houses the sunken rooftop pool
  box(POOL_CUT.x1 - POOL_CUT.x0 + 0.2, 1.0, POOL_CUT.z1 - POOL_CUT.z0 + 0.2, M.ceilingDark, (POOL_CUT.x0 + POOL_CUT.x1) / 2, ceilY(2) - 1.0, (POOL_CUT.z0 + POOL_CUT.z1) / 2, group);

  // front glass (hidden in the cutaway view, shown when you are inside a room)
  const frontGlass = new THREE.Group();
  for (let f = 0; f <= 2; f++) {
    const y0 = floorY(f), h = ceilY(f) - y0;
    windowWall({ parent: frontGlass, axis: 'x', from: X0 + 0.25, to: X1 - 0.25, at: Z1 - 0.02, y0, h, mullion: 2.6, frameMat: M.navySteel, glassMat: M.glassFacade });
  }
  frontGlass.visible = false;
  group.add(frontGlass);

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

  // ---------------------------------------------------------------- api
  let towerView = true;
  function setTowerView(v) {
    towerView = v;
    frontGlass.visible = !v;
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
  }

  return { group, rooms, setRoomStatus, setTowerView, update, pickables: Object.values(rooms).map((r) => r.pick) };
}

export { STATUS_COLORS, FLOORS };
