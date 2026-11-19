// Camera: the big cutaway view (turn a full 360°), drone-style flights into
// rooms and back, 360° look-around inside rooms, first-person when you sit
// down somewhere, and close-ups of screens.
import * as THREE from 'three';
import { ROOMS, floorY } from './layout.js';

const TOWER_TARGET = new THREE.Vector3(1.4, 9.6, 0);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const UP = new THREE.Vector3(0, 1, 0);

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.mode = 'tower'; // tower | room | seated | inspect | flying
    this.room = null;
    this.seat = null;
    this.inspecting = null;
    this.yaw = 0.62;
    this.pitch = 0.17;
    this.zoom = 1.28;
    this.look = { yaw: 0, pitch: 0 };
    this.flight = null;
    this.target = TOWER_TARGET.clone();
    this.listeners = new Set();
    this.drag = null;
    this.bindInput();
    this.camera.position.copy(this.towerPosition());
    this.camera.lookAt(this.target);
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.mode, this.room);
  }

  /** The room you are in (also while seated or looking at a screen). */
  get presentRoom() {
    return this.mode === 'room' || this.mode === 'seated' || this.mode === 'inspect' ? this.room : null;
  }

  towerDistance() {
    const vfov = THREE.MathUtils.degToRad(32);
    const dv = 12.6 / Math.tan(vfov / 2);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const dh = (this.camera.aspect < 0.8 ? 15.5 : 19.5) / Math.tan(hfov / 2);
    return Math.max(dv, dh) * this.zoom;
  }

  towerPosition(out = new THREE.Vector3()) {
    const d = this.towerDistance();
    return out.set(
      TOWER_TARGET.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d,
      TOWER_TARGET.y + Math.sin(this.pitch) * d,
      TOWER_TARGET.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d,
    );
  }

  roomPose(id) {
    const r = ROOMS[id];
    const y = floorY(r.floor);
    const pos = new THREE.Vector3(r.view.pos[0], y + r.view.pos[1], r.view.pos[2]);
    const look = new THREE.Vector3(r.view.look[0], y + r.view.look[1], r.view.look[2]);
    if (this.camera.aspect < 0.8) {
      const dir = pos.clone().sub(look).setY(0).normalize();
      pos.addScaledVector(dir, 2.2);
      pos.y += 0.4;
    }
    return { pos, look, fov: this.camera.aspect < 0.8 ? 62 : 50 };
  }

  seatPose(seat) {
    const pos = seat.eyePos.clone();
    const dir = new THREE.Vector3(Math.sin(seat.face), 0, Math.cos(seat.face));
    const look = pos.clone().addScaledVector(dir, 3);
    look.y = pos.y + (seat.lookDown ?? -0.35);
    return { pos, look, fov: this.camera.aspect < 0.8 ? 70 : 60 };
  }

  inspectPose(item) {
    const center = new THREE.Vector3();
    item.mesh.getWorldPosition(center);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(item.mesh.getWorldQuaternion(new THREE.Quaternion()));
    const fov = 40;
    const vf = THREE.MathUtils.degToRad(fov) / 2;
    const hf = Math.atan(Math.tan(vf) * this.camera.aspect);
    const dist = Math.max((item.h * 0.62) / Math.tan(vf), (item.w * 0.58) / Math.tan(hf));
    return { pos: center.clone().addScaledVector(normal, dist), look: center, fov };
  }

  // ------------------------------------------------------------ moves
  flyToRoom(id) {
    if (this.flight) return;
    const to = this.roomPose(id);
    const from = this.current();
    const r = ROOMS[id];
    const y = floorY(r.floor);
    let pts;
    const sameRoom = this.room === id && this.mode !== 'tower';
    if (sameRoom) pts = [from.pos, from.pos.clone().lerp(to.pos, 0.5).add(new THREE.Vector3(0, 0.3, 0)), to.pos];
    else if (this.mode !== 'tower' && this.room && ROOMS[this.room].floor === r.floor) pts = [from.pos, new THREE.Vector3((from.pos.x + to.pos.x) / 2, y + 2.8, 11.5), to.pos];
    else if (this.mode !== 'tower') pts = [from.pos, new THREE.Vector3(from.pos.x, from.pos.y + 0.3, 17), new THREE.Vector3(to.pos.x, to.pos.y + 0.6, 17), to.pos];
    else {
      const cx = (r.x0 + r.x1) / 2;
      pts = [from.pos, new THREE.Vector3(cx + 6, y + 6, 28), new THREE.Vector3(to.pos.x + 0.6, to.pos.y + 0.9, 13), to.pos];
    }
    this.leaveSeat();
    this.startFlight(pts, from, to, sameRoom ? 1.4 : 2.8, () => {
      this.mode = 'room';
      this.look = { yaw: 0, pitch: 0 };
      this.emit();
    });
    this.mode = 'flying';
    this.room = id;
    this.emit();
  }

  /** Sit down somewhere: first-person from that seat. */
  sitAt(seat) {
    if (this.flight) return;
    const to = this.seatPose(seat);
    const from = this.current();
    const mid = from.pos.clone().lerp(to.pos, 0.5);
    mid.y = Math.max(from.pos.y, to.pos.y) + 0.4;
    this.leaveSeat();
    this.seat = seat;
    this.room = seat.room;
    this.mode = 'flying';
    this.emit();
    this.startFlight([from.pos, mid, to.pos], from, to, 1.6, () => {
      this.mode = 'seated';
      this.look = { yaw: 0, pitch: 0 };
      this.emit();
    });
  }

  leaveSeat() {
    if (this.seat) {
      const s = this.seat;
      this.seat = null;
      s.onLeave?.();
    }
    this.inspecting = null;
  }

  standUp() {
    if (!this.room) return;
    this.flyToRoom(this.room);
  }

  inspect(item) {
    if (this.flight) return;
    const to = this.inspectPose(item);
    const from = this.current();
    this.leaveSeat();
    this.inspecting = item;
    this.room = item.room;
    this.mode = 'flying';
    this.emit();
    this.startFlight([from.pos, from.pos.clone().lerp(to.pos, 0.5), to.pos], from, to, 1.3, () => {
      this.mode = 'inspect';
      this.look = { yaw: 0, pitch: 0 };
      this.emit();
    });
  }

  jumpToRoom(id) {
    const to = this.roomPose(id);
    this.mode = 'room';
    this.room = id;
    this.look = { yaw: 0, pitch: 0 };
    this.camera.position.copy(to.pos);
    this.target.copy(to.look);
    this.camera.fov = to.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.target);
    this.emit();
  }

  flyToTower() {
    if (this.flight || this.mode === 'tower') return;
    const from = this.current();
    const to = { pos: this.towerPosition(), look: TOWER_TARGET.clone(), fov: 32 };
    const pts = [from.pos, new THREE.Vector3(from.pos.x, from.pos.y + 0.5, 15), new THREE.Vector3((from.pos.x + to.pos.x) / 2, (from.pos.y + to.pos.y) / 2 + 2, (15 + to.pos.z) / 2), to.pos];
    this.leaveSeat();
    this.mode = 'flying';
    this.room = null;
    this.emit();
    this.startFlight(pts, from, to, 2.6, () => {
      this.mode = 'tower';
      this.emit();
    });
  }

  /** Back one level: screen → room, seat → room, room → tower. */
  back() {
    if (this.mode === 'inspect' || this.mode === 'seated') this.flyToRoom(this.room);
    else if (this.mode === 'room') this.flyToTower();
  }

  current() {
    return { pos: this.camera.position.clone(), look: this.target.clone(), fov: this.camera.fov };
  }

  startFlight(points, from, to, duration, done) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.flight = { curve, from, to, t: 0, duration, done };
  }

  bindInput() {
    const el = this.dom;
    el.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, moved: 0 };
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.drag || this.flight) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.drag.moved > 6) document.body.classList.add('dragging');
      if (this.mode === 'tower') {
        this.yaw -= dx * 0.005; // full 360°
        this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.003, 0.02, 0.75);
      } else if (this.mode === 'room' || this.mode === 'seated') {
        this.look.yaw += dx * 0.004; // full 360°
        this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - dy * 0.003, -0.6, 0.6);
      } else if (this.mode === 'inspect') {
        this.look.yaw = THREE.MathUtils.clamp(this.look.yaw + dx * 0.002, -0.3, 0.3);
        this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - dy * 0.002, -0.2, 0.2);
      }
    });
    window.addEventListener('pointerup', () => {
      setTimeout(() => (this.drag = null), 0);
      document.body.classList.remove('dragging');
    });
    el.addEventListener('wheel', (e) => {
      if (this.mode !== 'tower') return;
      e.preventDefault();
      this.zoom = THREE.MathUtils.clamp(this.zoom * (1 + Math.sign(e.deltaY) * 0.06), 0.7, 1.6);
    }, { passive: false });
  }

  wasDrag() {
    return this.drag && this.drag.moved > 6;
  }

  update(dt) {
    const cam = this.camera;
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.duration);
      const k = ease(f.t);
      cam.position.copy(f.curve.getPoint(k));
      this.target.lerpVectors(f.from.look, f.to.look, ease(Math.min(1, f.t * 1.15)));
      cam.fov = THREE.MathUtils.lerp(f.from.fov, f.to.fov, k);
      cam.updateProjectionMatrix();
      cam.lookAt(this.target);
      if (f.t >= 1) {
        this.flight = null;
        f.done();
      }
      return;
    }
    let pose = null;
    if (this.mode === 'tower') {
      cam.position.lerp(this.towerPosition(), Math.min(1, dt * 6));
      this.target.lerp(TOWER_TARGET, Math.min(1, dt * 6));
      this.settleFov(32, dt);
      cam.lookAt(this.target);
      return;
    }
    if (this.mode === 'room') pose = this.roomPose(this.room);
    else if (this.mode === 'seated' && this.seat) pose = this.seatPose(this.seat);
    else if (this.mode === 'inspect' && this.inspecting) pose = this.inspectPose(this.inspecting);
    if (!pose) return;
    cam.position.lerp(pose.pos, Math.min(1, dt * 4));
    // turn the look direction around the camera (360° in rooms and seats)
    const dir = pose.look.clone().sub(pose.pos);
    const len = dir.length();
    dir.normalize();
    dir.applyAxisAngle(UP, -this.look.yaw);
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
    dir.applyAxisAngle(right, this.look.pitch);
    const want = cam.position.clone().addScaledVector(dir, len);
    this.target.lerp(want, Math.min(1, dt * 10));
    this.settleFov(pose.fov, dt);
    cam.lookAt(this.target);
  }

  settleFov(fov, dt) {
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4);
      this.camera.updateProjectionMatrix();
    }
  }
}
