// Drinks, glasses and bottles for the rooftop bar.
import * as THREE from 'three';

export const DRINKS = {
  whisky: { name: 'Whisky', note: 'Single malt, neat or on the rocks', glass: 'tumbler', color: '#b5681a', bottle: 'whisky', ice: 'rock' },
  cognac: { name: 'Cognac', note: 'XO, in a crystal tumbler', glass: 'tumbler', color: '#7c3209', bottle: 'cognac' },
  champagne: { name: 'Champagne', note: 'Brut, ice cold', glass: 'wine', color: '#efd78a', bottle: 'champagne' },
  wine: { name: 'Red Wine', note: 'Cypriot Maratheftiko', glass: 'wine', color: '#4e0b18', bottle: 'wine' },
  rose: { name: 'Rosé', note: 'Chilled, from Limassol', glass: 'wine', color: '#f0a49a', bottle: 'rose' },
  // cocktails: liquor up to `base`, then the mixer, a stir (or the grenadine sinking for a sunset), garnish
  sunset: { name: 'Agentium Sunset', note: 'Tequila, orange and grenadine, over crushed ice', glass: 'hurricane', color: '#f2a024', bottom: '#c0182a', bottle: 'vodka', ice: 'crushed', garnish: '#f4d23c', base: 0.3, mixer: 'orange', mixTo: 0.88, finish: 'grenadine' },
  gintonic: { name: 'Gin & Tonic', note: 'With lime and plenty of ice', glass: 'hurricane', color: '#dff2ea', clear: true, bottle: 'gin', ice: 'cubes', garnish: '#8cc63f', base: 0.3, mixer: 'tonic', stir: true },
  martini: { name: 'Vodka Martini', note: 'Vodka and dry vermouth, stirred, served tall over ice', glass: 'hurricane', color: '#eaf2f4', clear: true, bottle: 'vodka', ice: 'cubes', garnish: '#f4d23c', base: 0.55, mixer: 'vermouth', stir: true },
};

// ---------------------------------------------------------------- real glassware
// Three glasses, turned on a lathe with real wall thickness:
//   tumbler   — short cut-crystal whisky glass (whisky, cognac)
//   wine      — stemmed wine glass (wine, rosé, champagne)
//   hurricane — tall stemmed cocktail glass (every cocktail)
// Profiles are [radius, height] in metres, outside up to the rim, then the inside back down.
const PROFILES = {
  tumbler: {
    outer: [[0, 0], [0.036, 0], [0.0372, 0.004], [0.0398, 0.088], [0.0392, 0.0905]],
    inner: [[0.0372, 0.0885], [0.0336, 0.015], [0, 0.015]],
    fillMax: 0.05,
  },
  wine: {
    outer: [[0, 0], [0.038, 0], [0.0385, 0.003], [0.008, 0.006], [0.0035, 0.014], [0.0033, 0.088], [0.009, 0.097], [0.026, 0.108], [0.04, 0.127], [0.0465, 0.152], [0.0448, 0.182], [0.0385, 0.215], [0.0362, 0.229]],
    inner: [[0.0348, 0.229], [0.037, 0.215], [0.0433, 0.182], [0.045, 0.152], [0.0386, 0.127], [0.024, 0.11], [0, 0.101]],
    fillMax: 0.148,
  },
  hurricane: {
    outer: [[0, 0], [0.04, 0], [0.041, 0.004], [0.009, 0.008], [0.006, 0.02], [0.0115, 0.028], [0.006, 0.037], [0.006, 0.05], [0.017, 0.059], [0.0305, 0.09], [0.0335, 0.115], [0.0272, 0.15], [0.0302, 0.18], [0.0405, 0.225], [0.0432, 0.246]],
    inner: [[0.0418, 0.246], [0.039, 0.225], [0.0287, 0.18], [0.0257, 0.15], [0.032, 0.115], [0.029, 0.09], [0.015, 0.061], [0, 0.057]],
    fillMax: 0.232,
  },
};

function cutCrystalTexture() {
  // the diamond / star cuts of a crystal tumbler, used as a bump map
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 256, 256);
  // lower band: diamond grid
  x.lineWidth = 3;
  for (let i = -8; i < 16; i++) {
    x.strokeStyle = '#f0f0f0';
    x.beginPath(); x.moveTo(i * 32, 256); x.lineTo(i * 32 + 128, 100); x.stroke();
    x.strokeStyle = '#202020';
    x.beginPath(); x.moveTo(i * 32 + 128, 256); x.lineTo(i * 32, 100); x.stroke();
  }
  // upper band: tall fan / star cuts
  for (let i = 0; i < 4; i++) {
    const cx = 32 + i * 64;
    for (let k = -3; k <= 3; k++) {
      x.strokeStyle = k % 2 ? '#e8e8e8' : '#2a2a2a';
      x.lineWidth = 2.5;
      x.beginPath(); x.moveTo(cx, 110); x.lineTo(cx + k * 9, 30 + Math.abs(k) * 10); x.stroke();
    }
  }
  // clear band below the rim
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 256, 22);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  return t;
}

let mats = null;
function glassMats() {
  if (mats) return mats;
  const base = { color: '#e4eef0', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.FrontSide, envMapIntensity: 1.1, specularIntensity: 1, ior: 1.5 };
  mats = {
    plain: new THREE.MeshPhysicalMaterial(base),
    crystal: new THREE.MeshPhysicalMaterial({ ...base, opacity: 0.2, bumpMap: cutCrystalTexture(), bumpScale: 3 }),
    ice: new THREE.MeshPhysicalMaterial({ color: '#f4fbff', roughness: 0.15, transparent: true, opacity: 0.55, depthWrite: false, envMapIntensity: 1.5 }),
    crushed: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, transparent: true, opacity: 0.85 }),
  };
  return mats;
}

const v2 = (pts) => pts.map(([r, y]) => new THREE.Vector2(r, y));
function innerRadius(inner, y) {
  // (an axis point at the same height as a wall point is the floor of the bowl: skip it)
  const pts = inner.filter((p) => p[0] > 0 || !inner.some((q) => q !== p && q[1] === p[1])).sort((a, b) => a[1] - b[1]);
  if (y <= pts[0][1]) return pts[0][0];
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][1]) {
      const [r0, y0] = pts[i - 1], [r1, y1] = pts[i];
      return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
    }
  }
  return pts[pts.length - 1][0];
}

/** A glass with a liquid that can be filled 0..1. Origin at the base. */
export function makeGlass(type) {
  const d = DRINKS[type] || DRINKS.whisky;
  const P = PROFILES[d.glass] || PROFILES.tumbler;
  const M = glassMats();
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.LatheGeometry(v2([...P.outer, ...P.inner]), 40), d.glass === 'tumbler' ? M.crystal : M.plain);
  shell.renderOrder = 2;
  g.add(shell);

  // the liquid follows the inside of the glass
  const bottomY = Math.min(...P.inner.map((p) => p[1]));
  const two = !!d.bottom;
  const liquidMat = new THREE.MeshPhysicalMaterial({ color: two ? '#ffffff' : d.color, vertexColors: two, roughness: 0.08, transparent: true, opacity: d.clear ? 0.32 : 0.93, emissive: d.color, emissiveIntensity: 0.1, depthWrite: false });
  const liquid = new THREE.Mesh(new THREE.BufferGeometry(), liquidMat);
  liquid.renderOrder = 1;
  g.add(liquid);
  const cTop = new THREE.Color(d.color), cBot = new THREE.Color(d.bottom || d.color);
  let builtLevel = -1;
  let twoNow = two; // a sunset only turns red at the bottom once the grenadine goes in
  function buildLiquid(level) {
    const top = bottomY + (P.fillMax - bottomY) * level;
    const pts = [new THREE.Vector2(0, bottomY + 0.001)];
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const y = bottomY + 0.001 + ((top - bottomY - 0.001) * i) / N;
      pts.push(new THREE.Vector2(Math.max(0.002, innerRadius(P.inner, y) - 0.0012), y));
    }
    pts.push(new THREE.Vector2(0, top));
    const geo = new THREE.LatheGeometry(pts, 28);
    if (two) {
      const cB = twoNow ? cBot : cTop;
      const pos = geo.attributes.position;
      const col = new Float32Array(pos.count * 3);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const k = THREE.MathUtils.smoothstep((pos.getY(i) - bottomY) / (P.fillMax - bottomY), 0.05, 0.55);
        c.copy(cB).lerp(cTop, k);
        col.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    liquid.geometry.dispose();
    liquid.geometry = geo;
  }

  const extras = [];
  const fillTop = () => bottomY + (P.fillMax - bottomY) * Math.max(0.15, builtLevel);
  if (d.ice === 'rock') {
    // one big clear cube in the whisky
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.034, 0.038), M.ice);
    cube.rotation.set(0.08, 0.5, 0.05);
    g.add(cube);
    extras.push({ m: cube, place: () => cube.position.set(0, fillTop() - 0.008, 0) });
  } else if (d.ice === 'cubes') {
    for (let i = 0; i < 4; i++) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), M.ice);
      const a = i * 1.7;
      cube.rotation.set(a, a * 0.7, 0.3);
      g.add(cube);
      extras.push({ m: cube, place: () => cube.position.set(Math.cos(a) * 0.012, fillTop() - 0.012 - (i % 2) * 0.015, Math.sin(a) * 0.012) });
    }
  } else if (d.ice === 'crushed') {
    const r = innerRadius(P.inner, P.fillMax) - 0.002;
    const heap = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M.crushed);
    heap.scale.set(1, 0.35, 1);
    g.add(heap);
    extras.push({ m: heap, place: () => heap.position.set(0, fillTop() + 0.004, 0) });
  }
  if (d.garnish) {
    // a citrus wheel on the rim
    const rimR = P.outer[P.outer.length - 1][0];
    const rimY = P.outer[P.outer.length - 1][1];
    const wheel = new THREE.Group();
    const rind = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.005, 20), new THREE.MeshStandardMaterial({ color: d.garnish, roughness: 0.5 }));
    const flesh = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.0055, 20), new THREE.MeshStandardMaterial({ color: new THREE.Color(d.garnish).lerp(new THREE.Color('#fff8d0'), 0.5), roughness: 0.7, emissive: d.garnish, emissiveIntensity: 0.08 }));
    wheel.add(rind, flesh);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(rimR - 0.004, rimY - 0.006, 0);
    wheel.rotation.z = 0.25;
    g.add(wheel);
    extras.push({ m: wheel, place: () => {}, garnish: true });
  }
  // a bar spoon, shown while the barman stirs
  const spoon = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#d9d9d9', metalness: 1, roughness: 0.2 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, P.fillMax + 0.12, 6), steel);
  shaft.position.y = (P.fillMax + 0.12) / 2;
  spoon.add(shaft);
  const bowlS = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), steel);
  bowlS.scale.set(1, 0.4, 1.6);
  spoon.add(bowlS);
  spoon.position.y = bottomY + 0.01;
  spoon.visible = false;
  g.add(spoon);
  // manual control (the barman builds the drink step by step)
  const manual = { on: false, ice: false, garnish: false };

  g.userData.type = type;
  // where the hand holds it: around a tumbler, by the stem of a wine glass, the bowl of a hurricane
  g.userData.hold = { tumbler: 0.04, wine: 0.055, hurricane: 0.075 }[d.glass] ?? 0.04;
  g.userData.height = P.outer[P.outer.length - 1][1];
  g.userData.setFill = (f) => {
    f = Math.max(0, Math.min(1, f));
    const level = Math.round(f * 30) / 30;
    liquid.visible = level > 0.02;
    if (level !== builtLevel) {
      builtLevel = level;
      if (liquid.visible) buildLiquid(level);
    }
    for (const e of extras) {
      e.m.visible = manual.on ? (e.garnish ? manual.garnish : manual.ice) : f > 0.5;
      e.place();
    }
  };
  /** Ice in the glass (before anything is poured). */
  g.userData.setIce = (on) => { manual.on = true; manual.ice = on; g.userData.setFill(builtLevel < 0 ? 0 : Math.max(0, builtLevel)); };
  g.userData.setGarnish = (on) => { manual.on = true; manual.garnish = on; g.userData.setFill(Math.max(0, builtLevel)); };
  g.userData.setTwoTone = (on) => { twoNow = on && two; builtLevel = -1; };
  /** Stirring: the spoon goes round inside the glass (k = 0..1 through the stir, or false). */
  g.userData.stir = (k) => {
    spoon.visible = k !== false;
    if (k !== false) {
      const a = k * Math.PI * 10;
      const r = innerRadius(P.inner, bottomY + 0.03) * 0.45;
      spoon.position.set(Math.cos(a) * r, bottomY + 0.01, Math.sin(a) * r);
      spoon.rotation.set(Math.sin(a) * 0.08, 0, Math.cos(a) * 0.08);
    }
  };
  g.userData.manual = () => { manual.on = true; };
  g.userData.empty = () => builtLevel <= 0.02;
  g.userData.level = () => Math.max(0, builtLevel);
  g.userData.setFill(1);
  g.traverse((o) => o.isMesh && (o.castShadow = false));
  return g;
}

const BOTTLES = {
  whisky: { shape: 'square', glass: '#8a4a12', label: '#111111', band: '#c9a15e', h: 0.28 },
  whisky2: { shape: 'square', glass: '#9a5a1a', label: '#c9a15e', band: '#7a1a1a', h: 0.28 },
  cognac: { shape: 'flask', glass: '#6a2a08', label: '#e9dcc0', band: '#c9a15e', h: 0.26 },
  champagne: { shape: 'champagne', glass: '#1d3322', label: '#e8d9a8', band: '#d6b25e', h: 0.33 },
  gin: { shape: 'round', glass: '#bfe3d2', label: '#2a5d7a', band: '#ffffff', h: 0.3 },
  vodka: { shape: 'tall', glass: '#e8eef2', label: '#f4f4f4', band: '#b0b8c0', h: 0.32 },
  wine: { shape: 'wine', glass: '#2a0a10', label: '#efe6d2', band: '#5a0f1c', h: 0.31 },
  rose: { shape: 'wine', glass: '#f4b9ae', label: '#ffffff', band: '#c9a15e', h: 0.31 },
  // mixers (on the back counter, in front of the niches)
  tonic: { shape: 'round', glass: '#cfe9df', label: '#f2d36b', band: '#1d3a5a', h: 0.2 },
  orange: { shape: 'tall', glass: '#f2a024', label: '#ffffff', band: '#f2a024', h: 0.24 },
  grenadine: { shape: 'round', glass: '#9a1020', label: '#f4e7d0', band: '#c9a15e', h: 0.18 },
  vermouth: { shape: 'wine', glass: '#c9d6b0', label: '#efe6d2', band: '#2f4a2a', h: 0.27 },
};
export const MIXERS = ['tonic', 'orange', 'grenadine', 'vermouth'];

/** A bottle, origin at the base. */
export function makeBottle(kind) {
  const b = BOTTLES[kind] || BOTTLES.whisky;
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: b.glass, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88 });
  const label = new THREE.MeshStandardMaterial({ color: b.label, roughness: 0.6 });
  const band = new THREE.MeshStandardMaterial({ color: b.band, roughness: 0.35, metalness: 0.6 });
  const add = (geo, mat, y) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    g.add(m);
    return m;
  };
  const h = b.h;
  if (b.shape === 'square') {
    add(new THREE.BoxGeometry(0.075, h * 0.68, 0.075), glass, h * 0.34);
    add(new THREE.BoxGeometry(0.077, h * 0.28, 0.077), label, h * 0.32).scale.set(1, 1, 1);
    add(new THREE.BoxGeometry(0.078, 0.02, 0.078), band, h * 0.5);
    add(new THREE.CylinderGeometry(0.016, 0.03, h * 0.14, 10), glass, h * 0.75);
    add(new THREE.CylinderGeometry(0.018, 0.018, h * 0.12, 10), band, h * 0.88);
  } else if (b.shape === 'flask') {
    const body = add(new THREE.SphereGeometry(0.06, 16, 12), glass, h * 0.32);
    body.scale.set(1, 1.15, 0.75);
    add(new THREE.CylinderGeometry(0.061, 0.061, h * 0.12, 16), label, h * 0.3).scale.z = 0.76;
    add(new THREE.CylinderGeometry(0.014, 0.022, h * 0.3, 10), glass, h * 0.7);
    add(new THREE.SphereGeometry(0.022, 10, 8), band, h * 0.9);
  } else {
    const r = b.shape === 'tall' ? 0.034 : b.shape === 'round' ? 0.042 : 0.036;
    const bodyH = b.shape === 'champagne' ? h * 0.55 : h * 0.6;
    add(new THREE.CylinderGeometry(r, r, bodyH, 16), glass, bodyH / 2);
    add(new THREE.CylinderGeometry(r + 0.001, r + 0.001, bodyH * 0.4, 16), label, bodyH * 0.45);
    add(new THREE.CylinderGeometry(0.014, r, h * 0.18, 16), glass, bodyH + h * 0.09);
    add(new THREE.CylinderGeometry(0.014, 0.014, h * 0.2, 10), b.shape === 'champagne' ? band : glass, bodyH + h * 0.28);
    if (b.shape !== 'champagne') add(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10), band, h * 0.97);
  }
  g.userData.kind = kind;
  g.userData.height = b.h; // the neck is at the top: where it pours from
  g.traverse((o) => o.isMesh && (o.castShadow = false));
  return g;
}

export const BOTTLE_KINDS = Object.keys(BOTTLES).filter((k) => !MIXERS.includes(k));

/** A thin stream of liquid from a bottle neck down into a glass. */
export function makeStream() {
  const mat = new THREE.MeshStandardMaterial({ color: '#b5681a', roughness: 0.15, transparent: true, opacity: 0.8, emissive: '#000', depthWrite: false });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0045, 1, 8, 1, true), mat);
  m.visible = false;
  m.castShadow = false;
  const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
  m.userData.set = (from, to, color, t = 0) => {
    if (!from) { m.visible = false; return; }
    m.visible = true;
    if (color) { mat.color.set(color); mat.emissive.set(color).multiplyScalar(0.12); }
    d.subVectors(from, to);
    const len = Math.max(0.005, d.length());
    m.scale.set(1 + Math.sin(t * 40) * 0.08, len, 1 + Math.cos(t * 37) * 0.08);
    m.position.addVectors(from, to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(up, d.normalize());
  };
  return m;
}

/** The colour of what pours out of a bottle. */
export const POUR_COLORS = { whisky: '#b5681a', cognac: '#7c3209', champagne: '#efd78a', gin: '#e9f4f0', vodka: '#eef4f6', wine: '#4e0b18', rose: '#f0a49a', tonic: '#e2f4ec', orange: '#f2a024', grenadine: '#9a1020', vermouth: '#ece6c6' };
