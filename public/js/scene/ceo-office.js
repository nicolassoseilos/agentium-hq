// What the CEO does with his own hands in the penthouse: walk to the cabinet,
// pour whisky from the decanter (for himself and whoever is sitting with him),
// pick a cigar from the humidor, cut it, light it with the jet lighter, and carry
// everything back to the desk on the silver tray in one trip. Refills too: he
// takes the empty glass back to the cabinet and pours again.
import * as THREE from 'three';
import { makeGlass } from './drinks.js';
import { cigarTip } from './smoking.js';

const ease = (k) => k * k * (3 - 2 * k);

export class Office {
  constructor({ scene, rig, hands, leisure, W, workers, meetings, sitCeo, ceoSeat, toast, floorY }) {
    Object.assign(this, { scene, rig, hands, leisure, W, workers, meetings, sitCeo, ceoSeat, toast });
    this.y0 = floorY;
    this.busy = false;
    this.pending = []; // lit cigars waiting to go to the desk: { owner, cigar, dest }
    this.onTray = []; // things lying on the tray
    this.ashtrayOnDesk = [false, false];
    this.cabTrayHome = W.tray.position.clone();
    this.listeners = new Set();
  }

  on(fn) {
    this.listeners.add(fn);
  }

  changed() {
    for (const fn of this.listeners) fn();
  }

  // ------------------------------------------------------------ where things are
  cw(v) {
    this.W.cabinet.updateMatrixWorld(true);
    return this.W.cabinet.localToWorld(v.clone());
  }

  P(x, z) {
    return new THREE.Vector3(x, this.y0, z);
  }

  get atCabinet() {
    if (this.rig.mode !== 'standing') return false;
    const s = this.cw(this.W.standAt);
    return Math.hypot(this.rig.camera.position.x - s.x, this.rig.camera.position.z - s.z) < 0.3;
  }

  guestsHere() {
    return [...this.meetings].filter(([, m]) => m.room === 'penthouse').map(([id]) => id).filter((id) => this.workers[id].spot === this.meetings.get(id).spot && this.workers[id].mode === 'idle');
  }

  /** Turn to look at a spot on the cabinet (cabinet-local) while standing there. */
  face(local) {
    if (this.rig.mode === 'standing' && this.rig.stand) this.rig.stand.look = this.cw(local);
  }

  walk(points, look) {
    return new Promise((res) => this.rig.walkTo(points, look, res));
  }

  /** Get up (if seated) and walk to the drinks cabinet. */
  async goToCabinet() {
    if (this.atCabinet) return;
    const cam = this.rig.camera.position;
    const stand = this.cw(this.W.standAt);
    const look = this.cw(new THREE.Vector3(-0.15, 0.8, 0));
    // the tray left on the desk goes back with you
    if (this.trayOnDesk && this.rig.mode === 'seated') {
      const tw = this.W.tray.getWorldPosition(new THREE.Vector3());
      await this.hands.to('L', tw.add(new THREE.Vector3(0, 0.02, 0)), 0.7);
      this.hands.grab('L', this.W.tray, { drop: 0, yaw: 0 });
      await this.hands.to('L', 'tray', 0.5);
    } else if (this.trayOnDesk) {
      this.W.cabinet.attach(this.W.tray);
      this.W.tray.position.copy(this.cabTrayHome);
      this.W.tray.rotation.set(0, Math.PI / 2, 0);
      this.trayOnDesk = false;
    }
    const pts = cam.z > -2.6 ? [this.P(cam.x, cam.z), this.P(2.4, -2.2), this.P(0.4, -3.4), stand] : [this.P(cam.x, -5.3), this.P(1.0, -5.6), stand];
    await this.walk(pts, look);
    if (this.hands.item('L') === this.W.tray) {
      // put it back in its place on the cabinet
      const home = this.cw(this.cabTrayHome);
      await this.hands.to('L', home.clone().add(new THREE.Vector3(0, 0.02, 0)), 0.6);
      await this.returnTrayToCabinet();
      this.trayOnDesk = false;
    }
  }

  async goToDeskFront() {
    const f = this.W.deskFront;
    const cam = this.rig.camera.position;
    const pts = cam.z < -2.6 && cam.x > 3 ? [this.P(cam.x, -5.3), this.P(7.4, -5.3), this.P(7.4, f.z), this.P(f.x, f.z)] : [this.P(0.4, -3.4), this.P(2.4, -2.2), this.P(f.x, f.z)];
    await this.walk(pts, this.W.deskCentre);
  }

  async goToChair() {
    const cam = this.rig.camera.position;
    const back = this.W.chairBack;
    const pts = cam.z > -2.6 ? [this.P(7.4, cam.z), this.P(7.4, back.z), back] : [this.P(1.0, -5.6), this.P(back.x, back.z)];
    await this.walk(pts, this.W.deskCentre);
    this.sitCeo();
    await this.hands.wait(1.8);
  }

  freeTumbler() {
    const t = this.W.tumblers.find((x) => x.parent === this.W.cabinet && x.userData.level() < 0.02);
    if (t) return t;
    // all in use: a fresh one from the cabinet
    const n = makeGlass('whisky');
    n.userData.setFill(0);
    n.userData.setIce(false);
    n.position.set(0.82, 0.87, -0.06);
    this.W.cabinet.add(n);
    this.W.tumblers.push(n);
    return n;
  }

  // ------------------------------------------------------------ carrying on the tray
  traySlot(obj) {
    const used = this.onTray.length;
    const kind = obj.userData.kind;
    // ashtrays in the middle (a second one stacked), glasses round the edge, cigars along the side
    if (kind === 'ashtray') {
      const n = this.onTray.filter((o) => o.userData.kind === 'ashtray').length;
      return new THREE.Vector3(0, 0.008 + n * 0.05, -0.04);
    }
    if (kind === 'cigar') {
      const n = this.onTray.filter((o) => o.userData.kind === 'cigar').length;
      return new THREE.Vector3(0.12, 0.02, -0.18 + n * 0.04);
    }
    const n = this.onTray.filter((o) => o.userData.type).length;
    void used;
    return [new THREE.Vector3(-0.1, 0.008, 0.17), new THREE.Vector3(0.04, 0.008, 0.18), new THREE.Vector3(-0.1, 0.008, 0.06)][n % 3];
  }

  async putOnTray(obj, side = 'R') {
    const tray = this.W.tray;
    const slot = this.traySlot(obj);
    const world = tray.localToWorld(slot.clone());
    await this.hands.to(side, world.clone().add(new THREE.Vector3(0, obj.userData.hold ?? 0.03, 0)), 0.55);
    this.hands.release(side, world);
    tray.attach(obj);
    obj.position.copy(slot);
    obj.rotation.set(0, obj.userData.kind === 'cigar' ? Math.PI / 2 : 0, 0);
    this.onTray.push(obj);
  }

  async takeTray() {
    const tray = this.W.tray;
    const w = tray.getWorldPosition(new THREE.Vector3());
    await this.hands.to('L', w.clone().add(new THREE.Vector3(0, 0.02, 0)), 0.6);
    this.hands.grab('L', tray, { drop: 0.0, yaw: Math.PI / 2 });
    await this.hands.to('L', 'tray', 0.6);
  }

  async returnTrayToCabinet() {
    const tray = this.W.tray;
    this.hands.release('L', null);
    this.W.cabinet.attach(tray);
    tray.position.copy(this.cabTrayHome);
    tray.rotation.set(0, Math.PI / 2, 0);
    await this.hands.to('L', 'rest', 0.4);
  }

  /** Take something off the tray with the right hand and put it down at `at`. */
  async fromTray(obj, at, yaw = 0) {
    await this.hands.to('R', obj.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, obj.userData.hold ?? 0.03, 0)), 0.5);
    this.hands.grab('R', obj);
    this.onTray = this.onTray.filter((o) => o !== obj);
    await this.hands.to('R', at.clone().add(new THREE.Vector3(0, obj.userData.hold ?? 0.03, 0)), 0.75);
    this.hands.release('R', at, yaw);
  }

  // ------------------------------------------------------------ whisky
  /**
   * Pour whisky. `ids`: 'ceo' and/or agent ids. Glasses already on the desk are
   * picked up and refilled; everyone else gets a fresh crystal tumbler.
   */
  async pour(ids) {
    if (this.busy) return this.toast('One moment…');
    this.busy = true;
    this.changed();
    try {
      const L = this.leisure, H = this.hands;
      const glasses = []; // { owner, glass }
      // your own glass: reach for it before getting up
      if (ids.includes('ceo') && L.drinkOf('ceo') && this.rig.mode === 'seated') {
        const at = L.drinks.get('ceo').at;
        const g = L.takeDrink('ceo');
        await H.to('R', at.clone().add(new THREE.Vector3(0, g.userData.hold, 0)), 0.7);
        H.grab('R', g);
        await H.to('R', 'hold', 0.5);
        glasses.push({ owner: 'ceo', glass: g, inHand: 'R' });
      }
      // guests' glasses on the desk: collect them first
      const guestRefills = ids.filter((id) => id !== 'ceo' && L.drinkOf(this.workers[id]));
      if (guestRefills.length) {
        await this.goToDeskFront();
        for (const id of guestRefills) {
          const p = this.workers[id];
          const d = L.drinks.get(p);
          const g = L.takeDrink(p);
          const side = H.item('R') ? 'L' : 'R';
          await H.to(side, d.at.clone().add(new THREE.Vector3(0, g.userData.hold, 0)), 0.7);
          if (H.item(side)) {
            // pinched next to the one already in that hand
            H.item(side).attach(g);
            g.position.set(0.09, 0, 0);
          } else H.grab(side, g);
          glasses.push({ owner: id, glass: g, inHand: side });
          await H.to(side, 'hold', 0.4);
        }
      }
      await this.goToCabinet();
      // glasses on the pouring spots
      const spots = this.W.pourSpots.map((v) => this.cw(v));
      let i = 0;
      const placed = [];
      for (const side of ['R', 'L']) {
        const held = H.item(side);
        if (!held || !held.userData.type) continue;
        const kids = held.children.filter((c) => c.userData && c.userData.type);
        await H.to(side, spots[i].clone().add(new THREE.Vector3(0, held.userData.hold, 0)), 0.6);
        H.release(side, spots[i]);
        placed.push(held);
        i++;
        for (const k of kids) {
          this.scene.attach(k);
          k.position.copy(spots[i]);
          k.rotation.set(0, 0, 0);
          placed.push(k);
          i++;
        }
        await H.to(side, 'rest', 0.3);
      }
      // fresh tumblers for the others
      for (const id of ids) {
        if (glasses.find((x) => x.owner === id)) continue;
        const t = this.freeTumbler();
        if (!t) break;
        const from = t.getWorldPosition(new THREE.Vector3());
        await H.to('R', from.clone().add(new THREE.Vector3(0, t.userData.hold, 0)), 0.55);
        H.grab('R', t);
        await H.to('R', spots[i].clone().add(new THREE.Vector3(0, t.userData.hold, 0)), 0.5);
        H.release('R', spots[i]);
        glasses.push({ owner: id, glass: t });
        placed.push(t);
        i++;
      }
      // the decanter: lift, pour into each glass, put it back
      await this.pourFromDecanter(placed);
      // carry them back
      const forGuests = glasses.filter((x) => x.owner !== 'ceo');
      const mine = glasses.find((x) => x.owner === 'ceo');
      const useTray = forGuests.length > 0 || this.pending.length > 0;
      if (useTray) {
        for (const x of forGuests) await this.liftToTray(x.glass);
        if (mine) await this.liftToTray(mine.glass);
        await this.trayPendingCigars();
        await this.takeTray();
      } else if (mine) {
        await H.to('R', mine.glass.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, mine.glass.userData.hold, 0)), 0.5);
        H.grab('R', mine.glass);
        await H.to('R', 'hold', 0.5);
      }
      if (forGuests.length) {
        await this.goToDeskFront();
        for (const x of forGuests) {
          const p = this.workers[x.owner];
          const m = this.meetings.get(x.owner);
          const at = this.W.desk[m?.spot?.id] || this.W.desk['pent-guest-l'];
          await this.fromTray(x.glass, at);
          L.placeDrink(p, x.glass, at, p.spot);
        }
        await this.deliverAshtrays(true);
      }
      await this.goToChair();
      if (useTray) {
        if (mine) {
          L.removeDrink('ceo'); // (an old empty glass, if you poured a fresh one)
          await this.fromTray(mine.glass, this.W.desk.ceo);
          L.placeDrink('ceo', mine.glass, this.W.desk.ceo);
        }
        await this.deliverAshtrays(false);
        await this.returnTrayHome();
      } else if (mine) {
        await H.to('R', this.W.desk.ceo.clone().add(new THREE.Vector3(0, mine.glass.userData.hold, 0)), 0.8);
        L.removeDrink('ceo');
        H.release('R', this.W.desk.ceo);
        L.placeDrink('ceo', mine.glass, this.W.desk.ceo);
      }
      await H.to('R', 'rest', 0.5);
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  async liftToTray(glass) {
    await this.hands.to('R', glass.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, glass.userData.hold, 0)), 0.45);
    this.hands.grab('R', glass);
    await this.putOnTray(glass, 'R');
  }

  async pourFromDecanter(glasses) {
    const H = this.hands;
    this.face(new THREE.Vector3(0.35, 0.8, 0.1));
    const dec = this.W.decanter;
    const home = { pos: dec.position.clone(), rot: dec.rotation.clone() };
    const dw = dec.getWorldPosition(new THREE.Vector3());
    await H.to('R', dw.clone().add(new THREE.Vector3(0, 0.12, 0)), 0.6);
    H.grab('R', dec, { drop: 0.12 });
    await H.to('R', dw.clone().add(new THREE.Vector3(0, 0.3, 0)), 0.4);
    const cam = this.rig.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).setY(0).normalize();
    for (const g of glasses) {
      const gw = g.getWorldPosition(new THREE.Vector3());
      await H.to('R', gw.clone().addScaledVector(right, -0.15).add(new THREE.Vector3(0, 0.21, 0)), 0.6);
      const lvl = g.userData.level();
      await H.tween(1.9, (k) => {
        const tilt = Math.sin(Math.min(1, k / 0.25) * Math.PI / 2) * (k > 0.8 ? (1 - k) / 0.2 : 1);
        H.set('R', { tiltZ: tilt * 1.85 });
        if (k > 0.22 && k < 0.82) g.userData.setFill(lvl + (1 - lvl) * ((k - 0.22) / 0.6));
      });
      g.userData.setFill(1);
      H.set('R', { tiltZ: 0 });
    }
    await H.to('R', dw.clone().add(new THREE.Vector3(0, 0.25, 0)), 0.6);
    await H.to('R', dw.clone().add(new THREE.Vector3(0, 0.12, 0)), 0.35);
    H.release('R', null);
    this.W.cabinet.attach(dec);
    dec.position.copy(home.pos);
    dec.rotation.copy(home.rot);
    await H.to('R', 'rest', 0.4);
  }

  // ------------------------------------------------------------ cigars
  async openHumidor() {
    if (this.busy) return this.toast('One moment…');
    this.busy = true;
    this.changed();
    try {
      await this.goToCabinet();
      this.face(new THREE.Vector3(-0.7, 0.8, 0.05));
      if (this.W.humidor.userData.cigars.length < 2) this.W.humidor.userData.restock();
      this.W.humidor.userData.setOpen(true);
      this.toast('Pick a cigar.');
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  get humidorOpen() {
    return this.W.humidor.userData.open;
  }

  get cigarInHand() {
    const c = this.hands.item('L');
    return c && c.userData.kind === 'cigar' && c.userData.state.lit < 0.5 ? c : null; // (an unlit one, waiting for the lighter)
  }

  /** Take this cigar from the humidor and cut it. */
  async takeCigar(cigar, quick = false) {
    if (this.busy && !quick) return this.toast('One moment…');
    if (this.cigarInHand && !quick) return this.toast('Light the one in your hand first.');
    const own = !quick;
    if (own) { this.busy = true; this.changed(); }
    try {
      const H = this.hands;
      await this.goToCabinet();
      this.face(new THREE.Vector3(-0.7, 0.8, 0.05));
      const cw = cigar.getWorldPosition(new THREE.Vector3());
      await H.to('L', cw.clone().add(new THREE.Vector3(0, 0.02, 0)), quick ? 0.4 : 0.6);
      this.W.humidor.userData.cigars.splice(this.W.humidor.userData.cigars.indexOf(cigar), 1);
      H.grab('L', cigar, { yaw: -0.95, along: 0.06, drop: 0 });
      await H.to('L', 'hold', 0.5);
      // cut the cap with the guillotine
      const cut = this.W.cutter;
      const home = { pos: cut.position.clone(), rot: cut.rotation.clone() };
      await H.to('R', cut.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.01, 0)), quick ? 0.35 : 0.5);
      H.grab('R', cut, { drop: 0, yaw: Math.PI / 2 });
      const capW = () => cigar.localToWorld(new THREE.Vector3(0, 0, 0.004));
      await H.to('R', { world: capW() }, 0.5);
      await H.tween(0.45, (k) => cut.userData.snip(k));
      cigar.userData.cut();
      // the cut-off tip drops onto the cabinet
      const tip = cigarTip();
      this.scene.add(tip);
      tip.position.copy(capW());
      const floor = this.cw(new THREE.Vector3(0, 0.875, 0)).y;
      const v = { y: 0 };
      this.leisure.tween(0.6, (k) => {
        v.y -= 0.02;
        tip.position.y = Math.max(floor, tip.position.y + v.y * 0.5);
        if (k >= 1) setTimeout(() => tip.removeFromParent(), 4000);
      });
      await H.to('R', this.cw(home.pos).add(new THREE.Vector3(0, 0.01, 0)), 0.5);
      H.release('R', null);
      this.W.cabinet.attach(cut);
      cut.position.copy(home.pos);
      cut.rotation.copy(home.rot);
      await H.to('R', 'rest', 0.35);
      if (!quick) this.toast('Cut. Now click the jet lighter to light it.');
    } finally {
      if (own) { this.busy = false; this.changed(); }
    }
  }

  /** Light the cigar in your left hand with the jet lighter. */
  async light(owner = 'ceo', quick = false) {
    const cigar = this.cigarInHand;
    if (!cigar) return this.toast('Take a cigar from the humidor first.');
    const own = !quick;
    if (this.busy && own) return this.toast('One moment…');
    if (own) { this.busy = true; this.changed(); }
    try {
      const H = this.hands;
      const lt = this.W.lighter;
      const home = { pos: lt.position.clone(), rot: lt.rotation.clone() };
      await H.to('R', lt.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.035, 0)), 0.55);
      H.grab('R', lt, { drop: 0.035 });
      await Promise.all([H.to('L', 'light', 0.6), H.to('R', 'light', 0.6)]);
      // the torch flame on the foot of the cigar until it glows all round
      const foot = () => cigar.localToWorld(new THREE.Vector3(0, -0.01, 0.15));
      await H.to('R', { world: foot().add(new THREE.Vector3(0, -0.125, 0)) }, 0.4);
      let tt = 0;
      await H.tween(quick ? 2.2 : 3.6, (k) => {
        tt += 1 / 60;
        lt.userData.setFlame(true, tt);
        cigar.userData.setLit(k);
        H.set('L', { tiltZ: Math.sin(k * Math.PI * 4) * 0.35 }); // turning it in the flame
        if (Math.random() < 0.25) this.leisure.smoke.emit(foot());
      });
      lt.userData.setFlame(false);
      H.set('L', { tiltZ: 0 });
      cigar.userData.setLit(1);
      await H.to('R', this.cw(home.pos).add(new THREE.Vector3(0, 0.035, 0)), 0.55);
      H.release('R', null);
      this.W.cabinet.attach(lt);
      lt.position.copy(home.pos);
      lt.rotation.copy(home.rot);
      H.to('R', 'rest', 0.4);
      // into an ashtray (on the cabinet, or on the tray if it is already on the desk)
      const dest = owner === 'ceo' ? 0 : 1;
      const tray = this.W.ashtrays[dest];
      if (!this.ashtrayOnDesk[dest]) {
        const rest = this.leisure.freeRest(tray);
        rest.taken = owner;
        const p = tray.localToWorld(rest.pos.clone());
        await H.to('L', p, 0.6);
        H.release('L', null);
        this.leisure.seat(cigar, tray, rest);
        tray.attach(cigar);
        this.pending.push({ owner, cigar, dest, rest });
      } else {
        await this.putOnTray(cigar, 'L');
        this.pending.push({ owner, cigar, dest, loose: true });
      }
      await H.to('L', 'rest', 0.4);
      if (own) {
        this.W.humidor.userData.setOpen(false);
        this.toast(this.guestsHere().some((id) => !this.leisure.cigarOf(this.workers[id])) ? 'Lit. Pour a whisky, light cigars for your guests, or head back to your desk.' : 'Lit. Pour a whisky if you like, or head back to your desk.');
      }
    } finally {
      if (own) { this.busy = false; this.changed(); }
    }
  }

  /** Cigars for everyone sitting with you (cut and lit here, then brought over). */
  async cigarsForGuests() {
    if (this.busy) return this.toast('One moment…');
    const ids = this.guestsHere().filter((id) => !this.leisure.cigarOf(this.workers[id]) && !this.pending.find((p) => p.owner === id));
    if (!ids.length) return this.toast('Everyone has a cigar.');
    this.busy = true;
    this.changed();
    try {
      await this.goToCabinet();
      this.W.humidor.userData.setOpen(true);
      for (const id of ids) {
        const c = this.W.humidor.userData.cigars[this.W.humidor.userData.cigars.length - 1];
        if (!c) break;
        await this.takeCigar(c, true);
        await this.light(id, true);
      }
      this.W.humidor.userData.setOpen(false);
      this.toast('Their cigars are lit. Head back to your desk when you are ready.');
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  /** Put the ashtrays (with the lit cigars resting in them) and loose cigars on the tray. */
  async trayPendingCigars() {
    for (const dest of [0, 1]) {
      if (this.ashtrayOnDesk[dest] || !this.pending.find((p) => p.dest === dest && !p.loose)) continue;
      const a = this.W.ashtrays[dest];
      await this.hands.to('R', a.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.04, 0)), 0.5);
      this.hands.grab('R', a, { drop: 0.04 });
      await this.putOnTray(a, 'R');
    }
  }

  /** At the desk: ashtrays down (front one when guests smoke), loose cigars into their rests. */
  async deliverAshtrays(front) {
    const L = this.leisure;
    for (const dest of front ? [1] : [0, 1]) {
      const a = this.W.ashtrays[dest];
      if (this.onTray.includes(a)) {
        await this.fromTray(a, this.W.deskAshtray[dest]);
        this.scene.attach(a);
        this.ashtrayOnDesk[dest] = true;
      }
    }
    for (const p of [...this.pending]) {
      if (front && p.dest !== 1) continue;
      if (!this.ashtrayOnDesk[p.dest]) continue;
      const tray = this.W.ashtrays[p.dest];
      if (p.loose) {
        const rest = L.freeRest(tray);
        if (!rest) continue;
        await this.fromTray(p.cigar, tray.localToWorld(rest.pos.clone()));
        p.rest = rest;
      }
      const owner = p.owner === 'ceo' ? 'ceo' : this.workers[p.owner];
      L.placeCigar(owner, p.cigar, tray, p.rest, owner === 'ceo' ? null : owner.spot);
      this.pending = this.pending.filter((x) => x !== p);
    }
  }

  async returnTrayHome() {
    // the empty tray stays on the corner of the desk until next time
    const H = this.hands;
    if (H.item('L') !== this.W.tray) return;
    H.release('L', null);
    this.scene.attach(this.W.tray);
    const at = this.W.deskCentre.clone().add(new THREE.Vector3(-1.45, 0, -0.35));
    this.W.tray.position.copy(at);
    this.W.tray.rotation.set(0, 0, 0);
    this.trayOnDesk = true;
    await H.to('L', 'rest', 0.4);
  }

  /** Walk back to the desk with everything (the tray if needed). */
  async backToDesk() {
    if (this.busy) return this.toast('One moment…');
    this.busy = true;
    this.changed();
    try {
      if (this.pending.length) {
        await this.trayPendingCigars();
        await this.takeTray();
        if (this.pending.some((p) => p.dest === 1)) {
          await this.goToDeskFront();
          await this.deliverAshtrays(true);
        }
      }
      await this.goToChair();
      if (this.hands.item('L') === this.W.tray) {
        await this.deliverAshtrays(false);
        await this.returnTrayHome();
      }
    } finally {
      this.busy = false;
      this.changed();
    }
  }
}
