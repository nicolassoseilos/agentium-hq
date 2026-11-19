// Moves a character around the tower: walking routes along the front walkway,
// waiting for and riding the lift, sitting at spots, swimming, using the phone
// and carrying a drink.
import * as THREE from 'three';
import { floorY, LANE_Z, LIFT, POOL_CUT, roomAt } from './layout.js';
import { LIFT_WAIT_X } from './lift.js';
import { makeGlass } from './drinks.js';

const SPEED = 1.3;
const WAIT_DZ = [-1.0, -0.35, 0.35, 1.0];
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
    this.waitDz = WAIT_DZ[waitIndex++ % WAIT_DZ.length];
    this.phoneUntil = 0;
    this.phoneDone = null;
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
      const wait = new THREE.Vector3(LIFT_WAIT_X - 0.3, y, LANE_Z + this.waitDz);
      this.walk([...exit, new THREE.Vector3(LIFT_WAIT_X - 0.6, y, LANE_Z), wait], () => {
        this.world.lift.approach(this, null);
        this.world.lift.call(this, this.floor, floor);
        this.mode = 'waitLift';
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

  usePhone(seconds, done) {
    this.phoneUntil = this.t + seconds;
    this.phoneDone = done;
    this.c.showPhone(true);
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
      if (this.moveFlat(exit, dt, 0.7)) {
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
      } else this.c.pose('swim', t, { phase: t * 3.2 });
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
    if (this.moveFlat(s.target, dt, 0.55)) {
      s.target = null;
      s.pause = 3 + Math.random() * 10;
    }
    this.c.pose('swim', t, { phase: t * 3 });
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
    switch (this.mode) {
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

    // phone & drink timers
    if (this.phoneUntil && t >= this.phoneUntil) {
      this.phoneUntil = 0;
      this.c.showPhone(false);
      const cb = this.phoneDone;
      this.phoneDone = null;
      cb?.();
    }
    if (this.drinkUntil && t >= this.drinkUntil && this.hasDrink) {
      this.dropDrink();
      this.drinkUntil = 0;
    }
    let sip = false;
    if (this.hasDrink && this.mode === 'idle') {
      if (t > this.sipAt + 9 + (this.id.length % 5)) this.sipAt = t;
      sip = t - this.sipAt < 1.4;
    }

    // pose
    if (this.script) {
      this.c.pose(this.script.pose, t, { reach: this.script.reach, vibe: this.vibe && this.script.vibe });
    } else if (this.mode === 'walk' || this.mode === 'board' || this.mode === 'alight') {
      this.walkPhase += dt * 7.5;
      this.c.pose('walk', t, { phase: this.walkPhase });
    } else if (this.mode === 'idle' && this.spot) {
      this.c.pose(this.spot.pose || 'stand', t, { vibe: this.vibe, sip, seat: this.spot.seat });
    } else if (this.mode !== 'swim') {
      this.c.pose('stand', t, { vibe: this.vibe && this.mode !== 'ride' });
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
