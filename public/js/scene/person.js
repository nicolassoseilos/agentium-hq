// Moves a character around the tower: walking routes along the front walkway,
// waiting for and riding the lift, sitting at spots, swimming, using the phone
// and carrying a drink.
import * as THREE from 'three';
import { floorY, LANE_Z, LIFT, POOL_CUT, roomAt } from './layout.js';
import { LIFT_WAIT_X } from './lift.js';
import { makeGlass } from './drinks.js';

const SPEED = 1.3;
// where people wait for the lift: a front row of four, then a second row (room for the whole team)
const WAIT_SPOTS = [[-0.3, -1.0], [-0.3, -0.35], [-0.3, 0.35], [-0.3, 1.0], [-1.0, -0.7], [-1.0, 0.0], [-1.0, 0.7], [-1.6, -0.35], [-1.6, 0.35]];
let waitIndex = 0;

export class Person {
  /**
   * @param character  from makeCharacter
   * @param world      { lift, spotFor(person, roomId) -> spot }
   */
  constructor(character, world, { name, role, kind = 'worker', vibe = false } = {}) {
    this.c = character;
    this.id = character.id;
    this.world = world;
    this.name = name;
    this.role = role;
    this.kind = kind;
    this.vibe = vibe;
    this.floor = 0;
    this.pos = new THREE.Vector3();
    this.face = 0;
    this.mode = 'idle';
    this.path = [];
    this.onArrive = null;
    this.room = null;
    this.spot = null;
    this.walkPhase = 0;
    this.trip = null;
    [this.waitDx, this.waitDz] = WAIT_SPOTS[waitIndex++ % WAIT_SPOTS.length];
    this.phone = null;
    this.drinkUntil = 0;
    this.sipAt = 0;
    this.swim = null;
    this.script = null; // externally driven pose (barman)
    this.t = 0;
  }

  // ------------------------------------------------------------ placement
  placeAt(spot) {
    this.spot = spot;
    this.room = spot.room;
    this.floor = spot.floor;
    this.pos.copy(spot.pos);
    this.face = spot.face;
    this.mode = spot.type === 'swim' ? 'swim' : 'idle';
    if (this.mode === 'swim') this.startSwim(true);
  }

  get moving() {
    return this.mode !== 'idle' && this.mode !== 'swim';
  }

  get presentRoom() {
    if (this.mode === 'ride' || this.mode === 'waitLift' || this.mode === 'board' || this.mode === 'alight') return null;
    return this.floor === 3 ? 'rooftop' : roomAt(this.floor, this.pos.x)?.id ?? null;
  }

  // ------------------------------------------------------------ requests
  /** Go to a room; the world picks the spot (a desk, a stool, a sunbed…). */
  goToRoom(roomId, floor) {
    const spot = this.world.spotFor(this, roomId);
    if (!spot) return false;
    this.goToSpot(spot, floor);
    return true;
  }

  goToSpot(spot, floor = spot.floor) {
    const leaving = this.spot;
    this.trip = { spot, floor };
    if (this.mode === 'swim') {
      // swim back to the steps first
      this.swim.leaving = true;
      return;
    }
    const exit = this.exitPoints();
    if (leaving && leaving !== spot) leaving.release?.(this);
    this.spot = null;
    if (floor === this.floor) {
      this.walk([...exit, ...this.entryPoints(spot)], () => this.arrive(spot));
    } else {
      const y = this.pos.y;
      const lift = this.world.lift;
      const dir = Math.sign(floor - this.floor);
      const wait = new THREE.Vector3(LIFT_WAIT_X + this.waitDx, y, LANE_Z + this.waitDz);
      const button = lift.buttonSpot(this.floor);
      const callAndWait = () => {
        lift.approach(this, null);
        lift.call(this, this.floor, floor);
        this.walk([wait], () => (this.mode = 'waitLift'));
      };
      // walk to the call button and press it (unless it is already lit)
      this.walk([...exit, new THREE.Vector3(LIFT_WAIT_X - 0.6, y, LANE_Z), button], () => {
        if (lift.isLit(this.floor, dir)) return callAndWait();
        this.mode = 'press';
        this.pressUntil = this.t + 0.9;
        this.pressDone = callAndWait;
      });
      this.liftBound = true;
    }
  }

  arrive(spot) {
    this.spot = spot;
    this.room = spot.room;
    this.trip = null;
    if (spot.type === 'swim') return this.startSwim(false);
    this.mode = 'idle';
    spot.onArrive?.(this);
  }

  exitPoints() {
    const y = this.pos.y;
    const pts = [];
    const s = this.spot;
    if (s?.via) for (let i = s.via.length - 1; i >= 0; i--) pts.push(pt(s.via[i], y));
    else if (Math.abs(this.pos.z - LANE_Z) > 0.3) pts.push(new THREE.Vector3(this.pos.x, y, LANE_Z));
    return pts;
  }

  entryPoints(spot) {
    const y = floorY(spot.floor);
    const pts = [];
    if (spot.via?.length) {
      pts.push(new THREE.Vector3(spot.via[0].x, y, LANE_Z));
      for (const v of spot.via) pts.push(pt(v, y));
    } else pts.push(new THREE.Vector3(spot.pos.x, y, LANE_Z));
    pts.push(spot.pos.clone());
    return pts;
  }

  /**
   * A message has arrived: stop, take the phone out of the pocket, read it,
   * type the reply (done() is called when it is sent), put the phone away.
   */
  usePhone(seconds, done) {
    if (this.phone) {
      // already on the phone: just add the typing time
      this.phone.queue.push({ seconds, done });
      return;
    }
    this.phone = { stage: 'pocket', until: this.t + 0.8, seconds, done, queue: [] };
    this.c.showPhone('pocket');
  }

  updatePhone() {
    const ph = this.phone;
    if (!ph || this.t < ph.until) return;
    if (ph.stage === 'pocket') {
      ph.stage = 'read';
      ph.until = this.t + 1.3;
    } else if (ph.stage === 'read') {
      ph.stage = 'type';
      ph.until = this.t + ph.seconds;
    } else if (ph.stage === 'type') {
      ph.done?.(); // the reply is sent
      const next = ph.queue.shift();
      if (next) {
        ph.stage = 'read';
        ph.seconds = next.seconds;
        ph.done = next.done;
        ph.until = this.t + 0.8;
      } else {
        ph.stage = 'away';
        ph.until = this.t + 0.7;
        this.c.showPhone('pocket');
        return;
      }
    } else if (ph.stage === 'away') {
      this.phone = null;
      this.c.showPhone(false);
      return;
    }
    this.c.showPhone(ph.stage);
  }

  get onPhone() {
    return !!this.phone;
  }

  giveDrink(type, seconds = 150 + Math.random() * 160) {
    const glass = makeGlass(type);
    this.c.holdRight(glass, 'glass');
    this.drinkUntil = this.t + seconds;
    this.drinkType = type;
    return glass;
  }

  takeGlass(glass) {
    this.c.holdRight(glass, 'glass');
    this.drinkUntil = this.t + 150 + Math.random() * 160;
  }

  dropDrink() {
    this.c.holdRight(null);
    this.drinkType = null;
  }

  get hasDrink() {
    return !!this.c.rightItem && this.c.rightItem.userData.type;
  }

  // ------------------------------------------------------------ swimming
  startSwim(instant) {
    this.mode = 'swim';
    const water = POOL_CUT;
    const floorYw = floorY(3) - water.depth + 0.04;
    this.swim = { target: null, pause: instant ? Math.random() * 6 : 2, leaving: false, floorY: floorYw };
    this.pos.y = floorYw;
    if (this.hasDrink) this.dropDrink();
  }

  updateSwim(dt, t) {
    const s = this.swim;
    const w = POOL_CUT;
    const margin = 1.0;
    if (s.leaving) {
      // swim back to the bottom of the steps
      const exit = new THREE.Vector3(0, s.floorY, w.z1 - 1.5);
      if (this.moveFlat(exit, dt, 0.45)) {
        const deck = floorY(3);
        this.mode = 'walk';
        this.spot?.release?.(this);
        this.spot = null;
        const trip = this.trip;
        const up = [new THREE.Vector3(0, deck - 0.6, w.z1 - 0.7), new THREE.Vector3(0, deck, w.z1 + 0.35), new THREE.Vector3(0, deck, LANE_Z)];
        this.walk(up, () => {
          this.mode = 'idle';
          if (trip) this.goToSpot(trip.spot, trip.floor);
        });
      } else {
        this.walkPhase += dt * 3;
        this.c.pose('walk', t, { phase: this.walkPhase });
      }
      return;
    }
    if (s.pause > 0) {
      s.pause -= dt;
      this.c.pose('wade', t, { vibe: this.vibe });
      return;
    }
    if (!s.target) {
      s.target = new THREE.Vector3(w.x0 + margin + Math.random() * (w.x1 - w.x0 - margin * 2), s.floorY, w.z0 + margin + 0.6 + Math.random() * (w.z1 - w.z0 - margin * 2 - 1.2));
    }
    // no swimming: they wade slowly through the water, turn around, stand and chat
    if (this.moveFlat(s.target, dt, 0.35)) {
      s.target = null;
      s.pause = 4 + Math.random() * 12;
    }
    this.walkPhase += dt * 3.2;
    this.c.pose('walk', t, { phase: this.walkPhase });
  }

  moveFlat(target, dt, speed) {
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    const v = Math.min(d, speed * dt);
    this.pos.x += (dx / d) * v;
    this.pos.z += (dz / d) * v;
    this.turnTo(Math.atan2(dx, dz), dt * 1.2);
    return false;
  }

  // ------------------------------------------------------------ frame
  update(dt, t) {
    this.t = t;
    const lift = this.world.lift;
    this.updatePhone();
    const paused = !!this.phone && (this.mode === 'walk' || this.mode === 'swim');
    switch (paused ? 'paused' : this.mode) {
      case 'paused':
        break;
      case 'press':
        this.turnTo(Math.PI / 2, dt);
        if (t >= this.pressUntil) {
          const cb = this.pressDone;
          this.pressDone = null;
          cb?.();
        }
        break;
      case 'walk':
        this.step(dt);
        if (this.liftBound && this.path.length) {
          const last = this.path[this.path.length - 1];
          lift.approach(this, this.floor, Math.hypot(last.x - this.pos.x, last.z - this.pos.z) + (this.path.length - 1) * 2);
        }
        break;
      case 'waitLift': {
        this.turnTo(-Math.PI / 2 + Math.PI, dt); // face the doors (+x)
        const slot = lift.boardingSlot(this);
        if (slot) {
          this.mode = 'board';
          this.liftBound = false;
          this.path = [new THREE.Vector3(LIFT.doorX - 0.4, this.pos.y, LIFT.z), new THREE.Vector3(LIFT.doorX + 0.6, this.pos.y, LIFT.z), slot];
          this.onArrive = () => {
            lift.boarded(this);
            this.mode = 'ride';
          };
        }
        break;
      }
      case 'board':
        this.step(dt);
        break;
      case 'ride':
        lift.riderPosition(this, this.pos);
        this.turnTo(-Math.PI / 2, dt);
        if (lift.canAlight(this)) {
          lift.startAlighting(this);
          this.floor = this.trip.floor;
          this.mode = 'alight';
          const y = floorY(this.floor);
          this.pos.y = y;
          this.path = [new THREE.Vector3(LIFT.doorX + 0.5, y, LIFT.z), new THREE.Vector3(LIFT.doorX - 0.6, y, LIFT.z), new THREE.Vector3(LIFT_WAIT_X - 0.6, y, LANE_Z)];
          this.onArrive = () => {
            lift.alighted(this);
            const spot = this.trip.spot;
            this.walk(this.entryPoints(spot), () => this.arrive(spot));
          };
        }
        break;
      case 'alight':
        this.step(dt);
        break;
      case 'swim':
        this.updateSwim(dt, t);
        break;
      case 'idle':
        if (this.spot) this.turnTo(this.spot.face, dt);
        break;
      default:
        break;
    }

    // drink timer
    if (this.drinkUntil && t >= this.drinkUntil && this.hasDrink) {
      this.dropDrink();
      this.drinkUntil = 0;
    }
    // sipping a drink in hand: up to the lips, tilt, sip (the level goes down), lower it
    let sip = false;
    if (this.hasDrink && !this.tableSip && !this.phone && this.mode === 'idle') {
      if (this.sipStart == null) {
        this.nextSip ??= t + 3 + Math.random() * 8;
        if (t > this.nextSip) {
          this.sipStart = t;
          this.sipFrom = this.c.rightItem?.userData.level?.() ?? 1;
        }
      }
      if (this.sipStart != null) {
        const k = t - this.sipStart;
        const g = this.c.rightItem;
        sip = k < 2.1;
        const tilt = k < 0.55 ? 0 : k < 0.85 ? (k - 0.55) / 0.3 : k < 1.75 ? 1 : k < 2.05 ? (2.05 - k) / 0.3 : 0;
        this.c.setTilt(-1.05 * tilt);
        if (g?.userData.setFill && k > 0.85) g.userData.setFill(Math.max(0, this.sipFrom - 0.1 * Math.min(1, (k - 0.85) / 0.9)));
        if (k > 2.7) {
          this.sipStart = null;
          this.nextSip = t + 7 + Math.random() * 12;
          this.c.setTilt(0);
          if (g?.userData.empty?.()) this.dropDrink(); // finished: the empty glass goes
        }
      }
    } else if (this.sipStart != null && !this.tableSip) {
      this.sipStart = null;
      this.c.setTilt(0);
    }
    if (this.sipping) sip = true;

    // pose
    if (this.mode === 'press') {
      this.c.pose('press', t);
    } else if (paused) {
      this.c.pose(this.mode === 'swim' ? 'wade' : 'stand', t);
    } else if (this.script) {
      this.c.pose(this.script.pose, t, { reach: this.script.reach, vibe: this.vibe && this.script.vibe });
    } else if (this.mode === 'walk' || this.mode === 'board' || this.mode === 'alight') {
      this.walkPhase += dt * 7.5;
      this.c.pose('walk', t, { phase: this.walkPhase });
    } else if (this.mode === 'idle' && this.spot) {
      // on the phone they stop working (no typing at the desk meanwhile)
      let pose = this.spot.pose || 'stand';
      if (this.phone && pose === 'sit-type') pose = 'sit';
      if (this.phone && pose === 'stand-work') pose = 'stand';
      this.c.pose(pose, t, { vibe: this.vibe && !this.phone, sip: (sip || this.sipping) && !this.phone, puff: this.puffing, seat: this.spot.seat });
    } else if (this.mode !== 'swim') {
      this.c.pose('stand', t, { vibe: this.vibe && this.mode !== 'ride', sip });
    }
    this.c.apply(dt);
    this.c.root.position.copy(this.pos);
    this.c.root.rotation.y = this.face;
    this.c.finish();
  }

  walk(points, done) {
    this.path = points;
    this.onArrive = done;
    this.mode = 'walk';
  }

  step(dt) {
    const target = this.path[0];
    if (!target) {
      const cb = this.onArrive;
      this.onArrive = null;
      cb?.();
      return;
    }
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.04) {
      this.pos.x = target.x;
      this.pos.z = target.z;
      this.pos.y = target.y;
      this.path.shift();
      return;
    }
    const v = Math.min(d, SPEED * dt);
    this.pos.x += (dx / d) * v;
    this.pos.z += (dz / d) * v;
    // ease height changes (pool steps)
    this.pos.y += (target.y - this.pos.y) * Math.min(1, v / d);
    this.turnTo(Math.atan2(dx, dz), dt * 1.6);
  }

  turnTo(angle, dt) {
    const diff = ((((angle - this.face + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    this.face += diff * Math.min(1, dt * 8);
  }
}

function pt(v, y) {
  return new THREE.Vector3(v.x, v.y ?? y, v.z);
}
