// Drinks and cigars resting on a table or the bar in front of someone (the CEO
// or an agent). Every so often they pick the glass up, take a sip and put it
// back; a glass is finished after about ten sips. A lit cigar rests in a shared
// ashtray, smoulders (a thin wisp), and now and then they take it, draw on it
// (the tip glows), blow out the smoke and put it back; it burns down puff by puff.
import * as THREE from 'three';
import { restPose } from './smoking.js';

const ease = (k) => k * k * (3 - 2 * k);
const rand = (a, b) => a + Math.random() * (b - a);
const SIPS = 10;
const PUFFS = 14;

export class Leisure {
  constructor({ scene, smoke, hands, rig }) {
    this.scene = scene;
    this.smoke = smoke;
    this.hands = hands;
    this.rig = rig;
    this.drinks = new Map(); // owner ('ceo' or a Person) -> { glass, at, spot, nextAt, busy }
    this.cigars = new Map(); // owner -> { cigar, tray, rest, nextAt, busy, puffs }
    this.anims = [];
    this.t = 0;
    this.ceoBusy = () => false; // the office sets this while you are doing something with your hands
  }

  tween(dur, fn) {
    return new Promise((done) => this.anims.push({ t: 0, dur, fn, done }));
  }

  // ------------------------------------------------------------ placing things
  placeDrink(owner, glass, at, spot = null) {
    this.removeDrink(owner, false);
    if (glass.parent !== this.scene) this.scene.attach(glass);
    glass.position.copy(at);
    glass.rotation.set(0, glass.rotation.y, 0);
    glass.userData.owner = owner;
    this.drinks.set(owner, { glass, at: at.clone(), spot, nextAt: this.t + rand(6, 14), busy: false });
  }

  drinkOf(owner) {
    return this.drinks.get(owner)?.glass || null;
  }

  /** Take the glass off the table (to refill it, or when leaving). */
  takeDrink(owner) {
    const d = this.drinks.get(owner);
    if (!d || d.busy) return null;
    this.drinks.delete(owner);
    return d.glass;
  }

  removeDrink(owner, dispose = true) {
    const d = this.drinks.get(owner);
    if (!d) return;
    this.drinks.delete(owner);
    if (dispose) d.glass.removeFromParent();
  }

  placeCigar(owner, cigar, tray, rest, spot = null) {
    this.removeCigar(owner, false);
    rest.taken = owner;
    this.seat(cigar, tray, rest);
    this.cigars.set(owner, { cigar, tray, rest, nextAt: this.t + rand(5, 12), busy: false, puffs: Math.round((1 - cigar.userData.state.length) * PUFFS), wisp: 0, spot });
  }

  cigarOf(owner) {
    return this.cigars.get(owner)?.cigar || null;
  }

  removeCigar(owner, dispose = true) {
    const c = this.cigars.get(owner);
    if (!c) return;
    this.cigars.delete(owner);
    if (c.rest.taken === owner) c.rest.taken = null;
    if (dispose) c.cigar.removeFromParent();
  }

  /** A free rest on this ashtray, or null. */
  freeRest(tray) {
    return tray.userData.rests.find((r) => !r.taken) || null;
  }

  seat(cigar, tray, rest) {
    const p = restPose(tray, rest);
    if (cigar.parent !== this.scene) this.scene.attach(cigar);
    // the cigar rests across the notch: cap outside, foot over the bowl
    const dir = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    cigar.position.copy(p.pos).addScaledVector(dir, -0.06);
    cigar.rotation.set(-0.08, p.yaw, 0, 'YXZ');
  }

  // ------------------------------------------------------------ sipping & puffing
  /** An agent at a table: reach for the glass, lift it to the lips, sip, put it back. */
  async sipPerson(p, d) {
    d.busy = true;
    p.tableSip = true;
    const g = d.glass;
    const grip = () => d.at.clone().add(new THREE.Vector3(0, g.userData.hold ?? 0.05, 0));
    try {
      p.c.reach('R', grip());
      await this.tween(0.85, () => {});
      p.c.holdRight(g, 'glass');
      p.c.reach('R', null);
      p.sipping = true;
      await this.tween(0.6, () => {});
      const lvl = g.userData.level();
      await this.tween(1.5, (k) => {
        const tilt = k < 0.2 ? k / 0.2 : k < 0.8 ? 1 : (1 - k) / 0.2;
        p.c.setTilt(-1.05 * tilt);
        if (k > 0.2) g.userData.setFill(Math.max(0, lvl - Math.min(1, (k - 0.2) / 0.6) / SIPS));
      });
      p.c.setTilt(0);
      p.sipping = false;
      p.c.reach('R', grip());
      await this.tween(0.85, () => {});
      p.c.holdRight(null);
      this.scene.add(g);
      g.position.copy(d.at);
      g.rotation.set(0, 0, 0);
    } finally {
      p.c.reach('R', null);
      p.sipping = false;
      p.tableSip = false;
      d.busy = false;
    }
  }

  async sipCeo(d) {
    d.busy = true;
    const H = this.hands;
    const g = d.glass;
    await H.to('R', d.at.clone().add(new THREE.Vector3(0, g.userData.hold ?? 0.04, 0)), 0.7);
    H.grab('R', g);
    await H.to('R', 'mouth', 0.8);
    const lvl = g.userData.level();
    await H.tween(1.5, (k) => {
      H.set('R', { tiltX: -Math.sin(Math.min(1, k * 2.5) * Math.PI / 2) * 0.85 * (k < 0.8 ? 1 : (1 - k) / 0.2) });
      g.userData.setFill(Math.max(0, lvl - (k > 0.3 ? Math.min(1, (k - 0.3) / 0.5) : 0) / SIPS));
    });
    H.set('R', { tiltX: 0 });
    await H.to('R', d.at.clone().add(new THREE.Vector3(0, g.userData.hold ?? 0.04, 0)), 0.8);
    H.release('R', d.at);
    await H.to('R', 'rest', 0.6);
    d.busy = false;
  }

  /** An agent: take the cigar from the ashtray, draw on it, blow the smoke out, reach over and put it back. */
  async puffPerson(p, c) {
    c.busy = true;
    const cg = c.cigar;
    const restAt = () => restPose(c.tray, c.rest).pos.clone().add(new THREE.Vector3(0, 0.02, 0));
    try {
      p.c.reach('L', restAt());
      await this.tween(0.85, () => {});
      p.c.holdLeft(cg);
      p.c.reach('L', null);
      p.puffing = true;
      await this.tween(0.6, () => {});
      await this.tween(1.3, (k) => cg.userData.setPuff(k > 0.1 && k < 0.85 ? 1 : 0));
      cg.userData.setPuff(0);
      this.burn(c);
      p.puffing = false;
      // the arm comes down, then the smoke goes out in a long breath
      await this.tween(0.35, () => {});
      const mouth = p.c.mouth ? p.c.mouth(new THREE.Vector3(), 'L') : p.c.headPosition(new THREE.Vector3());
      const fwd = new THREE.Vector3(Math.sin(p.face), 0.15, Math.cos(p.face));
      for (let i = 0; i < 7; i++) setTimeout(() => this.smoke.emit(mouth.clone().addScaledVector(fwd, 0.06), { big: true, dir: fwd }), i * 110);
      await this.tween(0.6, () => {});
      // reach over and rest it in the ashtray again
      p.c.reach('L', restAt());
      await this.tween(0.85, () => {});
      p.c.holdLeft(null);
      this.seat(cg, c.tray, c.rest);
    } finally {
      p.c.reach('L', null);
      p.puffing = false;
      c.busy = false;
    }
  }

  async puffCeo(c) {
    c.busy = true;
    const H = this.hands;
    const cg = c.cigar;
    await H.to('L', cg.position.clone(), 0.7);
    H.grab('L', cg, { yaw: 0.25, along: 0.05, drop: 0.0 });
    await H.to('L', 'mouth', 0.8);
    await H.tween(1.4, (k) => cg.userData.setPuff(k > 0.15 && k < 0.85 ? 1 : 0));
    cg.userData.setPuff(0);
    this.burn(c);
    await H.to('L', 'low', 0.5);
    // blow the smoke out
    const cam = this.rig.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    for (let i = 0; i < 6; i++) setTimeout(() => this.smoke.emit(cam.position.clone().addScaledVector(fwd, 0.35).add(new THREE.Vector3(0, -0.12, 0)), { big: true, dir: fwd }), i * 110);
    // back in the ashtray
    const p = restPose(c.tray, c.rest);
    await H.to('L', p.pos.clone().add(new THREE.Vector3(0, 0.01, 0)), 0.8);
    H.release('L', null);
    this.seat(cg, c.tray, c.rest);
    await H.to('L', 'rest', 0.6);
    c.busy = false;
  }

  burn(c) {
    c.puffs++;
    const u = c.cigar.userData;
    u.setLength(1 - c.puffs / PUFFS);
    u.setAsh(Math.min(0.025, u.state.ash + 0.004));
    if (u.state.ash >= 0.02) u.setAsh(0.004); // tapped off into the ashtray
    if (c.puffs >= PUFFS) u.setLit(0.15); // finished: just a stub left smouldering
  }

  // ------------------------------------------------------------ frame
  update(dt, t) {
    this.t = t;
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t = Math.min(a.dur, a.t + dt);
      a.fn(a.t / a.dur);
      if (a.t >= a.dur) {
        this.anims.splice(i, 1);
        a.done();
      }
    }
    const ceoFree = () => this.rig.mode === 'seated' && !this.ceoBusy() && !this.hands.busy && !this.hands.item('R') && !this.hands.item('L');
    // drinks
    for (const [owner, d] of [...this.drinks]) {
      if (owner !== 'ceo' && d.spot && owner.spot !== d.spot && !d.busy) {
        // they got up: take the glass along (or leave an empty one)
        this.drinks.delete(owner);
        if (!d.glass.userData.empty() && !owner.c.rightItem) owner.takeGlass(d.glass);
        else d.glass.removeFromParent();
        continue;
      }
      if (d.busy || t < d.nextAt || d.glass.userData.empty()) continue;
      const smoking = this.cigars.get(owner);
      if (smoking?.busy) continue;
      if (owner === 'ceo') {
        if (!ceoFree()) continue;
        d.nextAt = t + rand(16, 28);
        this.sipCeo(d);
      } else {
        if (owner.mode !== 'idle' || owner.phone) { d.nextAt = t + 3; continue; }
        d.nextAt = t + rand(14, 30);
        this.sipPerson(owner, d);
      }
    }
    // cigars
    for (const [owner, c] of [...this.cigars]) {
      const u = c.cigar.userData;
      if (owner !== 'ceo' && owner.spot && c.spot && owner.spot !== c.spot && !c.busy) {
        this.removeCigar(owner);
        continue;
      }
      // a lit cigar smoulders
      if (u.state.lit > 0.3 && !c.busy) {
        c.wisp -= dt;
        if (c.wisp <= 0) {
          c.wisp = 0.35 + Math.random() * 0.3;
          this.smoke.emit(u.tip());
        }
      }
      if (c.busy || t < c.nextAt || c.puffs >= PUFFS) continue;
      if (this.drinks.get(owner)?.busy) continue;
      if (owner === 'ceo') {
        if (!ceoFree()) continue;
        c.nextAt = t + rand(18, 32);
        this.puffCeo(c);
      } else {
        if (owner.mode !== 'idle' || owner.phone) { c.nextAt = t + 3; continue; }
        c.nextAt = t + rand(16, 34);
        this.puffPerson(owner, c);
      }
    }
    this.smoke.update(dt);
  }
}
