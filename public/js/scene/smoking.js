// Cigars: the cigar itself (it burns down, glows when you draw on it, grows ash),
// a walnut humidor with a lid that opens, a guillotine cutter, a jet lighter with
// a blue torch flame, the big cigar ashtray (four rests, shared), and the smoke.
import * as THREE from 'three';

const wrapperMat = new THREE.MeshStandardMaterial({ color: '#5b3a1f', roughness: 0.75 });
const bandMat = new THREE.MeshStandardMaterial({ color: '#c9a15e', metalness: 0.7, roughness: 0.3 });
const bandRed = new THREE.MeshStandardMaterial({ color: '#7a1424', roughness: 0.5 });
const ashMat = new THREE.MeshStandardMaterial({ color: '#b9b4ac', roughness: 1 });
const capMat = new THREE.MeshStandardMaterial({ color: '#4a2e18', roughness: 0.8 });

const LEN = 0.15, R = 0.0105;

/**
 * A cigar lying along its local +z axis; the foot (lit end) is at +z, the cap
 * (the end you cut and smoke) at z = 0.
 */
export function makeCigar() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1, 14), wrapperMat);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  cap.rotation.x = -Math.PI / 2;
  g.add(cap);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.04, R * 1.04, 0.016, 14), bandMat);
  band.rotation.x = Math.PI / 2;
  band.position.z = 0.03;
  g.add(band);
  const band2 = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.05, R * 1.05, 0.006, 14), bandRed);
  band2.rotation.x = Math.PI / 2;
  band2.position.z = 0.03;
  g.add(band2);
  const emberMat = new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: '#ff5a14', emissiveIntensity: 0, roughness: 0.9, toneMapped: false });
  const ember = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.98, R * 0.98, 0.004, 14), emberMat);
  ember.rotation.x = Math.PI / 2;
  g.add(ember);
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.97, R * 0.9, 1, 12), ashMat);
  ash.rotation.x = Math.PI / 2;
  g.add(ash);
  const glowMat = new THREE.SpriteMaterial({ color: '#ff7a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(0.05);
  g.add(glow);

  const st = { length: 1, lit: 0, puff: 0, ash: 0, cut: false };
  function layout() {
    const burnt = (1 - st.length) * LEN * 0.8; // tobacco smoked away
    const len = LEN - burnt;
    body.scale.y = len;
    body.position.z = len / 2;
    ember.position.z = len + 0.001;
    const ashLen = Math.min(0.025, st.ash);
    ash.visible = ashLen > 0.001;
    ash.scale.y = Math.max(0.001, ashLen);
    ash.position.z = len + ashLen / 2;
    glow.position.z = len + ashLen + 0.004;
    cap.visible = !st.cut;
    band.visible = band2.visible = st.length > 0.35;
    const heat = st.lit * (0.55 + st.puff * 1.6);
    emberMat.emissiveIntensity = heat * 2.4;
    glowMat.opacity = Math.min(0.9, heat * 0.55);
  }
  layout();
  g.userData = {
    kind: 'cigar',
    state: st,
    /** Where the smoke comes from (world space). */
    tip: (out = new THREE.Vector3()) => glow.getWorldPosition(out),
    setLength(k) { st.length = Math.max(0.05, k); layout(); },
    setLit(k) { st.lit = THREE.MathUtils.clamp(k, 0, 1); layout(); },
    setPuff(k) { st.puff = k; layout(); },
    setAsh(m) { st.ash = m; layout(); },
    cut() { st.cut = true; layout(); },
    layout,
  };
  g.traverse((o) => o.isMesh && (o.castShadow = false));
  return g;
}

/** The little piece the cutter takes off the cap. */
export function cigarTip() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(R, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  return m;
}

// ---------------------------------------------------------------- humidor
/**
 * A walnut humidor with a glass-topped lid on a hinge at the back. Cigars lie
 * in a row inside. Origin at the bottom centre, front facing +z.
 */
export function makeHumidor(count = 8) {
  const g = new THREE.Group();
  const W = 0.42, D = 0.28, H = 0.11;
  const walnut = new THREE.MeshStandardMaterial({ color: '#4a2a17', roughness: 0.35, metalness: 0.05 });
  const cedar = new THREE.MeshStandardMaterial({ color: '#b07a4f', roughness: 0.8 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a15e', metalness: 1, roughness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.18, depthWrite: false });
  const add = (geo, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  // walls and floor
  add(new THREE.BoxGeometry(W, 0.012, D), walnut, 0, 0.006, 0);
  add(new THREE.BoxGeometry(W, H, 0.014), walnut, 0, H / 2, D / 2 - 0.007);
  add(new THREE.BoxGeometry(W, H, 0.014), walnut, 0, H / 2, -D / 2 + 0.007);
  add(new THREE.BoxGeometry(0.014, H, D), walnut, W / 2 - 0.007, H / 2, 0);
  add(new THREE.BoxGeometry(0.014, H, D), walnut, -W / 2 + 0.007, H / 2, 0);
  add(new THREE.BoxGeometry(W - 0.03, 0.004, D - 0.03), cedar, 0, 0.014, 0);
  add(new THREE.BoxGeometry(0.06, 0.02, 0.004), brass, 0, H - 0.02, D / 2 + 0.002); // clasp
  // lid, hinged at the back edge
  const lid = new THREE.Group();
  lid.position.set(0, H, -D / 2);
  g.add(lid);
  add(new THREE.BoxGeometry(W, 0.03, 0.03), walnut, 0, 0.015, D - 0.015, lid);
  add(new THREE.BoxGeometry(W, 0.03, 0.03), walnut, 0, 0.015, 0.015, lid);
  add(new THREE.BoxGeometry(0.03, 0.03, D), walnut, W / 2 - 0.015, 0.015, D / 2, lid);
  add(new THREE.BoxGeometry(0.03, 0.03, D), walnut, -W / 2 + 0.015, 0.015, D / 2, lid);
  add(new THREE.BoxGeometry(W - 0.06, 0.004, D - 0.06), glass, 0, 0.02, D / 2, lid);
  add(new THREE.BoxGeometry(0.08, 0.004, 0.03), brass, 0, 0.032, D / 2, lid); // plaque
  // cigars in a row, foot towards the front
  const cigars = [];
  const slots = [];
  for (let i = 0; i < count; i++) slots.push(new THREE.Vector3(-W / 2 + 0.045 + i * ((W - 0.09) / (count - 1)), 0.028, -0.075));
  function restock() {
    for (const p of slots) {
      if (cigars.some((c) => c.parent === g && c.position.distanceTo(p) < 0.005)) continue;
      const c = makeCigar();
      c.position.copy(p);
      g.add(c);
      cigars.push(c);
    }
  }
  restock();
  let open = 0, target = 0;
  g.userData = {
    lid,
    cigars,
    get open() { return target > 0.5; },
    restock() {
      for (let i = cigars.length - 1; i >= 0; i--) if (cigars[i].parent !== g) cigars.splice(i, 1);
      restock();
    },
    setOpen(on) { target = on ? 1 : 0; },
    update(dt) {
      open += (target - open) * Math.min(1, dt * 5);
      lid.rotation.x = -open * 1.75;
    },
  };
  g.traverse((o) => o.isMesh && (o.castShadow = false));
  return g;
}

// ---------------------------------------------------------------- cutter
export function makeCutter() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#d8d8d8', metalness: 1, roughness: 0.2 });
  const black = new THREE.MeshStandardMaterial({ color: '#111', metalness: 0.4, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.038), black);
  g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.003, 6, 18), steel);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.036), steel);
  blade.position.set(0.02, 0.006, 0);
  g.add(blade);
  g.position.y = 0.004;
  g.userData = { kind: 'cutter', blade, snip(k) { blade.position.x = 0.02 - Math.sin(k * Math.PI) * 0.02; } };
  return g;
}

// ---------------------------------------------------------------- jet lighter
export function makeJetLighter() {
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: '#141414', metalness: 0.6, roughness: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a15e', metalness: 1, roughness: 0.25 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.07, 0.014), black);
  body.position.y = 0.035;
  g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.014), gold);
  top.position.y = 0.076;
  g.add(top);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.012, 8), gold);
  nozzle.position.set(0, 0.088, 0);
  g.add(nozzle);
  const flameMat = new THREE.MeshBasicMaterial({ color: '#6fb6ff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.055, 10), flameMat);
  flame.position.y = 0.122;
  flame.visible = false;
  g.add(flame);
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.0022, 0.016, 8), new THREE.MeshBasicMaterial({ color: '#e8f4ff', toneMapped: false }));
  core.position.y = 0.102;
  core.visible = false;
  g.add(core);
  g.userData = {
    kind: 'lighter',
    setFlame(on, t = 0) {
      flame.visible = core.visible = on;
      if (on) flame.scale.set(1, 0.85 + Math.sin(t * 40) * 0.15, 1);
    },
  };
  g.traverse((o) => o.isMesh && (o.castShadow = false));
  return g;
}

// ---------------------------------------------------------------- ashtray
/**
 * A big, heavy cigar ashtray (black glass with a gold rim) with four rests, so
 * people can share it. Origin at the base; `rests` are local positions + angle
 * (cigar lies across the rest, foot pointing over the bowl).
 */
export function makeAshtray() {
  const g = new THREE.Group();
  const R0 = 0.13;
  const glass = new THREE.MeshPhysicalMaterial({ color: '#0d0d0f', roughness: 0.08, metalness: 0.1, clearcoat: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a15e', metalness: 1, roughness: 0.3 });
  const ash = new THREE.MeshStandardMaterial({ color: '#8f8a83', roughness: 1 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0 * 0.95, 0.04, 40), glass);
  base.position.y = 0.02;
  g.add(base);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(R0 * 0.72, R0 * 0.6, 0.01, 40), ash);
  bowl.position.y = 0.036;
  g.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R0 * 0.99, 0.004, 6, 48), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.04;
  g.add(rim);
  const rests = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.05), glass);
    notch.position.set(Math.sin(a) * R0 * 0.93, 0.046, Math.cos(a) * R0 * 0.93);
    notch.rotation.y = a;
    g.add(notch);
    // the cigar rests in the notch, cap outside, foot over the bowl
    rests.push({ pos: new THREE.Vector3(Math.sin(a) * (R0 + 0.06), 0.05, Math.cos(a) * (R0 + 0.06)), angle: a + Math.PI, taken: null });
  }
  g.userData = { kind: 'ashtray', rests };
  g.traverse((o) => o.isMesh && (o.castShadow = false));
  return g;
}

/** World position + rotation for a cigar lying in a rest of this ashtray. */
export function restPose(tray, rest) {
  tray.updateMatrixWorld(true);
  const pos = tray.localToWorld(rest.pos.clone());
  const q = new THREE.Quaternion();
  tray.getWorldQuaternion(q);
  const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y + rest.angle;
  return { pos, yaw };
}

// ---------------------------------------------------------------- smoke
function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Soft smoke puffs that rise, drift, grow and fade. */
export class Smoke {
  constructor(scene, max = 160) {
    this.scene = scene;
    this.tex = smokeTexture();
    this.pool = [];
    this.live = [];
    for (let i = 0; i < max; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, color: '#d9d4cc', transparent: true, opacity: 0, depthWrite: false }));
      s.visible = false;
      scene.add(s);
      this.pool.push(s);
    }
  }

  /** A wisp (resting cigar) or a puff (exhaled: bigger, faster, sideways). */
  emit(pos, { big = false, dir = null } = {}) {
    const s = this.pool.pop();
    if (!s) return;
    s.visible = true;
    s.position.copy(pos);
    const v = new THREE.Vector3((Math.random() - 0.5) * 0.03, big ? 0.12 : 0.07, (Math.random() - 0.5) * 0.03);
    if (dir) v.addScaledVector(dir, big ? 0.35 : 0.1);
    this.live.push({ s, v, age: 0, life: big ? 2.6 : 3.2, size0: big ? 0.05 : 0.02, size1: big ? 0.45 : 0.22, op: big ? 0.5 : 0.28 });
  }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.s.visible = false;
        p.s.material.opacity = 0;
        this.pool.push(p.s);
        this.live.splice(i, 1);
        continue;
      }
      p.v.multiplyScalar(1 - dt * 0.6);
      p.v.y += dt * 0.02;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(p.size0 + (p.size1 - p.size0) * Math.sqrt(k));
      p.s.material.opacity = p.op * Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - k);
    }
  }
}
