// Camera: the big cutaway view, drone-style flights into rooms and back,
// and gentle look-around while inside a room.
import * as THREE from 'three';
import { ROOMS, floorY } from './layout.js';

const TOWER_TARGET = new THREE.Vector3(1.4, 9.6, 0);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.mode = 'tower';
    this.room = null;
    this.yaw = 0.62;
    this.pitch = 0.17;
    this.zoom = 1.28;
    this.look = { yaw: 0, pitch: 0 };
    this.flight = null;
    this.target = TOWER_TARGET.clone();
    this.listeners = new Set();
    this.drag = null;
    this.idle = 0;
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
    // phones in portrait: step back a little so the room fits
    if (this.camera.aspect < 0.8) {
      const dir = pos.clone().sub(look).setY(0).normalize();
      pos.addScaledVector(dir, 2.2);
      pos.y += 0.4;
    }
    return { pos, look, fov: this.camera.aspect < 0.8 ? 62 : 50 };
  }

  flyToRoom(id) {
    if (this.flight) return;
    const to = this.roomPose(id);
    const from = { pos: this.camera.position.clone(), look: this.target.clone(), fov: this.camera.fov };
    const r = ROOMS[id];
    const y = floorY(r.floor);
    let pts;
    if (this.mode === 'room' && this.room && ROOMS[this.room].floor === r.floor) {
      // slide across the same floor, just outside the open front
      pts = [from.pos, new THREE.Vector3((from.pos.x + to.pos.x) / 2, y + 2.8, 11.5), to.pos];
    } else if (this.mode === 'room') {
      // out, up/down the facade, and back in
      pts = [from.pos, new THREE.Vector3(from.pos.x, from.pos.y + 0.3, 17), new THREE.Vector3(to.pos.x, to.pos.y + 0.6, 17), to.pos];
    } else {
      const cx = (r.x0 + r.x1) / 2;
      pts = [from.pos, new THREE.Vector3(cx + 6, y + 6, 28), new THREE.Vector3(to.pos.x + 0.6, to.pos.y + 0.9, 13), to.pos];
    }
    this.startFlight(pts, from, to, 2.8, () => {
      this.mode = 'room';
      this.room = id;
      this.look = { yaw: 0, pitch: 0 };
      this.baseLook = to.look.clone();
      this.emit();
    });
    this.mode = 'flying';
    this.room = id;
    this.emit();
  }

  /** Instant cut into a room (used by ?view= previews). */
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
    const from = { pos: this.camera.position.clone(), look: this.target.clone(), fov: this.camera.fov };
    const to = { pos: this.towerPosition(), look: TOWER_TARGET.clone(), fov: 32 };
    const pts = [from.pos, new THREE.Vector3(from.pos.x, from.pos.y + 0.5, 15), new THREE.Vector3((from.pos.x + to.pos.x) / 2, (from.pos.y + to.pos.y) / 2 + 2, (15 + to.pos.z) / 2), to.pos];
    this.mode = 'flying';
    this.room = null;
    this.emit();
    this.startFlight(pts, from, to, 2.6, () => {
      this.mode = 'tower';
      this.emit();
    });
  }

  startFlight(points, from, to, duration, done) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.flight = { curve, from, to, t: 0, duration, done };
  }

  bindInput() {
    const el = this.dom;
    el.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, moved: 0 };
      this.idle = 0;
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.drag || this.flight) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.drag.moved > 6) document.body.classList.add('dragging');
      if (this.mode === 'tower') {
        this.yaw = THREE.MathUtils.clamp(this.yaw - dx * 0.004, -0.35, 1.25);
        this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.003, 0.02, 0.62);
      } else if (this.mode === 'room') {
        this.look.yaw = THREE.MathUtils.clamp(this.look.yaw - dx * 0.0035, -0.75, 0.75);
        this.look.pitch = THREE.MathUtils.clamp(this.look.pitch + dy * 0.0025, -0.3, 0.3);
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

  /** True if the last pointer gesture was a drag (so clicks can be ignored). */
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
      // look target leads a little, then settles on the destination
      const lk = ease(Math.min(1, f.t * 1.15));
      this.target.lerpVectors(f.from.look, f.to.look, lk);
      cam.fov = THREE.MathUtils.lerp(f.from.fov, f.to.fov, k);
      cam.updateProjectionMatrix();
      cam.lookAt(this.target);
      if (f.t >= 1) {
        this.flight = null;
        f.done();
      }
      return;
    }
    if (this.mode === 'tower') {
      this.idle += dt;
      const p = this.towerPosition();
      cam.position.lerp(p, Math.min(1, dt * 6));
      this.target.lerp(TOWER_TARGET, Math.min(1, dt * 6));
      if (Math.abs(cam.fov - 32) > 0.01) {
        cam.fov += (32 - cam.fov) * Math.min(1, dt * 4);
        cam.updateProjectionMatrix();
      }
      cam.lookAt(this.target);
    } else if (this.mode === 'room') {
      const pose = this.roomPose(this.room);
      cam.position.lerp(pose.pos, Math.min(1, dt * 4));
      // rotate the look direction around the camera
      const dir = pose.look.clone().sub(pose.pos);
      const len = dir.length();
      dir.normalize();
      const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.look.yaw);
      dir.applyQuaternion(yawQ);
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      dir.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(right, -this.look.pitch));
      const want = cam.position.clone().addScaledVector(dir, len);
      this.target.lerp(want, Math.min(1, dt * 8));
      if (Math.abs(cam.fov - pose.fov) > 0.01) {
        cam.fov += (pose.fov - cam.fov) * Math.min(1, dt * 4);
        cam.updateProjectionMatrix();
      }
      cam.lookAt(this.target);
    }
  }
}
