// Life on the rooftop: the guests, where everyone goes (random, never a
// routine), and the barman who really serves drinks — menu, bottle from the
// back bar, glass, pour, slide it over, bottle back on the shelf.
import * as THREE from 'three';
import { Person } from './person.js';
import { makeCharacter, guestLook, GUEST_NAMES } from './people.js';
import { DRINKS, makeGlass } from './drinks.js';
import { makeAshtray, makeCutter, makeJetLighter } from './smoking.js';
import { floorY } from './layout.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const GUEST_TYPES = { sunbed: 3, edge: 2.2, swim: 1.8, barstand: 1.6, stand: 1.6, cabana: 1.1, sofa: 1 };
const WORKER_TYPES = { sunbed: 3, stool: 1.6, sofa: 1.4, stand: 1.4, cabana: 1 };
const GUEST_DRINKS = ['champagne', 'rose', 'sunset', 'wine', 'sunset', 'gintonic', 'champagne', 'martini'];
const WORKER_DRINKS = { scott: ['cognac', 'whisky'], bob: ['whisky', 'gintonic'], tom: ['gintonic', 'wine', 'whisky'] };

export class RooftopLife {
  constructor({ scene, roof, lift, guestCount = 10, makeGuest = null }) {
    this.scene = scene;
    this.roof = roof;
    this.spots = roof.spots;
    this.lift = lift;
    this.guests = [];
    this.jobs = [];
    this.service = new Map(); // stool spot -> job
    this.listeners = new Set();
    this.ceoSpot = null;
    this.t = 0;

    const world = { lift, spotFor: (p) => this.spotFor(p) };
    for (let i = 0; i < guestCount; i++) {
      const id = `guest${i}`;
      const c = makeGuest ? makeGuest(i, id) : makeCharacter(id, guestLook(i, Math.random));
      scene.add(c.root);
      const p = new Person(c, world, { name: GUEST_NAMES[i % GUEST_NAMES.length], role: 'Guest', kind: 'guest', vibe: true });
      const spot = this.spotFor(p);
      if (spot) p.placeAt(spot);
      p.nextAt = rand(8, 70);
      if (spot?.type !== 'swim' && Math.random() < 0.55) p.giveDrink(pick(GUEST_DRINKS));
      this.guests.push(p);
    }

    // the barman
    const bc = makeCharacter('barman');
    scene.add(bc.root);
    this.barman = new Person(bc, world, { name: 'Marco', role: 'Barman', kind: 'staff', vibe: true });
    const y = floorY(3);
    this.home = new THREE.Vector3(roof.bar.x + 1.2, y, -1.2);
    this.barman.floor = 3;
    this.barman.pos.copy(this.home);
    this.barman.face = -Math.PI / 2;
    this.barman.mode = 'idle';
    this.barman.script = { pose: 'polish', vibe: true };
    this.barFace = -Math.PI / 2;
  }

  on(fn) {
    this.listeners.add(fn);
  }

  emit(ev, data) {
    for (const fn of this.listeners) fn(ev, data);
  }

  get people() {
    return [...this.guests, this.barman];
  }

  // ------------------------------------------------------------ spots
  spotFor(person, exclude = null) {
    const weights = person.kind === 'guest' ? { ...GUEST_TYPES } : { ...WORKER_TYPES };
    if (person.hasDrink) weights.barstand = weights.stool = 0;
    else if (weights.barstand) weights.barstand *= 1.8;
    // the agents sit at the bar; the guests order standing at the end (one at a time)
    const free = this.spots.filter((s) => !s.occupant && (!s.reserved || person.kind === 'worker') && s !== exclude && weights[s.type]);
    if (!free.length) return null;
    // weighted pick by type, then random spot of that type
    const types = [...new Set(free.map((s) => s.type))];
    let total = types.reduce((a, t) => a + weights[t], 0);
    let r = Math.random() * total;
    let type = types[0];
    for (const t of types) {
      r -= weights[t];
      if (r <= 0) { type = t; break; }
    }
    const s = pick(free.filter((x) => x.type === type));
    s.occupant = person;
    return s;
  }

  stoolFree(spot) {
    return !spot.occupant;
  }

  // ------------------------------------------------------------ the CEO at the bar
  ceoSit(spot) {
    spot.occupant = 'ceo';
    this.ceoSpot = spot;
  }

  ceoLeave() {
    if (!this.ceoSpot) return;
    const s = this.ceoSpot;
    if (s.occupant === 'ceo') s.occupant = null;
    const job = this.service.get(s);
    if (job && job.customer === 'ceo' && job.phase === 'reading') this.finishJob(job, true);
    this.leisure?.removeDrink('ceo');
    this.leisure?.removeCigar('ceo');
    this.ceoMenu && this.scene.remove(this.ceoMenu);
    this.ceoMenu = null;
    this.ceoSpot = null;
  }

  /** The CEO wants this seat: whoever is there gets up and goes elsewhere. */
  evict(spot) {
    const p = spot.occupant;
    if (!p || p === 'ceo' || p.invited) return;
    const next = this.spotFor(p, spot) || { ...this.roof.stations.visit, room: 'rooftop', floor: 3, type: 'stand', pose: 'stand', release() {} };
    spot.occupant = null;
    if (p.spot === spot) p.servedAt = 0;
    p.goToSpot(next, 3);
  }

  /** Invite an agent to sit next to the CEO at the bar. */
  inviteToBar(person) {
    const me = this.ceoSpot;
    if (!me || me.type !== 'stool') return null;
    const stools = this.roof.stools;
    const i = stools.indexOf(me);
    // nearest stool to the CEO; a guest sitting there gives it up (she swaps out),
    // only the CEO himself or another invited agent keeps a stool
    const order = stools.map((s, k) => k).filter((k) => k !== i).sort((x, y) => Math.abs(x - i) - Math.abs(y - i) || y - x);
    const kept = (s) => s.occupant && (s.occupant === 'ceo' || s.occupant.invited);
    const seat = order.map((k) => stools[k]).find((s) => !kept(s));
    if (!seat) return null;
    if (seat.occupant) this.evict(seat);
    seat.occupant = person;
    person.invited = true;
    person.servedAt = 0;
    return seat;
  }

  ceoAskMenu() {
    const s = this.ceoSpot;
    if (!s || s.type !== 'stool' || this.service.get(s)) return false;
    this.addJob(s, 'ceo', null, true);
    return true;
  }

  ceoOrder(drink) {
    const s = this.ceoSpot;
    if (!s || s.type !== 'stool') return false;
    const job = this.service.get(s);
    if (job && job.phase === 'reading') {
      job.drink = drink;
      return true;
    }
    if (job) return false;
    this.addJob(s, 'ceo', drink, false);
    return true;
  }

  // ------------------------------------------------------------ bar service
  addJob(spot, customer, drink, withMenu) {
    const job = { spot, customer, drink, withMenu, phase: 'queued', timer: 0 };
    this.jobs.push(job);
    this.service.set(spot, job);
    return job;
  }

  finishJob(job, cancelled = false) {
    this.jobs = this.jobs.filter((j) => j !== job);
    if (this.service.get(job.spot) === job) this.service.delete(job.spot);
    if (job === this.active) this.active = null;
    if (cancelled && job.bottleSlot && job.bottleSlot.taken && this.barman.c.rightItem) this.returnBottleNow(job.bottleSlot);
  }

  returnBottleNow(slot) {
    const b = this.barman.c.rightItem;
    this.barman.c.holdRight(null);
    if (b) {
      this.scene.add(b);
      b.position.copy(slot.home);
      b.quaternion.identity();
    }
    slot.taken = false;
  }

  barmanTo(target, face, done) {
    const b = this.barman;
    b.script = null;
    b.walk([new THREE.Vector3(target.x, b.pos.y, target.z)], () => {
      b.mode = 'idle';
      this.barFace = face;
      done();
    });
  }

  act(pose, seconds, done, reach = 0) {
    this.barman.script = { pose, reach, vibe: false };
    this.actTimer = seconds;
    this.actDone = done;
  }

  updateBarman(dt) {
    const b = this.barman;
    if (b.mode === 'idle') b.turnTo(this.barFace, dt);
    if (this.actTimer > 0) {
      this.actTimer -= dt;
      this.actTick?.(1 - Math.max(0, this.actTimer) / this.actLen);
      if (this.actTimer <= 0) {
        const cb = this.actDone;
        this.actDone = null;
        this.actTick = null;
        cb?.();
      }
      return;
    }
    if (this.active || b.mode === 'walk') return;
    const job = this.jobs.find((j) => j.phase === 'queued');
    if (!job) {
      // nothing to do: back home, polishing a glass and enjoying the music
      if (b.pos.distanceTo(this.home) > 0.1) this.barmanTo(this.home, -Math.PI / 2, () => (b.script = { pose: 'polish', vibe: true }));
      else if (!b.script) b.script = { pose: 'polish', vibe: true };
      return;
    }
    this.active = job;
    this.runJob(job);
  }

  timed(pose, seconds, tick, done, reach) {
    this.actLen = seconds;
    this.actTick = tick;
    this.act(pose, seconds, done, reach);
  }

  // ------------------------------------------------------------ service, step by step, all in view
  go(target, face) {
    return new Promise((res) => this.barmanTo(target, face, res));
  }

  do(pose, seconds, tick = null, reach = 0) {
    return new Promise((res) => this.timed(pose, seconds, tick, res, reach));
  }

  runJob(job) {
    const b = this.barman;
    const spot = job.spot;
    const customer = job.customer;
    const stillThere = () => spot.occupant === customer;
    const abort = () => this.finishJob(job, true);
    if (job.withMenu) {
      job.phase = 'menu';
      b.c.showMenu(true);
      this.barmanTo(spot.serve, spot.serveFace ?? -Math.PI / 2, () => {
        this.timed('hand', 0.8, null, () => {
          b.c.showMenu(false);
          if (!stillThere()) return abort();
          job.phase = 'reading';
          if (customer === 'ceo') {
            this.ceoMenu = menuOnCounter(spot.counter);
            this.scene.add(this.ceoMenu);
            this.emit('menu', {});
          } else {
            customer.c.showMenu(true);
            job.readUntil = this.t + rand(4, 7);
          }
          // the barman steps back while they choose
          this.active = null;
          this.waiting = job;
        });
      });
      return;
    }
    const run = job.kind === 'cigar' ? this.makeCigar(job) : this.makeDrink(job);
    run.catch((e) => {
      if (e !== 'gone') console.error(e);
      this.cleanupJob(job);
    });
  }

  /** The customer left halfway: put things away and stop. */
  cleanupJob(job) {
    const b = this.barman;
    const r = b.c.rightItem;
    if (r && job.bottleSlot && r === job.bottleSlot.bottle) this.returnBottleNow(job.bottleSlot);
    else if (r) {
      b.c.holdRight(null);
      r.removeFromParent?.();
    }
    if (b.c.leftItem) {
      const l = b.c.leftItem;
      b.c.holdLeft(null);
      if (l.userData.home) {
        this.scene.add(l);
        l.position.copy(l.userData.home);
        l.rotation.set(0, l.userData.homeYaw || 0, 0);
        if (l.userData.kind === 'ashtray') this.roof.cigarStation.ashStack.push(l);
      } else l.removeFromParent?.();
    }
    if (job.glass && !job.delivered) job.glass.removeFromParent();
    if (job.cigar && !job.delivered) job.cigar.removeFromParent();
    this.finishJob(job, true);
  }

  backBar(z) {
    return { x: this.roof.bar.backX - 0.72, z };
  }

  nearestIce(z) {
    return this.roof.iceStations.reduce((a, s) => (Math.abs(s.z - z) < Math.abs(a.z - z) ? s : a));
  }

  async makeDrink(job) {
    const b = this.barman;
    const spot = job.spot;
    const customer = job.customer;
    const d = DRINKS[job.drink] || DRINKS.whisky;
    const check = () => { if (spot.occupant !== customer) throw 'gone'; };
    const face = spot.serveFace ?? -Math.PI / 2;
    const BACK = Math.PI / 2;
    // 1. the right glass from the back counter
    job.phase = 'glass';
    const gs = this.roof.glassSlots.filter((x) => x.type === d.glass && x.mesh.visible)[0] || this.roof.glassSlots.find((x) => x.type === d.glass);
    await this.go(this.backBar(gs.z), BACK);
    await this.do('reach', 0.6, null, 0);
    check();
    const glass = makeGlass(job.drink);
    glass.userData.setFill(0);
    glass.userData.setIce(false);
    glass.userData.setGarnish(false);
    job.glass = glass;
    gs.mesh.visible = false;
    gs.back = this.t + 40; // a clean one comes back from the washer later
    b.c.holdRight(glass, 'glass');
    // 2. on the bar top, right across from the customer
    await this.go(spot.serve, face);
    check();
    await this.do('hand', 0.55);
    b.c.holdRight(null);
    this.scene.add(glass);
    glass.position.copy(spot.prep);
    glass.rotation.set(0, 0, 0);
    // 3. ice from the bucket (cubes, a big rock, or crushed)
    if (d.ice) {
      const ice = this.nearestIce(spot.prep.z);
      await this.go({ x: spot.serve.x, z: ice.z }, face);
      await this.do('scoop', 0.8);
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.028), new THREE.MeshPhysicalMaterial({ color: '#f2fbff', roughness: 0.1, transparent: true, opacity: 0.75 }));
      cube.userData.hold = 0.0;
      b.c.holdRight(cube, 'glass');
      await this.go(spot.serve, face);
      check();
      await this.do('hand', 0.5);
      b.c.holdRight(null);
      glass.userData.setIce(true);
    }
    // 4. the spirit (or wine) from the back bar, poured over it
    job.phase = 'bottle';
    const slot = this.roof.bottleSlots.find((x) => !x.taken && x.kind === d.bottle) || this.roof.bottleSlots.find((x) => !x.taken);
    job.bottleSlot = slot;
    await this.go(this.backBar(slot.z), BACK);
    await this.do('reach', 0.8, null, slot.reach);
    slot.taken = true;
    b.c.holdRight(slot.bottle, 'bottle');
    await this.go(spot.serve, face);
    check();
    await this.pourInto(glass, 0, d.mixer ? d.base : 1, 2.2);
    // 5. the mixer (and the grenadine for a sunset)
    const extra = d.mixer ? [[d.mixer, d.mixTo ?? 1]] : [];
    if (d.finish) extra.push([d.finish, 1]);
    for (const [kind, to] of extra) {
      await this.go(this.backBar(job.bottleSlot.z), BACK);
      await this.do('reach', 0.6, null, job.bottleSlot.reach);
      this.returnBottleNow(job.bottleSlot);
      const ms = this.roof.mixerSlots.find((x) => x.kind === kind);
      job.bottleSlot = ms;
      await this.go(this.backBar(ms.z), BACK);
      await this.do('reach', 0.6, null, 0);
      ms.taken = true;
      b.c.holdRight(ms.bottle, 'bottle');
      await this.go(spot.serve, face);
      check();
      const from = glass.userData.level();
      await this.pourInto(glass, from, to, kind === 'grenadine' ? 1.3 : 2.0);
      if (kind === 'grenadine') {
        glass.userData.setTwoTone(true);
        glass.userData.setFill(1);
      }
    }
    // set the bottle down on the bar top while he finishes the drink
    const bottle = b.c.rightItem;
    await this.do('hand', 0.4);
    b.c.holdRight(null);
    this.scene.add(bottle);
    bottle.position.copy(spot.prep).add(new THREE.Vector3(0.12, 0, 0.24));
    bottle.rotation.set(0, 0, 0);
    // 6. stir
    if (d.stir) {
      await this.do('stir', 2.2, (k) => glass.userData.stir(k));
      glass.userData.stir(false);
    }
    // 7. garnish from the dish
    if (d.garnish) {
      const ice = this.nearestIce(spot.prep.z);
      await this.go({ x: spot.serve.x, z: ice.z + 0.26 }, face);
      await this.do('scoop', 0.6);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.005, 14), new THREE.MeshStandardMaterial({ color: d.garnish, roughness: 0.5 }));
      wheel.userData.hold = 0;
      b.c.holdRight(wheel, 'glass');
      await this.go(spot.serve, face);
      check();
      await this.do('hand', 0.45);
      b.c.holdRight(null);
      glass.userData.setGarnish(true);
    }
    // 8. slide it across to the customer
    const from = glass.position.clone();
    await this.do('hand', 0.8, (k) => glass.position.lerpVectors(from, spot.counter, k * k * (3 - 2 * k)));
    check();
    this.deliverDrink(job, glass);
    // 9. bottle back on its shelf
    await this.do('hand', 0.4);
    b.c.holdRight(bottle, 'bottle');
    const last = job.bottleSlot;
    await this.go(this.backBar(last.z), BACK);
    await this.do('reach', 0.7, null, last.reach);
    this.returnBottleNow(last);
    this.finishJob(job);
  }

  pourInto(glass, from, to, seconds) {
    const b = this.barman;
    return this.do('pour', seconds, (k) => {
      b.c.setTilt(Math.min(2.0, k * 5) * (k < 0.85 ? 1 : (1 - k) / 0.15));
      glass.userData.setFill(from + (to - from) * Math.max(0, Math.min(1, (k - 0.2) / 0.62)));
    }).then(() => {
      b.c.setTilt(0);
      glass.userData.setFill(to);
    });
  }

  deliverDrink(job, glass) {
    const { spot, customer } = job;
    job.delivered = true;
    if (customer === 'ceo') {
      if (this.ceoSpot === spot) {
        this.leisure?.placeDrink('ceo', glass, spot.counter);
        this.emit('served', { drink: job.drink });
      } else glass.removeFromParent();
    } else if (spot.type === 'stool') {
      // seated: the glass stays on the bar in front of them, and they sip from it
      this.leisure?.placeDrink(customer, glass, spot.counter, spot);
      customer.nextAt = this.t + rand(40, 90);
    } else {
      // standing at the end of the bar: take the drink and go
      glass.removeFromParent();
      customer.takeGlass(glass);
      customer.nextAt = this.t + rand(3, 8);
    }
  }

  // ------------------------------------------------------------ cigars at the bar
  /** The CEO orders a cigar: one for him, and one for each agent sitting with him at the bar. */
  ceoOrderCigar() {
    const s = this.ceoSpot;
    if (!s || s.type !== 'stool') return false;
    const want = [[s, 'ceo']];
    for (const st of this.roof.stools) if (st.occupant && st.occupant !== 'ceo' && st.occupant.invited && Math.abs(st.stool - s.stool) <= 2) want.push([st, st.occupant]);
    for (const [spot, who] of want) {
      if (this.leisure?.cigarOf(who) && this.leisure.cigarOf(who).userData.state.length > 0.2) continue;
      if (this.jobs.find((j) => j.kind === 'cigar' && j.customer === who)) continue;
      this.jobs.push({ kind: 'cigar', spot, customer: who, phase: 'queued' });
    }
    return true;
  }

  /** An ashtray on the bar near this stool with a free rest (shared), if there is one. */
  counterAshtray(spot) {
    for (const a of this.counterAshtrays || []) if (Math.abs(a.position.z - spot.counter.z) < 0.8 && this.leisure.freeRest(a)) return a;
    return null;
  }

  async makeCigar(job) {
    const b = this.barman;
    const spot = job.spot;
    const customer = job.customer;
    const check = () => { if (spot.occupant !== customer) throw 'gone'; };
    const face = spot.serveFace ?? -Math.PI / 2;
    const BACK = Math.PI / 2;
    const st = this.roof.cigarStation;
    const hum = st.humidor.userData;
    job.phase = 'cigar';
    // 1. open the humidor and take a cigar
    await this.go(this.backBar(st.humidor.position.z), BACK);
    await this.do('reach', 0.5, () => hum.setOpen(true), 0);
    await this.do('reach', 0.6, null, 0);
    if (hum.cigars.length < 2) hum.restock();
    const cigar = hum.cigars.pop();
    job.cigar = cigar;
    this.scene.attach(cigar);
    b.c.holdRight(cigar, 'glass');
    cigar.userData.hold = 0;
    await this.do('reach', 0.4, () => hum.setOpen(false), 0);
    // 2. an ashtray (shared if there is one already within reach)
    let tray = this.counterAshtray(spot);
    if (!tray) {
      await this.go(this.backBar(st.ashStack[st.ashStack.length - 1]?.position.z ?? st.z), BACK);
      await this.do('reach', 0.5, null, 0);
      tray = st.ashStack.pop() || makeAshtray();
      this.scene.attach(tray);
      b.c.holdLeft(tray);
      job.tray = tray;
    }
    // 3. over to the customer, so they see everything
    await this.go(spot.serve, face);
    check();
    if (b.c.leftItem === tray) {
      await this.do('hand', 0.6);
      b.c.holdLeft(null);
      this.scene.add(tray);
      // between neighbours who both smoke, otherwise beside the glass
      const near = this.roof.stools.find((x) => x !== spot && x.occupant && Math.abs(x.stool - spot.stool) === 1 && (x.occupant === 'ceo' || x.occupant.invited));
      const z = near ? (spot.counter.z + near.counter.z) / 2 : spot.counter.z + 0.3;
      tray.position.set(spot.counter.x - 0.02, spot.counter.y, z);
      tray.rotation.set(0, 0, 0);
      (this.counterAshtrays ||= []).push(tray);
    }
    // 4. cut the cap with his pocket cutter, in front of the customer
    const cutter = makeCutter();
    b.c.holdLeft(cutter);
    await this.do('light', 1.1, (k) => {
      cutter.userData.snip(k);
      if (k > 0.5 && !cigar.userData.state.cut) cigar.userData.cut();
    });
    b.c.holdLeft(null);
    // 5. light it with the jet lighter, turning it in the flame
    const lighter = makeJetLighter();
    b.c.holdLeft(lighter);
    let tt = 0;
    await this.do('light', 3.4, (k) => {
      tt += 0.016;
      lighter.userData.setFlame(true, tt);
      cigar.userData.setLit(k);
      if (Math.random() < 0.2) this.leisure?.smoke.emit(cigar.userData.tip());
    });
    lighter.userData.setFlame(false);
    cigar.userData.setLit(1);
    b.c.holdLeft(null);
    check();
    await this.do('hand', 0.6);
    const rest = this.leisure.freeRest(tray);
    b.c.holdRight(null);
    job.delivered = true;
    this.leisure.placeCigar(customer, cigar, tray, rest, customer === 'ceo' ? null : spot);
    if (customer === 'ceo') this.emit('cigar', {});
    this.finishJob(job);
  }

  // a customer who was reading the menu has decided
  checkReaders() {
    for (const job of this.jobs) {
      if (job.phase !== 'reading') continue;
      if (job.customer === 'ceo') {
        if (job.drink && !this.active && this.barman.mode !== 'walk' && !(this.actTimer > 0)) {
          if (this.ceoMenu) this.scene.remove(this.ceoMenu);
          this.ceoMenu = null;
          job.withMenu = false;
          job.phase = 'queued';
        }
      } else if (this.t >= job.readUntil) {
        job.customer.c.showMenu(false);
        job.drink = job.drink || pick(job.customer.kind === 'guest' ? GUEST_DRINKS : WORKER_DRINKS[job.customer.id] || ['whisky']);
        job.withMenu = false;
        job.phase = 'queued';
      }
    }
  }

  // ------------------------------------------------------------ frame
  update(dt, t, workers = []) {
    this.t = t;
    // new customers at the bar
    for (const s of [...this.roof.stools, ...this.roof.barStands]) {
      const p = s.occupant;
      if (!p || p === 'ceo' || this.service.get(s)) continue;
      if (p.mode === 'idle' && p.spot === s && !p.hasDrink && !p.servedAt && !this.leisure?.drinkOf(p)) {
        this.addJob(s, p, null, true);
        p.servedAt = t;
      }
    }
    for (const s of this.roof.stools) if (s.occupant && s.occupant !== 'ceo' && s.occupant.spot !== s && s.occupant.servedAt) s.occupant.servedAt = 0;

    this.checkReaders();
    this.updateBarman(dt);
    // clean glasses come back from the washer
    for (const g of this.roof.glassSlots) if (!g.mesh.visible && t > g.back) g.mesh.visible = true;
    // an ashtray nobody uses any more goes back on the stack after a while
    for (const a of [...(this.counterAshtrays || [])]) {
      if (a.userData.rests.some((r) => r.taken)) { a.userData.idle = 0; continue; }
      a.userData.idle = (a.userData.idle || 0) + dt;
      if (a.userData.idle > 40) {
        this.counterAshtrays = this.counterAshtrays.filter((x) => x !== a);
        const stack = this.roof.cigarStation.ashStack;
        if (a.userData.home) {
          a.position.copy(a.userData.home);
          stack.push(a);
        } else a.removeFromParent();
      }
    }

    // guests (and workers who are up here) wander — never the same routine
    const movers = [...this.guests, ...workers.filter((w) => w.floor === 3 && w.room === 'rooftop' && !w.trip && !w.invited)];
    for (const p of movers) {
      if (p.mode !== 'idle' && p.mode !== 'swim') continue;
      if (p.spot && this.service.get(p.spot)) continue; // waiting for a drink
      if (p.nextAt == null) p.nextAt = t + rand(30, 90);
      if (t < p.nextAt) continue;
      p.nextAt = t + (p.kind === 'guest' ? rand(25, 90) : rand(50, 140));
      const next = this.spotFor(p, p.spot);
      if (!next) continue;
      p.servedAt = 0;
      p.goToSpot(next, 3);
    }
    for (const p of this.guests) p.update(dt, t);
    this.barman.update(dt, t);
  }
}

function menuOnCounter(at) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.3), new THREE.MeshStandardMaterial({ color: '#3a1d10', roughness: 0.5 }));
  g.add(m);
  const gold = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.03), new THREE.MeshStandardMaterial({ color: '#c9a15e', metalness: 1, roughness: 0.3 }));
  gold.rotation.x = -Math.PI / 2;
  gold.position.set(0, 0.007, -0.06);
  g.add(gold);
  g.position.set(at.x - 0.05, at.y + 0.006, at.z + 0.18);
  g.rotation.y = Math.PI / 2;
  return g;
}
