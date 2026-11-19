// The Agentium lift — a real enclosed elevator on the right side of the tower.
// Solid shaft (cut open at the front like the rest of the building), a walnut
// and brass cab, brass landing doors on every floor and lit floor indicators.
//
// It works like a normal collective lift:
//  - up to 4 people at a time
//  - it stops on the way for anyone waiting to travel in the same direction
//  - it holds the doors for someone who is already walking up to it
//    (unless they are far away)
import * as THREE from 'three';
import { M } from '../core/materials.js';
import { box, cyl } from '../core/build.js';
import { BASE, SLAB, LIFT, floorY } from './layout.js';

const CAPACITY = 4;
const FLOORS = 4;
const NAMES = ['B', '1', '2', 'R'];
const SPEED = 2.4, ACCEL = 1.3;
const SLOT = [[0.42, -0.5], [0.42, 0.5], [-0.42, -0.5], [-0.42, 0.5]]; // x (towards door is -) , z

export class Elevator {
  constructor(parent) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.build();
    this.y = floorY(0);
    this.v = 0;
    this.dir = 0; // 1 up, -1 down, 0 idle
    this.floor = 0; // floor the cab is at / passing
    this.state = 'idle'; // idle | moving | open
    this.target = null;
    this.doorT = 0;
    this.openTimer = 0;
    this.riders = new Map(); // person -> {dest, slot, phase: 'boarding'|'in'|'alighting'}
    this.waiting = []; // {person, from, to}
    this.approaching = new Map(); // person -> {floor, dist}
  }

  // ------------------------------------------------------------ visuals
  build() {
    const g = this.group;
    const x = LIFT.x, z = LIFT.z;
    const half = LIFT.w / 2 + 0.3;
    const top = floorY(3) + 3.9;
    this.half = half;
    const clad = new THREE.MeshStandardMaterial({ color: '#1c2333', metalness: 0.45, roughness: 0.5 });
    // shaft: right and back walls solid, front cut away (cutaway view), building side has the landing doors
    box(0.16, top - BASE, half * 2 + 0.16, clad, x + half, BASE, z, g);
    box(half * 2, top - BASE, 0.16, clad, x, BASE, z - half, g);
    // inner shaft face (dark) so the cut reads clearly
    box(0.02, top - BASE, half * 2, M.black, x + half - 0.09, BASE, z, g, { cast: false });
    // brass floor bands + cut-edge trims
    for (let f = 0; f <= 3; f++) {
      const y = floorY(f) - SLAB;
      box(half * 2 + 0.2, SLAB, 0.2, M.navySteel, x, y, z + half, g);
      box(0.2, SLAB, half * 2 + 0.2, M.navySteel, x + half, y, z, g);
      box(half * 2 + 0.24, 0.05, 0.05, M.brass, x, y + SLAB, z + half + 0.08, g);
    }
    box(0.08, top - BASE, 0.08, M.brass, x + half, BASE, z + half, g);
    box(0.08, top - BASE, 0.08, M.brass, x - half + 0.04, BASE, z + half, g);
    // machine room on top
    box(half * 2 + 0.3, 0.9, half * 2 + 0.3, clad, x, top, z, g);
    box(half * 2 + 0.34, 0.05, half * 2 + 0.34, M.brass, x, top + 0.9, z, g);
    // building-side wall between landing doors
    for (let f = 0; f <= 3; f++) {
      const y0 = floorY(f);
      const yNext = f < 3 ? floorY(f + 1) - SLAB : top;
      box(0.16, yNext - (y0 + 2.9), half * 2, clad, x - half, y0 + 2.9, z, g);
    }

    // ---- landing doors (brushed steel, two sliding leaves) + call buttons + floor indicators
    const steel = new THREE.MeshStandardMaterial({ color: '#c9ced4', metalness: 1, roughness: 0.32 });
    const steelDark = new THREE.MeshStandardMaterial({ color: '#7d838a', metalness: 1, roughness: 0.4 });
    this.steel = steel;
    this.landing = [];
    this.indicators = [];
    this.buttons = [];
    const doorX = LIFT.doorX + 0.2;
    for (let f = 0; f < FLOORS; f++) {
      const y0 = floorY(f);
      const leaves = [];
      for (const s of [-1, 1]) {
        const leaf = new THREE.Group();
        box(0.04, 2.66, LIFT.w / 2 - 0.02, steel, 0, 0, 0, leaf, { cast: false });
        box(0.045, 0.04, LIFT.w / 2 - 0.02, steelDark, 0, 1.0, 0, leaf, { cast: false }); // kick line
        box(0.046, 2.66, 0.012, steelDark, 0, 0, (-s * (LIFT.w / 2 - 0.03)) / 2, leaf, { cast: false }); // meeting edge
        leaf.position.set(doorX, y0, z + (s * LIFT.w) / 4);
        leaf.userData.side = s;
        g.add(leaf);
        leaves.push(leaf);
        // pocket panels the leaves slide behind
        box(0.06, 2.75, LIFT.w / 2, steelDark, doorX + 0.08, y0, z + s * (LIFT.w * 0.75 + 0.02), g, { cast: false });
      }
      this.landing.push(leaves);
      // call buttons on the door jamb, facing into the room
      const panel = new THREE.Group();
      panel.position.set(LIFT.doorX - 0.13, y0 + 1.15, LIFT.z - LIFT.w / 2 - 0.13);
      box(0.02, 0.32, 0.12, steel, 0, -0.16, 0, panel, { cast: false });
      const mk = (yy) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 20), new THREE.MeshStandardMaterial({ color: '#d9dde2', metalness: 0.6, roughness: 0.3, emissive: '#ffcf7a', emissiveIntensity: 0 }));
        m.rotation.z = Math.PI / 2;
        m.position.set(-0.015, yy, 0);
        panel.add(m);
        return m;
      };
      this.buttons.push({ up: f < FLOORS - 1 ? mk(0.06) : null, down: f > 0 ? mk(-0.06) : null });
      g.add(panel);
      // indicator above the door (faces into the building)
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 96;
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.23), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      plate.position.set(x - half - 0.1, y0 + 3.02, z);
      plate.rotation.y = -Math.PI / 2;
      g.add(plate);
      box(0.03, 0.29, 0.68, M.brass, x - half - 0.08, y0 + 2.875, z, g, { cast: false });
      this.indicators.push({ c, tex, last: '' });
    }

    // ---- cab
    const cab = (this.cab = new THREE.Group());
    const cw = LIFT.w - 0.1;
    const walnut = M.walnutPanel;
    box(cw, 0.12, cw, M.brass, 0, -0.12, 0, cab);
    box(cw - 0.04, 0.02, cw - 0.04, M.marbleDark, 0, 0, 0, cab, { cast: false });
    box(cw, 0.14, cw, M.charcoal, 0, 2.78, 0, cab);
    const lamp = box(cw - 0.6, 0.02, cw - 0.6, M.warmLight, 0, 2.76, 0, cab, { cast: false });
    lamp.receiveShadow = false;
    // back (+x) and side (-z) walls in walnut, mirror on the back
    box(0.06, 2.78, cw, walnut, cw / 2 - 0.03, 0, 0, cab);
    box(cw, 2.78, 0.06, walnut, 0, 0, -cw / 2 + 0.03, cab);
    const mirror = new THREE.MeshStandardMaterial({ color: '#6b5a48', metalness: 1, roughness: 0.06 });
    box(0.01, 1.5, cw * 0.6, mirror, cw / 2 - 0.065, 0.95, 0, cab, { cast: false });
    box(0.05, 0.05, cw * 0.8, M.brass, cw / 2 - 0.12, 0.95, 0, cab); // handrail
    box(cw * 0.8, 0.05, 0.05, M.brass, 0, 0.95, -cw / 2 + 0.12, cab);
    // front (+z) is cut away for the cutaway view; a low brass rail marks the edge
    box(cw, 0.05, 0.05, M.brass, 0, 2.7, cw / 2, cab);
    box(0.06, 2.78, 0.06, M.brass, cw / 2, 0, cw / 2, cab);
    box(0.06, 2.78, 0.06, M.brass, -cw / 2, 0, cw / 2, cab);
    // car doors on the building side (-x), brushed steel
    this.carDoors = [];
    for (const s of [-1, 1]) {
      const d = box(0.04, 2.7, cw / 2 - 0.02, steel, -cw / 2 + 0.03, 0, (s * cw) / 4, cab, { cast: false });
      d.userData.side = s;
      this.carDoors.push(d);
    }
    // in-car floor display
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    this.carDisplay = { c, tex: new THREE.CanvasTexture(c), last: '' };
    this.carDisplay.tex.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map: this.carDisplay.tex, toneMapped: false }));
    disp.position.set(cw / 2 - 0.07, 2.35, 0);
    disp.rotation.y = -Math.PI / 2;
    cab.add(disp);
    this.light = new THREE.PointLight('#ffd9a0', 3, 4.5, 2);
    this.light.position.set(0, 2.4, 0);
    cab.add(this.light);
    cab.position.set(x, floorY(0), z);
    g.add(cab);
    this.cw = cw;
    this.top = top;
  }

  drawIndicator(ind, label, arrow, open) {
    const key = `${label}${arrow}${open}`;
    if (ind.last === key) return;
    ind.last = key;
    const g = ind.c.getContext('2d');
    const w = ind.c.width, h = ind.c.height;
    g.fillStyle = '#0b0906';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffcf7a';
    g.font = `600 ${h * 0.62}px Manrope, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, w * 0.62, h * 0.54);
    if (arrow) {
      g.beginPath();
      const ax = w * 0.25, ay = h / 2, s = h * 0.22;
      if (arrow > 0) { g.moveTo(ax, ay - s); g.lineTo(ax + s, ay + s * 0.7); g.lineTo(ax - s, ay + s * 0.7); }
      else { g.moveTo(ax, ay + s); g.lineTo(ax + s, ay - s * 0.7); g.lineTo(ax - s, ay - s * 0.7); }
      g.fill();
    }
    ind.tex.needsUpdate = true;
  }

  // ------------------------------------------------------------ passenger API
  /** Ask for a ride (the person is at, or walking to, the lift on `from`). */
  call(person, from, to) {
    if (this.riders.has(person) || this.waiting.some((w) => w.person === person)) return;
    this.waiting.push({ person, from, to });
  }

  /** Is the call button for this direction lit on this floor? */
  isLit(floor, dir) {
    return this.waiting.some((w) => w.from === floor && Math.sign(w.to - w.from) === dir);
  }

  /** Where to stand to press the call button on a floor. */
  buttonSpot(floor) {
    return new THREE.Vector3(LIFT.doorX - 0.62, floorY(floor), LIFT.z - LIFT.w / 2 - 0.13);
  }

  /** Someone is walking towards the lift on `floor`; dist in metres (null to clear). */
  approach(person, floor, dist) {
    if (dist == null) this.approaching.delete(person);
    else this.approaching.set(person, { floor, dist });
  }

  /** Can this waiting person step in now? Returns the slot position (world) or null. */
  boardingSlot(person) {
    const w = this.waiting.find((q) => q.person === person);
    if (!w || this.state !== 'open' || this.floor !== w.from || this.doorT < 0.9) return null;
    if (this.riders.size >= CAPACITY) return null;
    const wantDir = Math.sign(w.to - w.from);
    if (this.dir !== 0 && this.dir !== wantDir && this.hasRidersGoing(this.dir)) return null;
    // take a free slot
    const used = new Set([...this.riders.values()].map((r) => r.slot));
    const slot = [0, 1, 2, 3].find((i) => !used.has(i));
    this.waiting = this.waiting.filter((q) => q !== w);
    this.riders.set(person, { dest: w.to, slot, phase: 'boarding' });
    if (this.dir === 0) this.dir = wantDir;
    return this.slotPosition(slot);
  }

  slotPosition(slot) {
    const [sx, sz] = SLOT[slot];
    return new THREE.Vector3(LIFT.x + sx, this.y, LIFT.z + sz);
  }

  /** Person is now standing inside. */
  boarded(person) {
    const r = this.riders.get(person);
    if (r) r.phase = 'in';
  }

  /** True when the cab is at this rider's floor with the doors open. */
  canAlight(person) {
    const r = this.riders.get(person);
    return r && r.phase === 'in' && this.state === 'open' && this.floor === r.dest && this.doorT > 0.9;
  }

  startAlighting(person) {
    const r = this.riders.get(person);
    if (r) r.phase = 'alighting';
  }

  /** Person has stepped out onto the landing. */
  alighted(person) {
    this.riders.delete(person);
  }

  riderPosition(person, out) {
    const r = this.riders.get(person);
    if (!r) return null;
    const [sx, sz] = SLOT[r.slot];
    return out.set(LIFT.x + sx, this.y, LIFT.z + sz);
  }

  hasRidersGoing(dir) {
    for (const r of this.riders.values()) if (Math.sign(r.dest - this.floor) === dir) return true;
    return false;
  }

  get position() {
    return this.cab.position;
  }

  // ------------------------------------------------------------ control
  callsAt(floor) {
    return this.waiting.filter((w) => w.from === floor);
  }

  shouldStopAt(floor, dir) {
    for (const r of this.riders.values()) if (r.phase === 'in' && r.dest === floor) return true;
    if (this.riders.size >= CAPACITY) return false;
    const calls = this.callsAt(floor);
    if (calls.some((w) => Math.sign(w.to - w.from) === dir)) return true;
    // last stop in this direction: pick up anyone
    if (calls.length && !this.anyDemandBeyond(floor, dir)) return true;
    return false;
  }

  anyDemandBeyond(floor, dir) {
    for (const r of this.riders.values()) if (Math.sign(r.dest - floor) === dir) return true;
    return this.waiting.some((w) => Math.sign(w.from - floor) === dir);
  }

  chooseDirection() {
    if (this.dir !== 0 && this.anyDemandBeyond(this.floor, this.dir)) return this.dir;
    if (this.anyDemandBeyond(this.floor, -this.dir || 1)) return -this.dir || 1;
    if (this.anyDemandBeyond(this.floor, -1)) return -1;
    if (this.anyDemandBeyond(this.floor, 1)) return 1;
    return 0;
  }

  update(dt) {
    // doors
    const wantOpen = this.state === 'open' && !this.closing;
    this.doorT += Math.sign((wantOpen ? 1 : 0) - this.doorT) * Math.min(Math.abs((wantOpen ? 1 : 0) - this.doorT), dt * 1.5);

    if (this.state === 'idle') {
      // someone waiting right here?
      if (this.callsAt(this.floor).length) this.openDoors();
      else {
        const d = this.chooseDirection();
        if (d) this.startMoving(d);
      }
    } else if (this.state === 'open') {
      this.openTimer += dt;
      const busy = [...this.riders.values()].some((r) => r.phase !== 'in');
      const someoneHere = this.callsAt(this.floor).some((w) => this.riders.size < CAPACITY && (this.dir === 0 || Math.sign(w.to - w.from) === this.dir || !this.hasRidersGoing(this.dir)));
      const alighting = [...this.riders.values()].some((r) => r.phase === 'in' && r.dest === this.floor);
      // courtesy: hold for someone close by who is walking to this floor's lift
      let courtesy = false;
      for (const a of this.approaching.values()) if (a.floor === this.floor && a.dist < 9 && this.riders.size < CAPACITY) courtesy = true;
      const minOpen = this.openTimer < 2.2;
      const hold = busy || someoneHere || alighting || (courtesy && this.openTimer < 12);
      if (!minOpen && !hold) this.closing = true;
      if (hold) this.closing = false;
      if (this.closing && this.doorT <= 0.001) {
        this.closing = false;
        this.state = 'idle';
        const d = this.chooseDirection();
        this.dir = d;
        if (d) this.startMoving(d);
      }
    } else if (this.state === 'moving') {
      this.move(dt);
    }

    // visuals
    this.cab.position.y = this.y;
    const cw = this.cw;
    for (const d of this.carDoors) d.position.z = d.userData.side * (cw / 4 + (this.doorT * cw) / 4.4);
    for (let f = 0; f < FLOORS; f++) {
      const open = this.floor === f && this.state !== 'moving' ? this.doorT : 0;
      for (const leaf of this.landing[f]) leaf.position.z = LIFT.z + leaf.userData.side * (LIFT.w / 4 + (open * LIFT.w) / 2.1);
      const b = this.buttons[f];
      if (b.up) b.up.material.emissiveIntensity = this.isLit(f, 1) ? 2.2 : 0;
      if (b.down) b.down.material.emissiveIntensity = this.isLit(f, -1) ? 2.2 : 0;
      const near = Math.round((this.y - floorY(0)) / (floorY(1) - floorY(0)));
      this.drawIndicator(this.indicators[f], NAMES[Math.max(0, Math.min(3, near))], this.state === 'moving' ? this.dir : 0, open > 0.5);
    }
    const near = Math.round((this.y - floorY(0)) / (floorY(1) - floorY(0)));
    this.drawIndicator(this.carDisplay, NAMES[Math.max(0, Math.min(3, near))], this.state === 'moving' ? this.dir : 0, false);
  }

  openDoors() {
    this.state = 'open';
    this.openTimer = 0;
    this.closing = false;
    this.v = 0;
  }

  startMoving(dir) {
    this.dir = dir;
    this.state = 'moving';
    this.target = null;
    this.v = 0;
  }

  move(dt) {
    const dir = this.dir;
    const ahead = (f) => (dir > 0 ? floorY(f) - this.y : this.y - floorY(f));
    const hasDemand = (f) => this.callsAt(f).length > 0 || [...this.riders.values()].some((r) => r.dest === f);
    // a floor we can still stop at comfortably (allowing slightly firmer braking)
    const canMake = (f) => ahead(f) > 0.002 && ahead(f) >= (this.v * this.v) / (2 * ACCEL * 1.6);
    let best = null;
    for (let f = 0; f < FLOORS; f++) if (canMake(f) && this.shouldStopAt(f, dir) && (best === null || ahead(f) < ahead(best))) best = f;
    if (this.target !== null && ahead(this.target) > 0.002) {
      if (best !== null && ahead(best) < ahead(this.target)) this.target = best; // someone to pick up on the way
    } else {
      this.target = best;
      if (this.target === null) {
        // demand further on (e.g. someone waiting to go the other way): go to the farthest one
        for (let f = 0; f < FLOORS; f++) if (ahead(f) > 0.002 && hasDemand(f) && (this.target === null || ahead(f) > ahead(this.target))) this.target = f;
      }
      if (this.target === null) {
        // nothing left this way: stop at the next floor
        for (let f = 0; f < FLOORS; f++) if (ahead(f) > 0.002 && (this.target === null || ahead(f) < ahead(this.target))) this.target = f;
      }
      if (this.target === null) {
        this.v = 0;
        this.state = 'idle';
        this.dir = 0;
        return;
      }
    }
    const dist = ahead(this.target);
    const need = (this.v * this.v) / (2 * Math.max(dist, 0.001));
    if (need >= ACCEL * 0.92) this.v = Math.max(0.12, this.v - need * dt);
    else this.v = Math.min(SPEED, this.v + ACCEL * dt);
    const step = Math.min(dist, this.v * dt);
    this.y += dir * step;
    this.floor = Math.max(0, Math.min(FLOORS - 1, Math.round((this.y - floorY(0)) / (floorY(1) - floorY(0)))));
    if (dist - step < 0.003) {
      const f = this.target;
      this.y = floorY(f);
      this.floor = f;
      this.v = 0;
      this.target = null;
      if (hasDemand(f)) this.openDoors();
      else {
        this.state = 'idle';
        this.dir = this.chooseDirection();
      }
    }
  }
}

export const LIFT_WAIT_X = LIFT.doorX - 0.95;
