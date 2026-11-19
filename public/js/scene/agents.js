// Scott, Bob and Tom — stylised 3D characters in formal suits, each with a
// small detail for their job — plus their movement around the tower.
// They always take the glass lift between floors.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { floorY, LANE_Z, LIFT } from './layout.js';

export const AGENT_LOOKS = {
  scott: { suit: '#1e2a44', tie: '#7a1f2b', hair: '#b9b6b0', skin: '#f0c8a4', iris: '#3a66a6', hairStyle: 'swept', prop: 'tablet', glasses: true },
  bob: { suit: '#6b4632', tie: '#16161a', hair: '#2f221a', skin: '#f3cba6', iris: '#5a3b22', hairStyle: 'spiky', prop: 'pencil' },
  tom: { suit: '#3a3e46', tie: '#2f6b4a', hair: '#9c4f2a', skin: '#f1c39c', iris: '#2f7a58', hairStyle: 'side', prop: 'clipboard' },
  dj: { suit: '#141418', tie: null, hair: '#1a1410', skin: '#d9a77f', iris: '#3a2a1a', hairStyle: 'short', prop: 'headphones', shades: true },
};

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...o });

export function makeCharacter(id) {
  const look = AGENT_LOOKS[id];
  const mats = {
    suit: std(look.suit, { roughness: 0.7 }),
    suitDark: std(new THREE.Color(look.suit).multiplyScalar(0.7), { roughness: 0.7 }),
    skin: std(look.skin, { roughness: 0.6 }),
    shirt: std('#f4f4f2', { roughness: 0.7 }),
    tie: look.tie ? std(look.tie, { roughness: 0.4 }) : null,
    hair: std(look.hair, { roughness: 0.75 }),
    shoe: std('#2a1a12', { roughness: 0.25, metalness: 0.1 }),
    eyeWhite: std('#ffffff', { roughness: 0.15 }),
    iris: std(look.iris, { roughness: 0.2 }),
    pupil: std('#0a0a0a', { roughness: 0.1 }),
    spec: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    gold: std('#c9a15e', { metalness: 1, roughness: 0.3 }),
    mouth: std('#9a4b3f', { roughness: 0.6 }),
  };

  const root = new THREE.Group();
  root.userData.agentId = id;
  const body = new THREE.Group();
  root.add(body);

  const HIP = 0.84;
  const add = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.userData.agentId = id;
    parent.add(m);
    return m;
  };

  // ---------------------------------------------------------------- legs
  const legs = {};
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.1, HIP, 0);
    body.add(hip);
    add(new THREE.CapsuleGeometry(0.088, 0.28, 6, 12), mats.suit, hip, 0, -0.2, 0);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    hip.add(knee);
    add(new THREE.CapsuleGeometry(0.078, 0.27, 6, 12), mats.suit, knee, 0, -0.18, 0);
    const shoe = add(new RoundedBoxGeometry(0.14, 0.09, 0.28, 3, 0.04), mats.shoe, knee, 0, -0.39, 0.05);
    shoe.userData.agentId = id;
    legs[s < 0 ? 'L' : 'R'] = { hip, knee };
  }
  add(new RoundedBoxGeometry(0.34, 0.16, 0.22, 3, 0.07), mats.suit, body, 0, HIP + 0.01, 0);

  // ---------------------------------------------------------------- torso
  const torso = new THREE.Group();
  torso.position.y = HIP;
  body.add(torso);
  const jacketGeo = new THREE.CylinderGeometry(0.205, 0.2, 0.62, 24);
  const jacket = add(jacketGeo, mats.suit, torso, 0, 0.23, 0);
  jacket.scale.z = 0.68;
  const shoulders = add(new THREE.CapsuleGeometry(0.1, 0.34, 6, 12), mats.suit, torso, 0, 0.5, 0);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.scale.set(1, 1, 0.78);
  // shirt V, tie, lapels
  const vShape = new THREE.Shape();
  vShape.moveTo(-0.085, 0.53);
  vShape.lineTo(0.085, 0.53);
  vShape.lineTo(0, 0.25);
  vShape.closePath();
  add(new THREE.ShapeGeometry(vShape), mats.shirt, torso, 0, 0, 0.142);
  if (mats.tie) {
    add(new THREE.BoxGeometry(0.04, 0.24, 0.01), mats.tie, torso, 0, 0.38, 0.143);
    add(new THREE.BoxGeometry(0.045, 0.04, 0.02), mats.tie, torso, 0, 0.51, 0.147);
  }
  for (const s of [-1, 1]) {
    const lapel = add(new THREE.BoxGeometry(0.038, 0.22, 0.008), mats.suitDark, torso, s * 0.056, 0.41, 0.141);
    lapel.rotation.z = s * 0.3;
  }
  for (const y of [0.2, 0.12]) add(new THREE.SphereGeometry(0.012, 8, 6), mats.gold, torso, 0, y, 0.142);
  add(new THREE.BoxGeometry(0.07, 0.025, 0.01), mats.shirt, torso, -0.11, 0.42, 0.142); // pocket square
  // neck + collar
  add(new THREE.CylinderGeometry(0.06, 0.065, 0.12, 14), mats.skin, torso, 0, 0.6, 0);
  add(new THREE.CylinderGeometry(0.075, 0.085, 0.05, 14), mats.shirt, torso, 0, 0.56, 0);

  // ---------------------------------------------------------------- arms
  const arms = {};
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.27, 0.49, 0);
    torso.add(sh);
    add(new THREE.CapsuleGeometry(0.068, 0.22, 6, 12), mats.suit, sh, 0, -0.16, 0);
    const el = new THREE.Group();
    el.position.y = -0.32;
    sh.add(el);
    add(new THREE.CapsuleGeometry(0.06, 0.2, 6, 12), mats.suit, el, 0, -0.14, 0);
    add(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 12), mats.shirt, el, 0, -0.27, 0);
    const hand = new THREE.Group();
    hand.position.y = -0.33;
    el.add(hand);
    const palm = add(new THREE.SphereGeometry(0.065, 14, 10), mats.skin, hand, 0, 0, 0);
    palm.scale.set(0.85, 1.1, 0.7);
    add(new THREE.CapsuleGeometry(0.022, 0.05, 4, 8), mats.skin, hand, s * -0.05, 0.01, 0.03).rotation.z = s * 0.6;
    arms[s < 0 ? 'L' : 'R'] = { sh, el, hand };
  }

  // ---------------------------------------------------------------- head
  const head = new THREE.Group();
  head.position.y = 0.62;
  torso.add(head);
  const skull = add(new THREE.SphereGeometry(0.225, 32, 24), mats.skin, head, 0, 0.21, 0);
  skull.scale.set(1, 1.04, 0.96);
  for (const s of [-1, 1]) {
    const ear = add(new THREE.SphereGeometry(0.05, 12, 10), mats.skin, head, s * 0.215, 0.19, -0.01);
    ear.scale.set(0.5, 1, 0.8);
    // eyes
    const eye = add(new THREE.SphereGeometry(0.056, 20, 16), mats.eyeWhite, head, s * 0.08, 0.215, 0.175);
    eye.scale.set(0.95, 1.1, 0.6);
    add(new THREE.SphereGeometry(0.034, 16, 12), mats.iris, head, s * 0.08, 0.212, 0.2).scale.set(1, 1.1, 0.5);
    add(new THREE.SphereGeometry(0.019, 12, 10), mats.pupil, head, s * 0.08, 0.212, 0.212).scale.set(1, 1.1, 0.4);
    add(new THREE.SphereGeometry(0.008, 8, 6), mats.spec, head, s * 0.08 + 0.012, 0.226, 0.218);
    const brow = add(new THREE.BoxGeometry(0.075, 0.016, 0.02), mats.hair, head, s * 0.082, 0.3, 0.198);
    brow.rotation.z = s * -0.12;
    brow.rotation.x = -0.25;
  }
  add(new THREE.SphereGeometry(0.026, 12, 10), mats.skin, head, 0, 0.165, 0.222).scale.set(0.9, 1, 0.9);
  const smile = add(new THREE.TorusGeometry(0.045, 0.007, 6, 16, Math.PI * 0.7), mats.mouth, head, 0, 0.115, 0.206);
  smile.rotation.z = Math.PI + Math.PI * 0.15;
  smile.rotation.x = -0.2;

  // hair
  const cap = add(new THREE.SphereGeometry(0.236, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.hair, head, 0, 0.215, -0.012);
  cap.rotation.x = -0.32;
  // back of the head down to the nape
  const back = add(new THREE.SphereGeometry(0.222, 24, 18), mats.hair, head, 0, 0.215, -0.032);
  back.scale.set(0.97, 0.98, 1);
  if (look.hairStyle === 'spiky') {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const ring = i % 2 ? 0.12 : 0.17;
      const spike = add(new THREE.ConeGeometry(0.055, 0.16, 8), mats.hair, head, Math.cos(a) * ring, 0.4 + (i % 2) * 0.03, Math.sin(a) * ring - 0.03);
      spike.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
    }
    for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.05, 0.14, 8), mats.hair, head, -0.09 + i * 0.06, 0.42, 0.11).rotation.x = 0.9;
  } else if (look.hairStyle === 'swept') {
    const quiff = add(new THREE.SphereGeometry(0.13, 20, 14), mats.hair, head, 0.01, 0.39, 0.06);
    quiff.scale.set(1.55, 0.55, 1.1);
    quiff.rotation.x = -0.2;
  } else if (look.hairStyle === 'side') {
    const sweep = add(new THREE.SphereGeometry(0.12, 20, 14), mats.hair, head, 0.05, 0.38, 0.09);
    sweep.scale.set(1.6, 0.5, 1);
    sweep.rotation.z = -0.25;
  } else {
    const top = add(new THREE.SphereGeometry(0.12, 20, 14), mats.hair, head, 0, 0.4, 0.02);
    top.scale.set(1.6, 0.45, 1.4);
  }

  // ---------------------------------------------------------------- job details
  const props = {};
  if (look.glasses) {
    const frame = mats.gold;
    for (const s of [-1, 1]) {
      const rim = add(new THREE.TorusGeometry(0.046, 0.006, 6, 20), frame, head, s * 0.08, 0.215, 0.228);
      rim.userData.agentId = id;
    }
    add(new THREE.BoxGeometry(0.05, 0.007, 0.007), frame, head, 0, 0.222, 0.232);
    // earpiece
    add(new THREE.SphereGeometry(0.018, 8, 6), std('#d0d4d8'), head, -0.225, 0.19, 0.02);
  }
  if (look.shades) {
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.09, 0.055, 0.02), std('#050505', { roughness: 0.05, metalness: 0.5 }), head, s * 0.08, 0.215, 0.232);
  }
  if (look.prop === 'tablet') {
    const tab = add(new RoundedBoxGeometry(0.2, 0.28, 0.014, 2, 0.008), std('#1a1b1e', { roughness: 0.2 }), arms.L.hand, 0.02, -0.06, 0.05);
    const glow = add(new THREE.PlaneGeometry(0.18, 0.25), new THREE.MeshBasicMaterial({ color: '#7fb8ff', toneMapped: false }), tab, 0, 0, 0.008);
    glow.castShadow = false;
    tab.rotation.set(-0.3, 0, 0.2);
    props.tablet = tab;
  }
  if (look.prop === 'clipboard') {
    const board = add(new THREE.BoxGeometry(0.22, 0.3, 0.012), std('#8a6a44', { roughness: 0.6 }), arms.L.hand, 0.02, -0.07, 0.05);
    const paper = add(new THREE.PlaneGeometry(0.19, 0.25), new THREE.MeshStandardMaterial({ map: checklistTexture(), roughness: 0.9 }), board, 0, -0.01, 0.007);
    paper.castShadow = false;
    add(new THREE.BoxGeometry(0.08, 0.03, 0.02), mats.gold, board, 0, 0.14, 0.008);
    board.rotation.set(-0.35, 0, 0.15);
    props.clipboard = board;
  }
  if (look.prop === 'pencil') {
    const pencil = add(new THREE.CylinderGeometry(0.009, 0.009, 0.17, 6), std('#e8b923'), head, 0.215, 0.27, 0.0);
    pencil.rotation.set(0.25, 0, 1.25);
    const tip = add(new THREE.ConeGeometry(0.009, 0.025, 6), std('#e9d3b0'), pencil, 0, 0.097, 0);
    tip.castShadow = false;
    // folding ruler in the breast pocket
    add(new THREE.BoxGeometry(0.03, 0.1, 0.012), std('#e8c547'), torso, -0.11, 0.44, 0.15);
  }
  if (look.prop === 'headphones') {
    const band = add(new THREE.TorusGeometry(0.235, 0.018, 8, 24, Math.PI), mats.gold, head, 0, 0.23, -0.02);
    band.rotation.z = 0;
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16), std('#111'), head, s * 0.235, 0.2, 0).rotation.z = Math.PI / 2;
  }

  // ---------------------------------------------------------------- posing
  const cur = { hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, shL: 0, shR: 0, shLz: 0.08, shRz: -0.08, elL: 0, elR: 0, torso: 0, headY: 0, headX: 0, lift: 0 };
  const tgt = { ...cur };

  function pose(name, t, walkPhase = 0) {
    Object.assign(tgt, { hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, shL: 0.05, shR: 0.05, shLz: 0.1, shRz: -0.1, elL: -0.12, elR: -0.12, torso: 0, headY: Math.sin(t * 0.37 + id.length) * 0.25, headX: 0, lift: 0 });
    const breathe = Math.sin(t * 1.6) * 0.012;
    switch (name) {
      case 'walk': {
        const s = Math.sin(walkPhase);
        tgt.hipL = s * 0.5;
        tgt.hipR = -s * 0.5;
        tgt.kneeL = Math.max(0, -s) * 0.7 + 0.05;
        tgt.kneeR = Math.max(0, s) * 0.7 + 0.05;
        tgt.shL = -s * 0.38;
        tgt.shR = s * 0.38;
        tgt.elL = -0.3;
        tgt.elR = -0.3;
        tgt.lift = Math.abs(Math.cos(walkPhase)) * 0.03;
        tgt.headY = 0;
        tgt.torso = 0.04;
        break;
      }
      case 'sit':
        tgt.hipL = tgt.hipR = -1.5;
        tgt.kneeL = tgt.kneeR = 1.5;
        tgt.lift = 0.47 - 0.84;
        tgt.shL = tgt.shR = -0.55;
        tgt.elL = tgt.elR = -0.75;
        tgt.headX = 0.08;
        break;
      case 'sit-type':
        tgt.hipL = tgt.hipR = -1.5;
        tgt.kneeL = tgt.kneeR = 1.45;
        tgt.lift = 0.47 - 0.84;
        tgt.shL = -0.95 + Math.sin(t * 9) * 0.04;
        tgt.shR = -0.95 + Math.sin(t * 9 + 2) * 0.04;
        tgt.shLz = 0.2;
        tgt.shRz = -0.2;
        tgt.elL = -0.75 + Math.sin(t * 11) * 0.06;
        tgt.elR = -0.75 + Math.sin(t * 10 + 1) * 0.06;
        tgt.torso = 0.12;
        tgt.headX = 0.12;
        tgt.headY = Math.sin(t * 0.5) * 0.08;
        break;
      case 'stand-work':
        tgt.shL = -0.75;
        tgt.elL = -0.9;
        tgt.shR = -0.55 + Math.sin(t * 2.2) * 0.12;
        tgt.elR = -0.9 + Math.sin(t * 3.1) * 0.15;
        tgt.headX = 0.18;
        tgt.headY = Math.sin(t * 0.6) * 0.12;
        tgt.torso = 0.06;
        break;
      case 'lie':
        tgt.hipL = tgt.hipR = -1.42;
        tgt.kneeL = 0.12;
        tgt.kneeR = 0.3;
        tgt.lift = 0.4 - 0.84;
        tgt.torso = -0.95;
        tgt.shL = 0.15;
        tgt.shR = -0.35;
        tgt.shLz = 0.22;
        tgt.shRz = -0.18;
        tgt.elL = -0.25;
        tgt.elR = -1.2;
        tgt.headX = 0.45;
        tgt.headY = Math.sin(t * 0.2) * 0.15;
        break;
      case 'sit-high':
        tgt.hipL = tgt.hipR = -1.25;
        tgt.kneeL = 1.65;
        tgt.kneeR = 1.4;
        tgt.lift = 0.8 - 0.84;
        tgt.shL = -0.9;
        tgt.shR = -1.1 + Math.sin(t * 0.7) * 0.1;
        tgt.elL = -0.9;
        tgt.elR = -1.3;
        tgt.headY = Math.sin(t * 0.3) * 0.4 - 0.3;
        break;
      case 'dj':
        tgt.shL = -0.8 + Math.sin(t * 4.2) * 0.1;
        tgt.elL = -0.9;
        tgt.shR = -0.6;
        tgt.shRz = -0.25;
        tgt.elR = -2.0;
        tgt.headX = 0.15 + Math.sin(t * 8.4) * 0.08;
        tgt.lift = -Math.abs(Math.sin(t * 4.2)) * 0.035;
        tgt.kneeL = tgt.kneeR = Math.abs(Math.sin(t * 4.2)) * 0.12;
        tgt.hipL = tgt.hipR = -Math.abs(Math.sin(t * 4.2)) * 0.06;
        break;
      default:
        break;
    }
    // job-specific idle: Scott glances at his tablet, Tom checks the clipboard
    if ((name === 'stand' || name === 'sit') && (look.prop === 'tablet' || look.prop === 'clipboard')) {
      tgt.shL = -0.75;
      tgt.elL = -1.05;
      tgt.headX = Math.max(tgt.headX, 0.22);
      tgt.headY = 0.1;
    }
    torso.scale.y = 1 + breathe;
  }

  function apply(dt) {
    const k = Math.min(1, dt * 9);
    for (const key in cur) cur[key] += (tgt[key] - cur[key]) * k;
    legs.L.hip.rotation.x = cur.hipL;
    legs.R.hip.rotation.x = cur.hipR;
    legs.L.knee.rotation.x = cur.kneeL;
    legs.R.knee.rotation.x = cur.kneeR;
    arms.L.sh.rotation.x = cur.shL;
    arms.R.sh.rotation.x = cur.shR;
    arms.L.sh.rotation.z = -cur.shLz;
    arms.R.sh.rotation.z = -cur.shRz;
    arms.L.el.rotation.x = cur.elL;
    arms.R.el.rotation.x = cur.elR;
    torso.rotation.x = cur.torso;
    head.rotation.y = cur.headY;
    head.rotation.x = cur.headX;
    body.position.y = cur.lift;
  }

  const headWorld = new THREE.Vector3();
  return {
    id,
    root,
    head,
    props,
    pose,
    apply,
    headPosition(out = headWorld) {
      return head.getWorldPosition(out).add(new THREE.Vector3(0, 0.62, 0));
    },
    animateDJ(t) {
      pose('dj', t);
      apply(1 / 60);
    },
  };
}

function checklistTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 168;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f5ee';
  g.fillRect(0, 0, 128, 168);
  for (let i = 0; i < 7; i++) {
    const y = 26 + i * 20;
    g.strokeStyle = '#555';
    g.strokeRect(12, y - 9, 11, 11);
    g.fillStyle = i < 5 ? '#2f6b4a' : '#c0392b';
    g.font = 'bold 12px sans-serif';
    g.fillText(i < 5 ? '✓' : '✗', 13, y);
    g.fillStyle = '#999';
    g.fillRect(30, y - 5, 70 - (i % 3) * 12, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ==================================================================== movement
const WAIT_X = LIFT.doorX - 0.9;
const WAIT_DZ = { scott: -0.75, bob: 0, tom: 0.75 };
const SPEED = 1.35;

export class AgentController {
  constructor(character, lift, getStation) {
    this.c = character;
    this.lift = lift;
    this.getStation = getStation; // (roomId, agentId) -> station
    this.floor = 0;
    this.pos = new THREE.Vector3();
    this.face = 0;
    this.mode = 'idle';
    this.path = [];
    this.onArrive = null;
    this.room = null;
    this.station = null;
    this.walkPhase = 0;
    this.travelTo = null;
  }

  placeAt(roomId, floor) {
    const st = this.getStation(roomId, this.c.id);
    this.room = roomId;
    this.station = st;
    this.floor = floor;
    this.pos.copy(st.pos);
    this.face = st.face;
    this.mode = 'idle';
  }

  get moving() {
    return this.mode !== 'idle';
  }

  /** Called every frame with the room the data says this agent should be in. */
  update(dt, t, desiredRoom, desiredFloor) {
    if (this.mode === 'idle' && desiredRoom && desiredRoom !== this.room) this.goTo(desiredRoom, desiredFloor);

    switch (this.mode) {
      case 'walk':
        this.step(dt);
        break;
      case 'waitLift':
        this.faceToward(LIFT.x, LIFT.z, dt);
        if (this.lift.isReadyFor(this, this.floor)) {
          this.walk([new THREE.Vector3(WAIT_X, this.pos.y, LANE_Z), new THREE.Vector3(LIFT.x - 0.1, this.pos.y, LIFT.z)], () => {
            this.lift.board(this);
            this.mode = 'ride';
          });
        }
        break;
      case 'ride':
        this.pos.y = this.lift.position.y;
        this.pos.x = LIFT.x - 0.1;
        this.pos.z = LIFT.z;
        this.turnTo(-Math.PI / 2, dt);
        if (this.lift.hasArrivedFor(this)) {
          this.floor = this.travelTo.floor;
          this.pos.y = floorY(this.floor);
          this.walk([new THREE.Vector3(WAIT_X, this.pos.y, LANE_Z)], () => {
            this.lift.alight(this);
            this.planOnFloor(this.travelTo.room);
          });
        }
        break;
      default:
        this.settle(dt);
        break;
    }

    // pose
    const st = this.station;
    if (this.mode === 'walk') {
      this.walkPhase += dt * 7.5;
      this.c.pose('walk', t, this.walkPhase);
    } else if (this.mode === 'idle' && st) {
      this.c.pose(st.pose || 'stand', t);
    } else {
      this.c.pose('stand', t);
    }
    this.c.apply(dt);
    this.c.root.position.copy(this.pos);
    this.c.root.rotation.y = this.face;
  }

  goTo(roomId, floor) {
    this.travelTo = { room: roomId, floor };
    // stand up / leave the station via the walkway
    if (floor === this.floor) return this.planOnFloor(roomId);
    const y = this.pos.y;
    const pts = this.leaveStationPoints();
    pts.push(new THREE.Vector3(WAIT_X, y, LANE_Z));
    pts.push(new THREE.Vector3(WAIT_X - 0.3, y, LANE_Z + (WAIT_DZ[this.c.id] || 0)));
    this.walk(pts, () => {
      this.mode = 'waitLift';
      this.lift.request(this, this.floor, floor);
    });
  }

  leaveStationPoints() {
    const y = this.pos.y;
    const pts = [];
    const via = this.station?.via;
    if (via) for (let i = via.length - 1; i >= 0; i--) pts.push(new THREE.Vector3(via[i].x, y, via[i].z));
    else pts.push(new THREE.Vector3(this.pos.x, y, LANE_Z));
    return pts;
  }

  planOnFloor(roomId) {
    const st = this.getStation(roomId, this.c.id);
    const y = floorY(this.floor);
    const pts = this.mode === 'idle' && this.station ? this.leaveStationPoints() : [];
    if (st.via) {
      pts.push(new THREE.Vector3(st.via[0].x, y, LANE_Z));
      for (const v of st.via) pts.push(new THREE.Vector3(v.x, y, v.z));
    } else pts.push(new THREE.Vector3(st.pos.x, y, LANE_Z));
    pts.push(new THREE.Vector3(st.pos.x, y, st.pos.z));
    this.walk(pts, () => {
      this.room = roomId;
      this.station = st;
      this.mode = 'idle';
      this.targetFace = st.face;
    });
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
      this.path.shift();
      return;
    }
    const v = Math.min(d, SPEED * dt);
    this.pos.x += (dx / d) * v;
    this.pos.z += (dz / d) * v;
    this.turnTo(Math.atan2(dx, dz), dt * 1.6);
  }

  faceToward(x, z, dt) {
    this.turnTo(Math.atan2(x - this.pos.x, z - this.pos.z), dt);
  }

  turnTo(angle, dt) {
    let diff = ((angle - this.face + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    this.face += diff * Math.min(1, dt * 8);
  }

  settle(dt) {
    if (this.mode === 'idle' && this.station) this.turnTo(this.station.face, dt);
  }
}
