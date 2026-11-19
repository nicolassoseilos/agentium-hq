// Life on the rooftop: the guests, where everyone goes (random, never a
// routine), and the barman who really serves drinks — menu, bottle from the
// back bar, glass, pour, slide it over, bottle back on the shelf.
import * as THREE from 'three';
import { Person } from './person.js';
import { makeCharacter, guestLook, GUEST_NAMES } from './people.js';
import { DRINKS, makeGlass } from './drinks.js';
import { floorY } from './layout.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const GUEST_TYPES = { sunbed: 3, edge: 2.2, swim: 1.8, barstand: 1.6, stand: 1.6, cabana: 1.1, sofa: 1 };
const WORKER_TYPES = { sunbed: 3, barstand: 1.4, sofa: 1.4, stand: 1.4, cabana: 1 };
const GUEST_DRINKS = ['champagne', 'rose', 'martini', 'gintonic', 'wine', 'champagne'];
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
    this.ceoGlass = null;
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
    if (person.hasDrink) weights.barstand = 0;
    else weights.barstand = (weights.barstand || 1) * 1.8;
    // bar stools are kept for the CEO and whoever he invites
    const free = this.spots.filter((s) => !s.occupant && !s.reserved && s !== exclude && weights[s.type]);
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
    if (this.ceoGlass) {
      this.scene.remove(this.ceoGlass);
      this.ceoGlass = null;
    }
    this.ceoMenu && this.scene.remove(this.ceoMenu);
    this.ceoMenu = null;
    this.ceoSpot = null;
  }

  /** The CEO wants this seat: whoever is there gets up and goes elsewhere. */
  evict(spot) {
    const p = spot.occupant;
    if (!p || p === 'ceo' || p.invited) return;
    const next = this.spotFor(p, spot);
    spot.occupant = null;
    if (next) p.goToSpot(next, 3);
  }

  /** Invite an agent to sit next to the CEO at the bar. */
  inviteToBar(person) {
    const me = this.ceoSpot;
    if (!me || me.type !== 'stool') return null;
    const stools = this.roof.stools;
    const i = stools.indexOf(me);
    const order = [i + 1, i - 1, i + 2, i - 2, i + 3, i - 3].filter((k) => k >= 0 && k < stools.length);
    const seat = order.map((k) => stools[k]).find((s) => !s.occupant);
    if (!seat) return null;
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

  runJob(job) {
    const b = this.barman;
    const spot = job.spot;
    const customer = job.customer;
    const serve = spot.serve;
    const stillThere = () => spot.occupant === customer;
    const abort = () => this.finishJob(job, true);

    const toBottle = () => {
      if (!stillThere()) return abort();
      const d = DRINKS[job.drink] || DRINKS.whisky;
      const slot = this.roof.bottleSlots.find((s) => !s.taken && s.kind === d.bottle) || this.roof.bottleSlots.find((s) => !s.taken);
      job.bottleSlot = slot;
      job.phase = 'bottle';
      this.barmanTo({ x: this.roof.bar.backX - 0.72, z: slot.z }, Math.PI / 2, () => {
        this.timed('reach', 0.9, null, () => {
          slot.taken = true;
          b.c.holdRight(slot.bottle, 'bottle');
          job.phase = 'carry';
          toServe();
        }, slot.reach);
      });
    };

    const toServe = () => {
      this.barmanTo(serve, spot.serveFace ?? -Math.PI / 2, () => {
        // a fresh glass from under the counter
        this.timed('bend', 0.6, null, () => {
          const glass = makeGlass(job.drink);
          glass.userData.setFill(0);
          glass.position.copy(spot.glassStart);
          this.scene.add(glass);
          job.glass = glass;
          // pour
          const start = 0;
          this.timed('pour', 2.4, (k) => {
            b.c.setTilt(Math.min(2.0, k * 5) * (k < 0.85 ? 1 : (1 - k) / 0.15));
            glass.userData.setFill(Math.max(0, (k - 0.2) / 0.65));
          }, () => {
            b.c.setTilt(0);
            glass.userData.setFill(1);
            void start;
            slide();
          });
        });
      });
    };

    const slide = () => {
      const glass = job.glass;
      const from = glass.position.clone();
      const to = spot.counter.clone();
      this.timed('hand', 0.8, (k) => glass.position.lerpVectors(from, to, k * k * (3 - 2 * k)), () => {
        if (customer === 'ceo') {
          if (this.ceoSpot === spot) {
            if (this.ceoGlass) this.scene.remove(this.ceoGlass);
            this.ceoGlass = glass;
            this.emit('served', { drink: job.drink });
          } else this.scene.remove(glass);
        } else if (stillThere()) {
          this.scene.remove(glass);
          customer.takeGlass(glass);
          // standing at the bar: take the drink and go; seated guests of the CEO stay
          customer.nextAt = this.t + (spot.type === 'barstand' ? rand(3, 8) : rand(12, 45));
        } else this.scene.remove(glass);
        job.phase = 'return';
        returnBottle();
      });
    };

    const returnBottle = () => {
      const slot = job.bottleSlot;
      this.barmanTo({ x: this.roof.bar.backX - 0.72, z: slot.z }, Math.PI / 2, () => {
        this.timed('reach', 0.8, null, () => {
          this.returnBottleNow(slot);
          this.finishJob(job);
        }, slot.reach);
      });
    };

    if (job.withMenu) {
      job.phase = 'menu';
      b.c.showMenu(true);
      this.barmanTo(serve, spot.serveFace ?? -Math.PI / 2, () => {
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
    toBottle();
    this.continueJob = null;
    this._toBottle = toBottle;
    job.toBottle = toBottle;
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
      if (p.mode === 'idle' && p.spot === s && !p.hasDrink && !p.servedAt) {
        this.addJob(s, p, null, true);
        p.servedAt = t;
      }
    }
    for (const s of this.roof.stools) if (s.occupant && s.occupant !== 'ceo' && s.occupant.spot !== s && s.occupant.servedAt) s.occupant.servedAt = 0;

    this.checkReaders();
    this.updateBarman(dt);

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
