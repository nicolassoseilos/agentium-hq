// Characters: stylised 3D people in the same style throughout (big friendly
// heads, simple elegant clothes). Scott, Bob and Tom in suits, the DJ, the
// barman, and the rooftop guests in swimwear.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const AGENT_LOOKS = {
  scott: { outfit: 'suit', suit: '#1e2a44', tie: '#7a1f2b', hair: '#b9b6b0', skin: '#f0c8a4', iris: '#3a66a6', hairStyle: 'swept', prop: 'tablet', glasses: true },
  bob: { outfit: 'suit', suit: '#6b4632', tie: '#16161a', hair: '#2f221a', skin: '#f3cba6', iris: '#5a3b22', hairStyle: 'spiky', prop: 'pencil' },
  tom: { outfit: 'suit', suit: '#3a3e46', tie: '#2f6b4a', hair: '#9c4f2a', skin: '#f1c39c', iris: '#2f7a58', hairStyle: 'side', prop: 'clipboard' },
  dj: { outfit: 'suit', suit: '#141418', tie: null, hair: '#1a1410', skin: '#c99670', iris: '#3a2a1a', hairStyle: 'short', prop: 'headphones', shades: true },
  barman: { outfit: 'barman', suit: '#121214', tie: null, hair: '#231a14', skin: '#e4b48c', iris: '#4a3322', hairStyle: 'side', beard: true },
};

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...o });
const HIP = 0.84;

export function makeCharacter(id, lookIn) {
  const look = lookIn || AGENT_LOOKS[id];
  const female = look.outfit === 'bikini';
  const mats = {
    suit: std(look.suit || '#222', { roughness: 0.7 }),
    suitDark: std(new THREE.Color(look.suit || '#222').multiplyScalar(0.7), { roughness: 0.7 }),
    skin: std(look.skin, { roughness: 0.55 }),
    shirt: std('#f4f4f2', { roughness: 0.7 }),
    tie: look.tie ? std(look.tie, { roughness: 0.4 }) : null,
    hair: std(look.hair, { roughness: 0.7 }),
    shoe: std('#2a1a12', { roughness: 0.25, metalness: 0.1 }),
    eyeWhite: std('#ffffff', { roughness: 0.15 }),
    iris: std(look.iris, { roughness: 0.2 }),
    pupil: std('#0a0a0a', { roughness: 0.1 }),
    spec: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    gold: std('#c9a15e', { metalness: 1, roughness: 0.3 }),
    mouth: std(female ? '#c4525a' : '#9a4b3f', { roughness: 0.5 }),
    swim: std(look.swim || '#222', { roughness: 0.45 }),
    swim2: std(look.swim2 || look.swim || '#222', { roughness: 0.45 }),
    lash: std('#1a1210', { roughness: 0.6 }),
  };

  const root = new THREE.Group();
  root.userData.personId = id;
  const body = new THREE.Group();
  root.add(body);
  const add = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.userData.personId = id;
    parent.add(m);
    return m;
  };

  const legMat = female ? mats.skin : look.outfit === 'barman' ? std('#141416', { roughness: 0.7 }) : mats.suit;
  const armMat = female ? mats.skin : look.outfit === 'barman' ? mats.shirt : mats.suit;

  let legs, torso, arms, head, H = HIP, bubbleOffset = 0.62;
  if (female) {
    // the rooftop guests: grown women with realistic proportions
    ({ legs, torso, arms, head } = buildWoman(look, add, mats, body));
    H = WOMAN_HIP;
    bubbleOffset = 0.36;
    if (look.height) root.scale.setScalar(look.height);
  } else {
    // ---------------------------------------------------------------- legs
    legs = {};
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * (female ? 0.085 : 0.1), HIP, 0);
      body.add(hip);
      add(new THREE.CapsuleGeometry(female ? 0.074 : 0.088, 0.28, 6, 12), legMat, hip, 0, -0.2, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.4;
      hip.add(knee);
      add(new THREE.CapsuleGeometry(female ? 0.062 : 0.078, 0.27, 6, 12), legMat, knee, 0, -0.18, 0);
      if (female) {
        const foot = add(new RoundedBoxGeometry(0.09, 0.06, 0.2, 2, 0.03), mats.skin, knee, 0, -0.39, 0.04);
        if (look.sandals) add(new RoundedBoxGeometry(0.1, 0.02, 0.22, 2, 0.008), std(look.sandals), knee, 0, -0.425, 0.04);
        void foot;
      } else add(new RoundedBoxGeometry(0.14, 0.09, 0.28, 3, 0.04), mats.shoe, knee, 0, -0.39, 0.05);
      legs[s < 0 ? 'L' : 'R'] = { hip, knee };
    }

    // ---------------------------------------------------------------- torso
    torso = new THREE.Group();
    torso.position.y = HIP;
    body.add(torso);
    if (female) {
      const profile = [[0, -0.03], [0.148, -0.03], [0.156, 0.04], [0.124, 0.17], [0.128, 0.26], [0.15, 0.35], [0.146, 0.43], [0.118, 0.5], [0.07, 0.56], [0, 0.575]].map(([r, y]) => new THREE.Vector2(r, y));
      const t = add(new THREE.LatheGeometry(profile, 24), mats.skin, torso, 0, 0, 0);
      t.scale.z = 0.72;
      // string bikini bottom: small front and back pieces on a thin string all the way round
      add(new RoundedBoxGeometry(0.26, 0.12, 0.2, 3, 0.05), mats.skin, body, 0, HIP - 0.05, 0);
      const tri = (w, top, depthDown) => {
        const sh = new THREE.Shape();
        sh.moveTo(-w / 2, top);
        sh.quadraticCurveTo(0, top + 0.005, w / 2, top);
        sh.lineTo(0.018, top - depthDown);
        sh.lineTo(-0.018, top - depthDown);
        sh.closePath();
        return new THREE.ShapeGeometry(sh, 6);
      };
      const front = add(tri(0.16, 0.0, 0.1), mats.swim2, body, 0, HIP - 0.0, 0.1015);
      front.castShadow = false;
      const backPiece = add(tri(0.2, 0.0, 0.11), mats.swim2, body, 0, HIP - 0.0, -0.1015);
      backPiece.rotation.y = Math.PI;
      backPiece.castShadow = false;
      const string = add(new THREE.TorusGeometry(0.152, 0.0055, 6, 40), mats.swim2, torso, 0, 0.005, 0);
      string.rotation.x = Math.PI / 2;
      string.scale.set(1, 0.745, 1);
      for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.012, 8, 6), mats.swim2, torso, s * 0.152, 0.0, 0); // side ties
      // bikini top
      for (const s of [-1, 1]) {
        const cup = add(new THREE.SphereGeometry(0.068, 16, 12), mats.swim, torso, s * 0.064, 0.37, 0.07);
        cup.scale.set(1, 0.85, 0.62);
        const strap = add(new THREE.BoxGeometry(0.012, 0.16, 0.012), mats.swim, torso, s * 0.07, 0.47, 0.06);
        strap.rotation.set(-0.25, 0, s * -0.15);
      }
      const band = add(new THREE.CylinderGeometry(0.152, 0.152, 0.028, 24, 1, true), mats.swim, torso, 0, 0.335, 0);
      band.scale.z = 0.74;
      const sh = add(new THREE.CapsuleGeometry(0.068, 0.24, 6, 12), mats.skin, torso, 0, 0.495, 0);
      sh.rotation.z = Math.PI / 2;
      sh.scale.set(1, 1, 0.7);
      add(new THREE.CylinderGeometry(0.05, 0.056, 0.12, 14), mats.skin, torso, 0, 0.6, 0);
    } else {
      add(new RoundedBoxGeometry(0.34, 0.16, 0.22, 3, 0.07), legMat, body, 0, HIP + 0.01, 0);
      const jacket = add(new THREE.CylinderGeometry(0.205, 0.2, 0.62, 24), mats.suit, torso, 0, 0.23, 0);
      jacket.scale.z = 0.68;
      const shoulders = add(new THREE.CapsuleGeometry(0.1, 0.34, 6, 12), look.outfit === 'barman' ? mats.shirt : mats.suit, torso, 0, 0.5, 0);
      shoulders.rotation.z = Math.PI / 2;
      shoulders.scale.set(1, 1, 0.78);
      const vShape = new THREE.Shape();
      vShape.moveTo(-0.085, 0.53);
      vShape.lineTo(0.085, 0.53);
      vShape.lineTo(0, look.outfit === 'barman' ? 0.18 : 0.25);
      vShape.closePath();
      add(new THREE.ShapeGeometry(vShape), mats.shirt, torso, 0, 0, 0.142);
      if (mats.tie) {
        add(new THREE.BoxGeometry(0.04, 0.24, 0.01), mats.tie, torso, 0, 0.38, 0.143);
        add(new THREE.BoxGeometry(0.045, 0.04, 0.02), mats.tie, torso, 0, 0.51, 0.147);
      }
      if (look.outfit === 'barman') {
        // bow tie, waistcoat buttons, long apron
        for (const s of [-1, 1]) {
          const wing = add(new THREE.ConeGeometry(0.03, 0.055, 4), mats.suit, torso, s * 0.028, 0.53, 0.15);
          wing.rotation.z = s * Math.PI / 2;
        }
        add(new THREE.SphereGeometry(0.012, 8, 6), mats.suit, torso, 0, 0.53, 0.155);
        for (const y of [0.4, 0.32, 0.24]) add(new THREE.SphereGeometry(0.01, 8, 6), mats.gold, torso, 0, y, 0.142);
        const apron = add(new THREE.BoxGeometry(0.4, 0.6, 0.02), std('#0e0e10', { roughness: 0.85 }), body, 0, HIP - 0.3, 0.13);
        apron.rotation.x = 0.06;
      } else {
        for (const s of [-1, 1]) {
          const lapel = add(new THREE.BoxGeometry(0.038, 0.22, 0.008), mats.suitDark, torso, s * 0.056, 0.41, 0.141);
          lapel.rotation.z = s * 0.3;
        }
        for (const y of [0.2, 0.12]) add(new THREE.SphereGeometry(0.012, 8, 6), mats.gold, torso, 0, y, 0.142);
        if (mats.tie) add(new THREE.BoxGeometry(0.07, 0.025, 0.01), mats.shirt, torso, -0.11, 0.42, 0.142);
      }
      add(new THREE.CylinderGeometry(0.06, 0.065, 0.12, 14), mats.skin, torso, 0, 0.6, 0);
      add(new THREE.CylinderGeometry(0.075, 0.085, 0.05, 14), mats.shirt, torso, 0, 0.56, 0);
    }

    // ---------------------------------------------------------------- arms
    arms = {};
    for (const s of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(s * (female ? 0.2 : 0.27), female ? 0.49 : 0.49, 0);
      torso.add(sh);
      add(new THREE.CapsuleGeometry(female ? 0.05 : 0.068, 0.22, 6, 12), armMat, sh, 0, -0.16, 0);
      const el = new THREE.Group();
      el.position.y = -0.32;
      sh.add(el);
      add(new THREE.CapsuleGeometry(female ? 0.044 : 0.06, 0.2, 6, 12), female ? mats.skin : armMat, el, 0, -0.14, 0);
      if (!female && look.outfit !== 'barman') add(new THREE.CylinderGeometry(0.062, 0.062, 0.03, 12), mats.shirt, el, 0, -0.27, 0);
      if (female && look.bracelet && s > 0) add(new THREE.TorusGeometry(0.047, 0.008, 6, 16), mats.gold, el, 0, -0.27, 0).rotation.x = Math.PI / 2;
      const hand = new THREE.Group();
      hand.position.y = -0.33;
      el.add(hand);
      const palm = add(new THREE.SphereGeometry(female ? 0.055 : 0.065, 14, 10), mats.skin, hand, 0, 0, 0);
      palm.scale.set(0.85, 1.1, 0.7);
      add(new THREE.CapsuleGeometry(female ? 0.018 : 0.022, 0.05, 4, 8), mats.skin, hand, s * -0.045, 0.01, 0.03).rotation.z = s * 0.6;
      const socket = new THREE.Group();
      socket.position.set(0, -0.05, 0.04);
      hand.add(socket);
      arms[s < 0 ? 'L' : 'R'] = { sh, el, hand, socket };
    }

    // ---------------------------------------------------------------- head
    head = new THREE.Group();
    head.position.y = 0.62;
    torso.add(head);
    const skull = add(new THREE.SphereGeometry(0.225, 32, 24), mats.skin, head, 0, 0.21, 0);
    skull.scale.set(female ? 0.97 : 1, 1.04, 0.96);
    for (const s of [-1, 1]) {
      const ear = add(new THREE.SphereGeometry(0.05, 12, 10), mats.skin, head, s * 0.212, 0.19, -0.01);
      ear.scale.set(0.5, 1, 0.8);
      const eye = add(new THREE.SphereGeometry(0.056, 20, 16), mats.eyeWhite, head, s * 0.08, 0.215, 0.175);
      eye.scale.set(0.95, 1.1, 0.6);
      add(new THREE.SphereGeometry(0.034, 16, 12), mats.iris, head, s * 0.08, 0.212, 0.2).scale.set(1, 1.1, 0.5);
      add(new THREE.SphereGeometry(0.019, 12, 10), mats.pupil, head, s * 0.08, 0.212, 0.212).scale.set(1, 1.1, 0.4);
      add(new THREE.SphereGeometry(0.008, 8, 6), mats.spec, head, s * 0.08 + 0.012, 0.226, 0.218);
      const brow = add(new THREE.BoxGeometry(female ? 0.065 : 0.075, female ? 0.011 : 0.016, 0.02), mats.hair, head, s * 0.082, 0.3, 0.198);
      brow.rotation.z = s * (female ? -0.2 : -0.12);
      brow.rotation.x = -0.25;
      if (female) {
        const lash = add(new THREE.BoxGeometry(0.08, 0.012, 0.012), mats.lash, head, s * 0.082, 0.262, 0.21);
        lash.rotation.z = s * -0.25;
        lash.rotation.x = -0.4;
      }
    }
    add(new THREE.SphereGeometry(female ? 0.02 : 0.026, 12, 10), mats.skin, head, 0, 0.165, 0.222).scale.set(0.9, 1, 0.9);
    const smile = add(new THREE.TorusGeometry(female ? 0.038 : 0.045, female ? 0.009 : 0.007, 6, 16, Math.PI * 0.7), mats.mouth, head, 0, 0.115, 0.206);
    smile.rotation.z = Math.PI + Math.PI * 0.15;
    smile.rotation.x = -0.2;
    if (look.beard) {
      const beard = add(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.35), mats.hair, head, 0, 0.21, 0.015);
      beard.scale.set(1.02, 1.02, 0.98);
    }

    // hair
    const cap = female
      ? add(new THREE.SphereGeometry(0.229, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.6), mats.hair, head, 0, 0.212, -0.006)
      : add(new THREE.SphereGeometry(0.236, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.hair, head, 0, 0.215, -0.012);
    cap.rotation.x = female ? -0.6 : -0.32;
    if (female) cap.scale.set(0.98, 1.04, 0.98);
    const back = add(new THREE.SphereGeometry(0.222, 24, 18), mats.hair, head, 0, 0.215, -0.032);
    back.scale.set(0.97, 0.98, 1);
    const hs = look.hairStyle;
    if (hs === 'spiky') {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const ring = i % 2 ? 0.12 : 0.17;
        const spike = add(new THREE.ConeGeometry(0.055, 0.16, 8), mats.hair, head, Math.cos(a) * ring, 0.4 + (i % 2) * 0.03, Math.sin(a) * ring - 0.03);
        spike.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
      }
      for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.05, 0.14, 8), mats.hair, head, -0.09 + i * 0.06, 0.42, 0.11).rotation.x = 0.9;
    } else if (hs === 'swept') {
      const quiff = add(new THREE.SphereGeometry(0.13, 20, 14), mats.hair, head, 0.01, 0.39, 0.06);
      quiff.scale.set(1.55, 0.55, 1.1);
      quiff.rotation.x = -0.2;
    } else if (hs === 'side') {
      const sweep = add(new THREE.SphereGeometry(0.12, 20, 14), mats.hair, head, 0.05, 0.38, 0.09);
      sweep.scale.set(1.6, 0.5, 1);
      sweep.rotation.z = -0.25;
    } else if (hs === 'short') {
      const top = add(new THREE.SphereGeometry(0.12, 20, 14), mats.hair, head, 0, 0.4, 0.02);
      top.scale.set(1.6, 0.45, 1.4);
    }
    // longer styles
    if (hs === 'long' || hs === 'wavy') {
      const fall = add(new THREE.CapsuleGeometry(0.19, 0.34, 8, 16), mats.hair, head, 0, 0.02, -0.07);
      fall.scale.set(1.08, 1, 0.55);
      for (const s of [-1, 1]) {
        const side = add(new THREE.CapsuleGeometry(0.06, 0.32, 6, 10), mats.hair, head, s * 0.19, 0.04, 0.03);
        side.rotation.z = s * 0.08;
        if (hs === 'wavy') for (let k = 0; k < 3; k++) add(new THREE.SphereGeometry(0.06, 10, 8), mats.hair, head, s * (0.17 + (k % 2) * 0.03), -0.08 - k * 0.09, -0.02);
      }
      const fringe = add(new THREE.SphereGeometry(0.14, 20, 12), mats.hair, head, 0.06, 0.37, 0.1);
      fringe.scale.set(1.5, 0.45, 0.9);
      fringe.rotation.z = -0.3;
    } else if (hs === 'ponytail') {
      add(new THREE.SphereGeometry(0.07, 12, 10), mats.hair, head, 0, 0.32, -0.22);
      const tail = add(new THREE.CapsuleGeometry(0.06, 0.3, 6, 10), mats.hair, head, 0, 0.1, -0.29);
      tail.rotation.x = 0.35;
      add(new THREE.TorusGeometry(0.05, 0.012, 6, 12), std(look.swim || '#c33'), head, 0, 0.28, -0.25).rotation.x = 1.2;
    } else if (hs === 'bun') {
      add(new THREE.SphereGeometry(0.1, 14, 12), mats.hair, head, 0, 0.44, -0.12);
    } else if (hs === 'bob') {
      const bob = add(new THREE.SphereGeometry(0.245, 24, 16, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4), mats.hair, head, 0, 0.2, -0.02);
      bob.scale.set(1.04, 1, 1);
      const fringe = add(new THREE.SphereGeometry(0.15, 20, 12), mats.hair, head, 0, 0.36, 0.1);
      fringe.scale.set(1.5, 0.4, 0.9);
    }
    if (look.sunglassesOnHead) {
      const sg = std('#0a0a0a', { roughness: 0.05, metalness: 0.5 });
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.08, 0.045, 0.015), sg, head, s * 0.07, 0.42, 0.13).rotation.x = -0.9;
    }

  }

  // ---------------------------------------------------------------- job details
  if (look.glasses) {
    for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.046, 0.006, 6, 20), mats.gold, head, s * 0.08, 0.215, 0.228);
    add(new THREE.BoxGeometry(0.05, 0.007, 0.007), mats.gold, head, 0, 0.222, 0.232);
    add(new THREE.SphereGeometry(0.018, 8, 6), std('#d0d4d8'), head, -0.225, 0.19, 0.02);
  }
  if (look.shades) for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.09, 0.055, 0.02), std('#050505', { roughness: 0.05, metalness: 0.5 }), head, s * 0.08, 0.215, 0.232);
  const props = {};
  if (look.prop === 'tablet') {
    const tab = add(new RoundedBoxGeometry(0.2, 0.28, 0.014, 2, 0.008), std('#1a1b1e', { roughness: 0.2 }), arms.L.hand, 0.02, -0.06, 0.05);
    add(new THREE.PlaneGeometry(0.18, 0.25), new THREE.MeshBasicMaterial({ color: '#7fb8ff', toneMapped: false }), tab, 0, 0, 0.008).castShadow = false;
    tab.rotation.set(-0.3, 0, 0.2);
    props.leftItem = tab;
  }
  if (look.prop === 'clipboard') {
    const board = add(new THREE.BoxGeometry(0.22, 0.3, 0.012), std('#8a6a44', { roughness: 0.6 }), arms.L.hand, 0.02, -0.07, 0.05);
    add(new THREE.PlaneGeometry(0.19, 0.25), new THREE.MeshStandardMaterial({ map: checklistTexture(), roughness: 0.9 }), board, 0, -0.01, 0.007).castShadow = false;
    add(new THREE.BoxGeometry(0.08, 0.03, 0.02), mats.gold, board, 0, 0.14, 0.008);
    board.rotation.set(-0.35, 0, 0.15);
    props.leftItem = board;
  }
  if (look.prop === 'pencil') {
    const pencil = add(new THREE.CylinderGeometry(0.009, 0.009, 0.17, 6), std('#e8b923'), head, 0.215, 0.27, 0.0);
    pencil.rotation.set(0.25, 0, 1.25);
    add(new THREE.ConeGeometry(0.009, 0.025, 6), std('#e9d3b0'), pencil, 0, 0.097, 0).castShadow = false;
    add(new THREE.BoxGeometry(0.03, 0.1, 0.012), std('#e8c547'), torso, -0.11, 0.44, 0.15);
  }
  if (look.prop === 'headphones') {
    add(new THREE.TorusGeometry(0.235, 0.018, 8, 24, Math.PI), mats.gold, head, 0, 0.23, -0.02);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16), std('#111'), head, s * 0.235, 0.2, 0).rotation.z = Math.PI / 2;
  }

  // phone (shown while they use it)
  const phone = new THREE.Group();
  const phoneBody = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.15, 0.01, 2, 0.006), std('#111', { roughness: 0.2 }));
  phone.add(phoneBody);
  const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.135), new THREE.MeshBasicMaterial({ color: '#9fc6ff', toneMapped: false }));
  phoneScreen.position.z = 0.006;
  phone.add(phoneScreen);
  phone.visible = false;
  arms.R.socket.add(phone);
  // menu (a leather folder)
  const menu = new THREE.Group();
  const menuMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.012), std('#3a1d10', { roughness: 0.5 }));
  menu.add(menuMesh);
  const menuGold = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.03), mats.gold);
  menuGold.position.set(0, 0.06, 0.007);
  menu.add(menuGold);
  menu.visible = false;
  arms.L.socket.add(menu);

  // ---------------------------------------------------------------- posing
  const KEYS = ['hipL', 'hipR', 'kneeL', 'kneeR', 'shL', 'shR', 'shLz', 'shRz', 'elL', 'elR', 'torso', 'torsoZ', 'bodyX', 'headY', 'headX', 'lift'];
  const cur = Object.fromEntries(KEYS.map((k) => [k, 0]));
  const tgt = { ...cur };
  const holding = { right: null, rightKind: null, left: null, menu: false, phone: false };
  const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 100;

  function pose(name, t, o = {}) {
    Object.assign(tgt, { hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, shL: 0.05, shR: 0.05, shLz: 0.1, shRz: -0.1, elL: -0.12, elR: -0.12, torso: 0, torsoZ: 0, bodyX: 0, headY: Math.sin(t * 0.37 + seed) * 0.25, headX: 0, lift: 0 });
    const breathe = Math.sin(t * 1.6 + seed) * 0.012;
    switch (name) {
      case 'walk': {
        const s = Math.sin(o.phase || 0);
        tgt.hipL = s * 0.5;
        tgt.hipR = -s * 0.5;
        tgt.kneeL = Math.max(0, -s) * 0.7 + 0.05;
        tgt.kneeR = Math.max(0, s) * 0.7 + 0.05;
        tgt.shL = -s * 0.38;
        tgt.shR = s * 0.38;
        tgt.elL = tgt.elR = -0.3;
        tgt.lift = Math.abs(Math.cos(o.phase || 0)) * 0.03;
        tgt.headY = 0;
        tgt.torso = 0.04;
        break;
      }
      case 'sit':
        tgt.hipL = tgt.hipR = -1.5;
        tgt.kneeL = tgt.kneeR = 1.5;
        tgt.lift = (o.seat ?? 0.47) - H;
        tgt.shL = tgt.shR = -0.55;
        tgt.elL = tgt.elR = -0.75;
        tgt.headX = 0.08;
        break;
      case 'sit-type':
        tgt.hipL = tgt.hipR = -1.5;
        tgt.kneeL = tgt.kneeR = 1.45;
        tgt.lift = 0.47 - H;
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
        tgt.kneeR = female ? 0.9 : 0.3;
        tgt.hipR = female ? -1.0 : -1.42;
        tgt.lift = 0.4 - H;
        tgt.torso = -0.95;
        tgt.shL = 0.15;
        tgt.shR = -0.35;
        tgt.shLz = 0.22;
        tgt.shRz = -0.18;
        tgt.elL = -0.25;
        tgt.elR = -1.2;
        tgt.headX = 0.45;
        tgt.headY = Math.sin(t * 0.2 + seed) * 0.15;
        break;
      case 'sit-high':
        tgt.hipL = tgt.hipR = -1.25;
        tgt.kneeL = 1.65;
        tgt.kneeR = 1.4;
        tgt.lift = 0.8 - H;
        tgt.shL = -0.9;
        tgt.shR = -1.1 + Math.sin(t * 0.7) * 0.1;
        tgt.elL = -0.9;
        tgt.elR = -1.3;
        tgt.headY = Math.sin(t * 0.3 + seed) * 0.4;
        break;
      case 'sit-edge':
        // sitting on the pool coping, legs in the water
        tgt.hipL = tgt.hipR = -1.45;
        tgt.kneeL = 1.35 + Math.sin(t * 1.3 + seed) * 0.25;
        tgt.kneeR = 1.35 + Math.sin(t * 1.3 + seed + 2) * 0.25;
        tgt.lift = 0.04 - H;
        tgt.torso = -0.12;
        tgt.shL = tgt.shR = 0.45;
        tgt.shLz = 0.35;
        tgt.shRz = -0.35;
        tgt.elL = tgt.elR = -0.15;
        tgt.headX = 0.05;
        break;
      case 'swim': {
        const p = o.phase || t * 3;
        tgt.bodyX = 1.25;
        tgt.lift = -0.25;
        tgt.shL = -2.2 + Math.sin(p) * 0.9;
        tgt.shR = -2.2 + Math.sin(p) * 0.9;
        tgt.shLz = 0.6 + Math.cos(p) * 0.5;
        tgt.shRz = -0.6 - Math.cos(p) * 0.5;
        tgt.elL = tgt.elR = -0.4 - Math.max(0, Math.cos(p)) * 1.0;
        tgt.hipL = 0.2 + Math.sin(p * 2) * 0.25;
        tgt.hipR = 0.2 - Math.sin(p * 2) * 0.25;
        tgt.kneeL = tgt.kneeR = 0.6;
        tgt.headX = -1.0;
        tgt.headY = 0;
        break;
      }
      case 'wade':
        tgt.shL = tgt.shR = -0.35 + Math.sin(t * 1.1 + seed) * 0.15;
        tgt.shLz = 0.55;
        tgt.shRz = -0.55;
        tgt.elL = tgt.elR = -0.5;
        tgt.hipL = Math.sin(t * 0.9) * 0.15;
        tgt.hipR = -Math.sin(t * 0.9) * 0.15;
        break;
      case 'press':
        tgt.shR = -1.3;
        tgt.elR = -0.25;
        tgt.headX = 0.05;
        break;
      case 'reach':
        tgt.shR = -2.0 - (o.reach || 0) * 0.6;
        tgt.elR = -0.2;
        tgt.headX = -0.35;
        break;
      case 'pour':
        tgt.shR = -1.1;
        tgt.elR = -0.6;
        tgt.shL = -0.75;
        tgt.elL = -0.75;
        tgt.headX = 0.35;
        tgt.torso = 0.12;
        break;
      case 'bend':
        tgt.torso = 0.45;
        tgt.shR = -0.5;
        tgt.elR = -0.3;
        tgt.headX = 0.2;
        break;
      case 'hand':
        tgt.shR = -1.25;
        tgt.elR = -0.35;
        tgt.headX = 0.15;
        break;
      case 'scoop':
        // into the ice bucket / garnish dish on the bar top
        tgt.torso = 0.22;
        tgt.shR = -0.75;
        tgt.elR = -0.35;
        tgt.shRz = 0.12;
        tgt.headX = 0.42;
        break;
      case 'stir':
        tgt.torso = 0.12;
        tgt.shR = -0.95 + Math.sin(t * 12) * 0.05;
        tgt.elR = -1.05 + Math.cos(t * 12) * 0.08;
        tgt.shRz = 0.1;
        tgt.shL = -0.6;
        tgt.elL = -0.6;
        tgt.headX = 0.45;
        break;
      case 'light':
        // both hands up in front: cigar in one, cutter or jet lighter in the other
        tgt.shR = -1.05;
        tgt.elR = -1.25;
        tgt.shRz = 0.25;
        tgt.shL = -1.0;
        tgt.elL = -1.3;
        tgt.shLz = -0.25;
        tgt.headX = 0.32;
        break;
      case 'polish':
        tgt.shL = -0.8;
        tgt.elL = -1.1;
        tgt.shR = -0.75 + Math.sin(t * 5) * 0.12;
        tgt.elR = -1.0 + Math.cos(t * 5) * 0.2;
        tgt.headX = 0.3;
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
    // job idle: Scott glances at his tablet, Tom checks the clipboard
    if (props.leftItem && !holding.left && (name === 'stand' || name === 'sit')) {
      tgt.shL = -0.75;
      tgt.elL = -1.05;
      tgt.headX = Math.max(tgt.headX, 0.22);
      tgt.headY = 0.1;
    }
    if (props.leftItem) props.leftItem.visible = !holding.menu && !holding.left;

    // ---- overlays
    if (o.vibe && name !== 'walk' && name !== 'swim') {
      // enjoying the music: a head nod and a little sway, never dancing
      const beat = t * Math.PI * 2 * 2.05 + seed;
      tgt.headX += 0.07 + Math.sin(beat) * 0.075;
      tgt.torsoZ += Math.sin(beat / 2) * 0.03;
      if (name === 'stand' || name === 'wade') tgt.lift += -Math.abs(Math.sin(beat)) * 0.012;
    }
    const busyHands = ['pour', 'reach', 'hand', 'bend', 'scoop', 'stir', 'light'].includes(name);
    if (holding.right && name !== 'swim' && !busyHands) {
      tgt.shR = Math.min(tgt.shR, -0.55);
      tgt.elR = -1.25 + Math.sin(t * 0.4 + seed) * 0.08;
      tgt.shRz = -0.12;
      if (o.sip) {
        tgt.shR = -0.9;
        tgt.elR = -1.95;
        tgt.headX -= 0.15;
      }
    }
    if (holding.left && name !== 'swim' && name !== 'walk' && !busyHands) {
      // a cigar between the fingers; a slow draw when puffing
      tgt.shL = Math.min(tgt.shL, -0.5);
      tgt.elL = -1.2;
      tgt.shLz = 0.1;
      if (o.puff) {
        tgt.shL = -0.95;
        tgt.elL = -2.05;
        tgt.headX -= 0.08;
      }
    }
    if (holding.menu && name !== 'walk') {
      tgt.shL = -0.9;
      tgt.elL = -0.9;
      tgt.shR = Math.min(tgt.shR, -0.7);
      tgt.elR = Math.min(tgt.elR, -0.8);
      tgt.headX = 0.35;
      tgt.headY = 0;
    }
    if (holding.phone === 'pocket') {
      // hand goes to the trouser pocket
      tgt.shR = 0.2;
      tgt.shRz = -0.08;
      tgt.elR = -0.35;
      tgt.headX = 0.15;
    } else if (holding.phone) {
      tgt.shR = -0.75;
      tgt.elR = -1.75 + (holding.phone === 'type' ? Math.sin(t * 14) * 0.035 : 0);
      tgt.shRz = 0.05;
      tgt.headX = 0.42;
      tgt.headY = 0;
      if (name === 'sit-type' || name === 'stand-work') {
        tgt.shL = -0.4;
        tgt.elL = -0.5;
      }
    }
    torso.scale.y = 1 + breathe;
  }

  function apply(dt) {
    const k = Math.min(1, dt * 9);
    for (const key of KEYS) cur[key] += (tgt[key] - cur[key]) * k;
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
    torso.rotation.z = cur.torsoZ;
    head.rotation.y = cur.headY;
    head.rotation.x = cur.headX;
    body.position.y = cur.lift;
    body.rotation.x = cur.bodyX;
  }

  // keep held things upright in the world, whatever the arm is doing
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), e = new THREE.Euler();
  function orient(obj, tiltX = 0, tiltZ = 0) {
    obj.parent.getWorldQuaternion(qa).invert();
    e.set(tiltX, root.rotation.y, tiltZ, 'YXZ');
    qb.setFromEuler(e);
    obj.quaternion.copy(qa.multiply(qb));
  }
  const wp = new THREE.Vector3();
  function finish() {
    root.updateMatrixWorld(true);
    if (holding.right) {
      orient(holding.right, holding.tiltX || 0, holding.tiltZ || 0);
      // sit the glass/bottle in the palm (world space), not floating above it
      arms.R.hand.getWorldPosition(wp);
      wp.y -= holding.rightKind === 'bottle' ? 0.14 : 0.07;
      holding.right.position.copy(holding.right.parent.worldToLocal(wp));
    }
    if (holding.left) {
      // the cigar points forward and out, the cap towards the mouth when puffing
      arms.L.hand.getWorldPosition(wp);
      e.set(0, root.rotation.y + 0.35, 0, 'YXZ');
      holding.left.parent.getWorldQuaternion(qa).invert();
      qb.setFromEuler(e);
      holding.left.quaternion.copy(qa.multiply(qb));
      const off = new THREE.Vector3(0, -0.02, -0.03).applyEuler(e);
      holding.left.position.copy(holding.left.parent.worldToLocal(wp.add(off)));
    }
    if (phone.visible) orient(phone, -0.75);
    if (holding.menu) orient(menu, -0.9);
  }

  const headWorld = new THREE.Vector3();
  return {
    id,
    look,
    female,
    root,
    head,
    props,
    pose,
    apply,
    finish,
    /** Put something in the right hand (a glass or a bottle), or null to empty it. */
    holdRight(obj, kind = 'glass') {
      if (holding.right && holding.right.parent === arms.R.socket) arms.R.socket.remove(holding.right);
      holding.right = obj;
      holding.rightKind = obj ? kind : null;
      holding.tiltX = 0;
      if (obj) {
        obj.position.set(0, kind === 'bottle' ? -0.12 : -(obj.userData.hold ?? 0.04), 0.02);
        obj.rotation.set(0, 0, 0);
        arms.R.socket.add(obj);
      }
    },
    get rightItem() {
      return holding.right;
    },
    /** A cigar in the left hand (or null). */
    holdLeft(obj) {
      if (holding.left && holding.left.parent === arms.L.socket) arms.L.socket.remove(holding.left);
      holding.left = obj;
      if (obj) arms.L.socket.add(obj);
    },
    get leftItem() {
      return holding.left;
    },
    leftHandWorld(out) {
      return arms.L.hand.getWorldPosition(out);
    },
    setTilt(x) {
      holding.tiltX = x;
    },
    /** false | 'pocket' (reaching for it) | 'read' | 'type' */
    showPhone(stage) {
      holding.phone = stage || false;
      phone.visible = !!stage && stage !== 'pocket';
      phoneScreen.material.color.set(stage === 'read' || stage === 'type' ? '#9fc6ff' : '#111');
    },
    showMenu(on) {
      holding.menu = on;
      menu.visible = on;
    },
    get usingPhone() {
      return holding.phone;
    },
    get holdingMenu() {
      return holding.menu;
    },
    rightHandWorld(out) {
      return arms.R.socket.getWorldPosition(out);
    },
    headPosition(out = headWorld) {
      return head.getWorldPosition(out).add(new THREE.Vector3(0, bubbleOffset, 0));
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

// ------------------------------------------------------------------ guests
const HAIR = [
  { hair: '#e8cf8f', name: 'blonde' }, { hair: '#f2dfae', name: 'platinum' }, { hair: '#3b2416', name: 'brunette' },
  { hair: '#120c09', name: 'black' }, { hair: '#8a3b1c', name: 'auburn' }, { hair: '#5a3a22', name: 'chestnut' },
  { hair: '#b8763a', name: 'honey' }, { hair: '#2a1a12', name: 'dark brown' },
];
const SKIN = ['#f6d2b4', '#efc29e', '#e2ad84', '#c98d62', '#a86b45', '#7d4b2e', '#f3cfae', '#d9a07a'];
const SWIM = [['#c9a15e', '#c9a15e'], ['#111111', '#111111'], ['#e8e2d6', '#e8e2d6'], ['#b0283a', '#b0283a'], ['#1f4f7a', '#1f4f7a'], ['#2f6b4a', '#2f6b4a'], ['#e07a5f', '#e07a5f'], ['#7a3a6a', '#7a3a6a'], ['#f2f2f2', '#111111'], ['#d4af37', '#111111']];
const STYLES = ['long', 'wavy', 'ponytail', 'bun', 'lob', 'long', 'wavy', 'wavy'];
const LIPS = ['#b23a48', '#9e2f3c', '#c45a62', '#8c3a3a', '#d06a6a', '#a8424f'];
const NAILS = ['#b0283a', '#f2e6dc', '#111111', '#c9a15e', '#d97a7a'];
const IRIS = ['#3a66a6', '#5a3b22', '#2f7a58', '#6b4a2a', '#2a2a2a', '#5f7f9f'];
export const GUEST_NAMES = ['Valeria', 'Sofia', 'Maya', 'Chloe', 'Nadia', 'Ava', 'Lina', 'Zara', 'Isla', 'Mia', 'Daria', 'Leah'];

export function guestLook(i, rnd) {
  const h = HAIR[(i * 3 + Math.floor(rnd() * 3)) % HAIR.length];
  const sw = SWIM[(i * 7 + Math.floor(rnd() * 3)) % SWIM.length];
  return {
    outfit: 'bikini',
    hair: h.hair,
    hairStyle: STYLES[(i + Math.floor(rnd() * 4)) % STYLES.length],
    skin: SKIN[(i * 5 + Math.floor(rnd() * 2)) % SKIN.length],
    iris: IRIS[Math.floor(rnd() * IRIS.length)],
    swim: sw[0],
    swim2: sw[1],
    sandals: rnd() < 0.75 ? ['#c9a15e', '#f2efe8', '#2a1a12', '#111111'][Math.floor(rnd() * 4)] : null,
    lips: LIPS[Math.floor(rnd() * LIPS.length)],
    nails: NAILS[Math.floor(rnd() * NAILS.length)],
    earrings: rnd() < 0.6,
    height: 0.97 + rnd() * 0.07,
    sunglassesOnHead: rnd() < 0.35,
    bracelet: rnd() < 0.5,
  };
}

// ------------------------------------------------------------------ the adult women (rooftop guests)
// Realistic adult proportions (about 1.72 m, head ~1/7.5 of the height),
// long legs, slim waist, curvy hips and bust, mature beautiful faces, and a
// proper string bikini: triangle top on strings, string sides and a thong back.
const WOMAN_HIP = 0.95;

function lathe(points, segments = 24) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

function buildWoman(look, add, mats, body) {
  const skin = mats.skin;
  const swim = mats.swim;
  const swim2 = mats.swim2;
  const lip = new THREE.MeshStandardMaterial({ color: look.lips || '#b23a48', roughness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a1210', roughness: 0.5 });
  const legs = {};
  const arms = {};

  // ---- legs: shaped thighs and calves
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.088, WOMAN_HIP, 0);
    body.add(hip);
    const thigh = add(lathe([[0, 0.0], [0.074, -0.01], [0.08, -0.08], [0.074, -0.2], [0.06, -0.36], [0.051, -0.45], [0, -0.46]]), skin, hip, 0, 0, 0);
    thigh.scale.z = 0.95;
    const knee = new THREE.Group();
    knee.position.y = -0.45;
    hip.add(knee);
    add(new THREE.SphereGeometry(0.047, 14, 10), skin, knee, 0, 0, -0.004);
    add(lathe([[0, 0.0], [0.049, -0.01], [0.056, -0.12], [0.048, -0.24], [0.034, -0.38], [0.03, -0.43], [0, -0.44]]), skin, knee, 0, 0, 0);
    // slim foot, pointed, with a heeled sandal sole
    const foot = new THREE.Group();
    foot.position.set(0, -0.44, 0.0);
    knee.add(foot);
    const f = add(new THREE.SphereGeometry(0.04, 12, 10), skin, foot, 0, -0.012, 0.06);
    f.scale.set(0.75, 0.55, 2.2);
    if (look.sandals) {
      const sole = new THREE.MeshStandardMaterial({ color: look.sandals, roughness: 0.4, metalness: 0.2 });
      add(new THREE.BoxGeometry(0.07, 0.01, 0.2), sole, foot, 0, -0.038, 0.06);
      add(new THREE.CylinderGeometry(0.008, 0.006, 0.045, 8), sole, foot, 0, -0.06, -0.025);
      add(new THREE.TorusGeometry(0.032, 0.004, 6, 16), sole, foot, 0, -0.005, 0.07).rotation.x = Math.PI / 2;
    }
    legs[s < 0 ? 'L' : 'R'] = { hip, knee };
  }

  // ---- hips and bottom
  const pelvis = add(new THREE.SphereGeometry(0.17, 24, 16), skin, body, 0, WOMAN_HIP - 0.005, -0.012);
  pelvis.scale.set(1.0, 0.64, 0.8);
  const belly = add(new THREE.SphereGeometry(0.13, 20, 14), skin, body, 0, WOMAN_HIP + 0.04, 0.02);
  belly.scale.set(1.05, 0.75, 0.78);
  for (const s of [-1, 1]) {
    const cheek = add(new THREE.SphereGeometry(0.1, 20, 14), skin, body, s * 0.068, WOMAN_HIP - 0.055, -0.062);
    cheek.scale.set(1, 1.02, 0.92);
  }

  // ---- torso (narrow waist), bust, shoulders, neck
  const torso = new THREE.Group();
  torso.position.y = WOMAN_HIP;
  body.add(torso);
  const t = add(lathe([[0, -0.02], [0.158, -0.02], [0.152, 0.06], [0.118, 0.18], [0.116, 0.25], [0.14, 0.36], [0.146, 0.43], [0.126, 0.49], [0.062, 0.545], [0, 0.555]]), skin, torso, 0, 0, 0);
  t.scale.z = 0.66;
  for (const s of [-1, 1]) {
    const bust = add(new THREE.SphereGeometry(0.074, 20, 16), skin, torso, s * 0.062, 0.372, 0.052);
    bust.scale.set(1, 0.92, 0.82);
  }
  const sh = add(new THREE.CapsuleGeometry(0.052, 0.27, 6, 12), skin, torso, 0, 0.49, -0.005);
  sh.rotation.z = Math.PI / 2;
  sh.scale.set(1, 1, 0.72);
  add(new THREE.CylinderGeometry(0.038, 0.046, 0.12, 14), skin, torso, 0, 0.585, 0.0);

  // ---- string bikini
  // top: two small triangles held by thin strings round the neck and the back
  for (const s of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.055, -0.045);
    shape.lineTo(0.055, -0.045);
    shape.lineTo(0.0, 0.055);
    shape.closePath();
    const cup = add(new THREE.ShapeGeometry(shape), swim, torso, s * 0.064, 0.37, 0.114);
    cup.rotation.set(-0.12, s * 0.38, 0);
    cup.castShadow = false;
    const neck = add(new THREE.CylinderGeometry(0.0032, 0.0032, 0.2, 5), swim, torso, s * 0.04, 0.5, 0.06);
    neck.rotation.set(-0.42, 0, s * 0.32);
  }
  const back = add(new THREE.TorusGeometry(0.143, 0.0035, 5, 40), swim, torso, 0, 0.335, 0.004);
  back.rotation.x = Math.PI / 2;
  back.scale.set(1, 0.69, 1);
  // bottom: a small front triangle, strings over the hips, thong back
  const front = new THREE.Shape();
  front.moveTo(-0.07, 0.0);
  front.quadraticCurveTo(0, 0.008, 0.07, 0.0);
  front.lineTo(0.012, -0.095);
  front.lineTo(-0.012, -0.095);
  front.closePath();
  const fr = add(new THREE.ShapeGeometry(front, 6), swim2, body, 0, WOMAN_HIP + 0.015, 0.142);
  fr.rotation.x = -0.18;
  fr.castShadow = false;
  for (const s of [-1, 1]) {
    // high-cut side strings
    const side = add(new THREE.TorusGeometry(0.16, 0.0035, 5, 24, Math.PI / 2.2), swim2, body, 0, WOMAN_HIP + 0.03, 0);
    side.rotation.set(Math.PI / 2, 0, s > 0 ? -0.1 : Math.PI + 0.1 - Math.PI / 2.2 + 0.2);
    side.scale.set(1.04, 0.86, 1);
    add(new THREE.SphereGeometry(0.008, 8, 6), swim2, body, s * 0.162, WOMAN_HIP + 0.03, 0.0); // ties
  }
  const thong = new THREE.Shape();
  thong.moveTo(-0.03, 0.0);
  thong.lineTo(0.03, 0.0);
  thong.lineTo(0.004, -0.11);
  thong.lineTo(-0.004, -0.11);
  thong.closePath();
  const th = add(new THREE.ShapeGeometry(thong), swim2, body, 0, WOMAN_HIP + 0.02, -0.15);
  th.rotation.set(0.25, Math.PI, 0);
  th.castShadow = false;
  const waistBack = add(new THREE.TorusGeometry(0.162, 0.0035, 5, 24, Math.PI * 0.6), swim2, body, 0, WOMAN_HIP + 0.03, 0);
  waistBack.rotation.set(Math.PI / 2, 0, Math.PI * 1.2);
  waistBack.scale.set(1, 0.86, 1);

  // ---- arms: slim
  for (const s of [-1, 1]) {
    const shJ = new THREE.Group();
    shJ.position.set(s * 0.185, 0.49, -0.005);
    torso.add(shJ);
    add(lathe([[0, 0.02], [0.046, 0.0], [0.044, -0.1], [0.036, -0.28], [0, -0.3]]), skin, shJ, 0, 0, 0);
    const el = new THREE.Group();
    el.position.y = -0.29;
    shJ.add(el);
    add(new THREE.SphereGeometry(0.033, 12, 10), skin, el, 0, 0, 0);
    add(lathe([[0, 0.0], [0.034, -0.01], [0.032, -0.1], [0.024, -0.24], [0, -0.25]]), skin, el, 0, 0, 0);
    if (look.bracelet && s > 0) add(new THREE.TorusGeometry(0.03, 0.005, 6, 16), mats.gold, el, 0, -0.22, 0).rotation.x = Math.PI / 2;
    const hand = new THREE.Group();
    hand.position.y = -0.27;
    el.add(hand);
    const palm = add(new THREE.SphereGeometry(0.035, 12, 10), skin, hand, 0, -0.01, 0);
    palm.scale.set(0.75, 1.25, 0.45);
    add(new THREE.CapsuleGeometry(0.011, 0.035, 4, 8), skin, hand, s * -0.025, 0.0, 0.012).rotation.z = s * 0.6;
    if (look.nails) add(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshStandardMaterial({ color: look.nails, roughness: 0.2 }), hand, 0, -0.055, 0.01);
    const socket = new THREE.Group();
    socket.position.set(0, -0.04, 0.03);
    hand.add(socket);
    arms[s < 0 ? 'L' : 'R'] = { sh: shJ, el, hand, socket };
  }

  // ---- head: a mature, beautiful face
  const head = new THREE.Group();
  head.position.y = 0.61;
  torso.add(head);
  const face = add(lathe([[0, 0.0], [0.032, 0.004], [0.064, 0.03], [0.084, 0.075], [0.094, 0.125], [0.093, 0.165], [0.08, 0.2], [0.05, 0.225], [0, 0.232]], 28), skin, head, 0, 0, 0);
  face.scale.set(0.92, 1, 1.1);
  for (const s of [-1, 1]) {
    // almond eyes with lashes and a little liner wing
    const ex = s * 0.032;
    const white = add(new THREE.SphereGeometry(0.0165, 16, 12), mats.eyeWhite, head, ex, 0.125, 0.094);
    white.scale.set(1.5, 0.68, 0.5);
    add(new THREE.SphereGeometry(0.0092, 14, 10), mats.iris, head, ex, 0.1245, 0.1002).scale.set(1, 1.05, 0.4);
    add(new THREE.SphereGeometry(0.0046, 10, 8), mats.pupil, head, ex, 0.1245, 0.1028).scale.set(1, 1, 0.35);
    add(new THREE.SphereGeometry(0.0019, 6, 4), mats.spec, head, ex + 0.003, 0.1275, 0.1042);
    // upper lid with lashes, and a small liner wing
    const lid = add(new THREE.SphereGeometry(0.0172, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), skin, head, ex, 0.1258, 0.0935);
    lid.scale.set(1.52, 0.6, 0.55);
    const lash = add(new THREE.BoxGeometry(0.046, 0.003, 0.007), dark, head, ex, 0.1315, 0.0995);
    lash.rotation.set(-0.35, 0, s * -0.1);
    const wing = add(new THREE.BoxGeometry(0.012, 0.0028, 0.004), dark, head, s * 0.057, 0.1338, 0.0915);
    wing.rotation.z = s * 0.55;
    // softly arched brows
    const brow1 = add(new THREE.BoxGeometry(0.022, 0.0026, 0.005), mats.hair, head, s * 0.024, 0.1455, 0.1012);
    brow1.rotation.set(-0.3, 0, s * -0.15);
    const brow2 = add(new THREE.BoxGeometry(0.018, 0.0024, 0.005), mats.hair, head, s * 0.045, 0.1452, 0.0972);
    brow2.rotation.set(-0.3, s * -0.4, s * 0.28);
    add(new THREE.SphereGeometry(0.018, 10, 8), skin, head, s * 0.086, 0.115, -0.005).scale.set(0.45, 1, 0.75);
    if (look.earrings) add(new THREE.TorusGeometry(0.009, 0.0018, 6, 14), mats.gold, head, s * 0.087, 0.088, 0.0);
  }
  // nose
  const bridge = add(new THREE.SphereGeometry(0.009, 10, 8), skin, head, 0, 0.104, 0.099);
  bridge.scale.set(0.6, 1.8, 0.7);
  add(new THREE.SphereGeometry(0.0085, 10, 8), skin, head, 0, 0.089, 0.1025).scale.set(1.1, 0.9, 0.9);
  // full lips with a soft smile
  const upper = add(new THREE.SphereGeometry(0.0112, 14, 10), lip, head, 0, 0.0668, 0.0885);
  upper.scale.set(1.75, 0.48, 0.6);
  const lower = add(new THREE.SphereGeometry(0.0115, 14, 10), lip, head, 0, 0.0595, 0.0875);
  lower.scale.set(1.6, 0.58, 0.62);

  // ---- hair
  const hair = mats.hair;
  const cap = add(new THREE.SphereGeometry(0.104, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, head, 0, 0.134, -0.006);
  cap.rotation.x = -0.32;
  cap.scale.set(0.97, 1.03, 1.14);
  const backHair = add(new THREE.SphereGeometry(0.1, 20, 14), hair, head, 0, 0.128, -0.022);
  backHair.scale.set(0.98, 1.06, 1.04);
  const hs = look.hairStyle;
  if (hs === 'long' || hs === 'wavy') {
    const fall = add(new THREE.CapsuleGeometry(0.085, 0.26, 8, 16), hair, head, 0, -0.03, -0.055);
    fall.scale.set(1.08, 1, 0.48);
    for (const s of [-1, 1]) {
      const strand = add(new THREE.CapsuleGeometry(0.028, 0.24, 6, 10), hair, head, s * 0.082, 0.01, 0.025);
      strand.rotation.z = s * 0.1;
      if (hs === 'wavy') for (let k = 0; k < 4; k++) add(new THREE.SphereGeometry(0.03, 10, 8), hair, head, s * (0.075 + (k % 2) * 0.016), -0.06 - k * 0.055, 0.0 - k * 0.012);
    }
    // side-swept fringe
    const fringe = add(new THREE.SphereGeometry(0.06, 16, 10), hair, head, 0.03, 0.2, 0.05);
    fringe.scale.set(1.4, 0.45, 1.0);
    fringe.rotation.z = -0.35;
  } else if (hs === 'ponytail') {
    add(new THREE.SphereGeometry(0.03, 10, 8), hair, head, 0, 0.17, -0.1);
    const tail = add(new THREE.CapsuleGeometry(0.03, 0.22, 6, 10), hair, head, 0, 0.03, -0.13);
    tail.rotation.x = 0.3;
  } else if (hs === 'bun') {
    add(new THREE.SphereGeometry(0.045, 14, 12), hair, head, 0, 0.22, -0.06);
  } else {
    // sleek shoulder-length lob
    const lob = add(new THREE.CapsuleGeometry(0.085, 0.12, 8, 16), hair, head, 0, 0.05, -0.045);
    lob.scale.set(1.1, 1, 0.62);
    for (const s of [-1, 1]) add(new THREE.CapsuleGeometry(0.03, 0.13, 6, 10), hair, head, s * 0.084, 0.06, 0.02);
    const fringe = add(new THREE.SphereGeometry(0.06, 16, 10), hair, head, -0.02, 0.2, 0.05);
    fringe.scale.set(1.5, 0.4, 1.0);
    fringe.rotation.z = 0.3;
  }
  if (look.sunglassesOnHead) {
    const sg = new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.05, metalness: 0.5 });
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.036, 0.022, 0.006), sg, head, s * 0.03, 0.225, 0.045).rotation.x = -1.0;
  }
  return { legs, torso, arms, head };
}
