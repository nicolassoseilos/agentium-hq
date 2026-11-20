// The CEO's own hands, seen first-person: navy suit sleeves, white cuffs, a gold
// watch. They reach for things in the world, hold them (a glass stays upright, a
// decanter tilts to pour, a cigar points away) and put them down again.
import * as THREE from 'three';

const ease = (k) => k * k * (3 - 2 * k);
const UP = new THREE.Vector3(0, 1, 0);

const PRESET = {
  rest: { R: [0.34, -0.72, -0.25], L: [-0.34, -0.72, -0.25] },
  hold: { R: [0.16, -0.12, -0.42], L: [-0.16, -0.12, -0.42] },
  low: { R: [0.19, -0.17, -0.44], L: [-0.19, -0.17, -0.44] },
  mouth: { R: [0.045, -0.1, -0.25], L: [-0.045, -0.09, -0.24] },
  light: { R: [0.04, -0.11, -0.34], L: [-0.05, -0.04, -0.34] },
  tray: { L: [-0.06, -0.16, -0.5], R: [0.06, -0.16, -0.5] },
};

export class Hands {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.anims = [];
    const suit = new THREE.MeshStandardMaterial({ color: '#16203a', roughness: 0.65 });
    const cuff = new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.5 });
    const skin = new THREE.MeshStandardMaterial({ color: '#e9bf9a', roughness: 0.6 });
    const gold = new THREE.MeshStandardMaterial({ color: '#c9a15e', metalness: 1, roughness: 0.25 });
    const face = new THREE.MeshStandardMaterial({ color: '#10141c', metalness: 0.3, roughness: 0.2 });
    this.h = {};
    for (const side of ['R', 'L']) {
      const s = side === 'R' ? 1 : -1;
      const root = new THREE.Group();
      camera.add(root);
      // palm upright (like holding a glass), fingers forward (-z)
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.085, 0.09), skin);
      root.add(palm);
      const fingers = new THREE.Group();
      fingers.position.set(-s * 0.012, 0, -0.045);
      root.add(fingers);
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.019, 0.055), skin);
        f.position.set(-s * 0.018, 0.03 - i * 0.021, -0.015);
        f.rotation.y = s * 0.9; // curled round whatever it holds
        fingers.add(f);
      }
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.05), skin);
      thumb.position.set(-s * 0.03, 0.045, -0.035);
      thumb.rotation.set(0.3, s * 0.6, 0);
      root.add(thumb);
      const cuffM = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 16), cuff);
      cuffM.rotation.x = Math.PI / 2;
      cuffM.position.z = 0.06;
      root.add(cuffM);
      if (side === 'L') {
        const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.006, 20), gold);
        watch.rotation.z = Math.PI / 2;
        watch.position.set(0.02, 0.0, 0.05);
        root.add(watch);
        const dial = new THREE.Mesh(new THREE.CircleGeometry(0.014, 20), face);
        dial.rotation.y = Math.PI / 2;
        dial.position.set(0.0235, 0, 0.05);
        root.add(dial);
      }
      // the sleeve runs from the wrist back to an (off-screen) shoulder
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 1, 14), suit);
      camera.add(sleeve);
      const socket = new THREE.Group();
      socket.position.set(-s * 0.045, 0, -0.035);
      root.add(socket);
      root.traverse((o) => o.isMesh && (o.castShadow = false, o.renderOrder = 5));
      sleeve.renderOrder = 5;
      const hand = { side, root, sleeve, socket, item: null, itemOpts: null, pin: null, shoulder: new THREE.Vector3(s * 0.3, -0.5, 0.25), rot: new THREE.Euler() };
      root.position.fromArray(PRESET.rest[side]);
      hand.pin = { local: root.position.clone() };
      this.h[side] = hand;
    }
  }

  // ------------------------------------------------------------ helpers
  tween(dur, fn) {
    return new Promise((done) => this.anims.push({ t: 0, dur, fn, done }));
  }

  wait(sec) {
    return this.tween(sec, () => {});
  }

  local(target, side) {
    if (typeof target === 'string') return new THREE.Vector3().fromArray(PRESET[target][side]);
    if (target.world) {
      this.camera.updateMatrixWorld();
      return this.camera.worldToLocal(target.world.clone());
    }
    return target.local.clone();
  }

  /** Move a hand to a preset ('hold', 'mouth', …) or a world point, over `dur` seconds. */
  to(side, target, dur = 0.6) {
    const hand = this.h[side];
    const from = hand.root.position.clone();
    const spec = typeof target === 'string' ? target : target.isVector3 ? { world: target.clone() } : target;
    hand.pin = null;
    hand.moving = (hand.moving || 0) + 1;
    return this.tween(dur, (k) => {
      hand.root.position.lerpVectors(from, this.local(spec, side), ease(k));
    }).then(() => {
      hand.moving--;
      hand.pin = spec;
      hand.still = 0;
    });
  }

  /** Take an object: it follows the hand from now on. */
  grab(side, obj, opts = {}) {
    const hand = this.h[side];
    this.scene.attach(obj);
    hand.item = obj;
    hand.itemOpts = { yaw: 0, tiltX: 0, tiltZ: 0, drop: obj.userData.hold ?? 0, along: 0, ...opts };
  }

  /** Put the held object down at a world point (yaw in world radians, optional). */
  release(side, at, yaw = null) {
    const hand = this.h[side];
    const obj = hand.item;
    hand.item = null;
    if (!obj) return null;
    if (at) obj.position.copy(at);
    if (yaw !== null) obj.rotation.set(0, yaw, 0);
    else obj.rotation.set(0, obj.rotation.y, 0);
    return obj;
  }

  item(side) {
    return this.h[side].item;
  }

  set(side, opts) {
    Object.assign(this.h[side].itemOpts || {}, opts);
  }

  get busy() {
    return this.anims.length > 0;
  }

  camYaw() {
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    return Math.atan2(d.x, d.z);
  }

  // ------------------------------------------------------------ frame
  update(dt) {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t = Math.min(a.dur, a.t + dt);
      a.fn(a.t / a.dur);
      if (a.t >= a.dur) {
        this.anims.splice(i, 1);
        a.done();
      }
    }
    this.camera.updateMatrixWorld();
    const yaw = this.camYaw();
    // empty hands never stay put somewhere in the world: after putting something
    // down they come back, and they always rest when you are not seated/standing
    const away = this.rig && !['seated', 'standing', 'walking'].includes(this.rig.mode);
    for (const [side, hand] of Object.entries(this.h)) {
      if (hand.item || hand.moving) continue;
      const pinned = typeof hand.pin === 'object' && hand.pin && !hand.pin.preset;
      if (away && (pinned || hand.pin !== 'rest')) {
        hand.pin = 'rest';
        hand.root.position.fromArray(PRESET.rest[side]);
        continue;
      }
      if (pinned || (typeof hand.pin === 'string' && hand.pin !== 'rest')) {
        hand.still = (hand.still || 0) + dt;
        if (hand.still > 1.4 && !this.hold) this.to(side, 'rest', 0.5);
      }
    }
    const wp = new THREE.Vector3();
    for (const hand of Object.values(this.h)) {
      if (hand.pin && hand.pin.world) hand.root.position.copy(this.local(hand.pin, hand.side));
      const atRest = hand.root.position.y < -0.6 && !hand.item;
      hand.root.visible = hand.sleeve.visible = !atRest;
      // sleeve: from the wrist back to the shoulder
      const wrist = hand.root.position.clone().add(new THREE.Vector3(0, -0.005, 0.07));
      const dir = hand.shoulder.clone().sub(wrist);
      const len = dir.length();
      dir.normalize();
      hand.sleeve.scale.set(1, len, 1);
      hand.sleeve.position.copy(wrist).addScaledVector(dir, len / 2);
      hand.sleeve.quaternion.setFromUnitVectors(UP, dir);
      // the hand points the way the forearm points (a little)
      const yawH = Math.atan2(-dir.x, dir.z) * 0.4;
      hand.root.rotation.set(-dir.y * 0.4, yawH, 0);
      // held object: upright in the world, following the palm
      if (hand.item) {
        const o = hand.itemOpts;
        hand.root.updateMatrixWorld(true);
        hand.socket.getWorldPosition(wp);
        hand.item.rotation.set(o.tiltX, yaw + o.yaw, o.tiltZ, 'YXZ');
        hand.item.updateMatrixWorld();
        const off = new THREE.Vector3(0, -o.drop, -o.along).applyEuler(hand.item.rotation);
        hand.item.position.copy(wp).add(off);
      }
    }
  }
}
