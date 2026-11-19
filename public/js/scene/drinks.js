// Drinks, glasses and bottles for the rooftop bar.
import * as THREE from 'three';

export const DRINKS = {
  whisky: { name: 'Whisky', note: 'Single malt, neat or on the rocks', glass: 'tumbler', color: '#b5681a', bottle: 'whisky', ice: true },
  cognac: { name: 'Cognac', note: 'XO, warmed in the glass', glass: 'snifter', color: '#7c3209', bottle: 'cognac' },
  champagne: { name: 'Champagne', note: 'Brut, ice cold', glass: 'flute', color: '#efd78a', bottle: 'champagne' },
  gintonic: { name: 'Gin & Tonic', note: 'With lime and plenty of ice', glass: 'highball', color: '#e6f3ee', bottle: 'gin', ice: true, garnish: '#7fbf3a' },
  martini: { name: 'Vodka Martini', note: 'Shaken, with an olive', glass: 'martini', color: '#eef4f6', bottle: 'vodka', garnish: '#6b7d2a' },
  wine: { name: 'Red Wine', note: 'Cypriot Maratheftiko', glass: 'wine', color: '#4e0b18', bottle: 'wine' },
  rose: { name: 'Rosé', note: 'Chilled, from Limassol', glass: 'wine', color: '#f0a49a', bottle: 'rose' },
};

const glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false });
const iceMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, transparent: true, opacity: 0.6 });

/** A glass with a liquid that can be filled 0..1. Origin at the base. */
export function makeGlass(type) {
  const d = DRINKS[type] || DRINKS.whisky;
  const g = new THREE.Group();
  const liquidMat = new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.1, transparent: true, opacity: 0.86, emissive: d.color, emissiveIntensity: 0.12 });
  let bowlH = 0.08, bowlR = 0.035, bowlY = 0, liquidGeo, stem = 0;
  const add = (geo, mat, y = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    g.add(m);
    return m;
  };
  switch (d.glass) {
    case 'tumbler':
      bowlH = 0.075; bowlR = 0.036;
      add(new THREE.CylinderGeometry(bowlR, bowlR * 0.92, bowlH, 16, 1, true), glassMat, bowlH / 2);
      add(new THREE.CylinderGeometry(bowlR * 0.92, bowlR * 0.92, 0.01, 16), glassMat, 0.005);
      liquidGeo = new THREE.CylinderGeometry(bowlR * 0.9, bowlR * 0.88, 1, 16);
      break;
    case 'highball':
      bowlH = 0.13; bowlR = 0.03;
      add(new THREE.CylinderGeometry(bowlR, bowlR, bowlH, 16, 1, true), glassMat, bowlH / 2);
      liquidGeo = new THREE.CylinderGeometry(bowlR * 0.92, bowlR * 0.92, 1, 16);
      break;
    case 'flute':
      stem = 0.09; bowlH = 0.11; bowlR = 0.022;
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 16), glassMat, 0.003);
      add(new THREE.CylinderGeometry(0.004, 0.004, stem, 6), glassMat, stem / 2);
      add(new THREE.CylinderGeometry(bowlR, bowlR * 0.6, bowlH, 16, 1, true), glassMat, stem + bowlH / 2);
      liquidGeo = new THREE.CylinderGeometry(bowlR * 0.9, bowlR * 0.55, 1, 16);
      bowlY = stem;
      break;
    case 'martini':
      stem = 0.09; bowlH = 0.07; bowlR = 0.055;
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.005, 16), glassMat, 0.003);
      add(new THREE.CylinderGeometry(0.004, 0.004, stem, 6), glassMat, stem / 2);
      add(new THREE.ConeGeometry(bowlR, bowlH, 20, 1, true), glassMat, stem + bowlH / 2).rotation.x = Math.PI;
      liquidGeo = new THREE.ConeGeometry(bowlR * 0.9, 1, 20);
      bowlY = stem;
      break;
    case 'wine':
      stem = 0.08; bowlH = 0.1; bowlR = 0.042;
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.005, 16), glassMat, 0.003);
      add(new THREE.CylinderGeometry(0.004, 0.004, stem, 6), glassMat, stem / 2);
      add(new THREE.SphereGeometry(bowlR, 16, 12, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.75), glassMat, stem + bowlR * 0.75);
      liquidGeo = new THREE.CylinderGeometry(bowlR * 0.8, bowlR * 0.45, 1, 16);
      bowlY = stem;
      break;
    case 'snifter':
      stem = 0.03; bowlH = 0.09; bowlR = 0.048;
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.005, 16), glassMat, 0.003);
      add(new THREE.CylinderGeometry(0.005, 0.005, stem, 6), glassMat, stem / 2);
      add(new THREE.SphereGeometry(bowlR, 16, 12, 0, Math.PI * 2, Math.PI * 0.2, Math.PI * 0.8), glassMat, stem + bowlR);
      liquidGeo = new THREE.SphereGeometry(bowlR * 0.88, 16, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
      bowlY = stem;
      break;
  }
  const liquid = new THREE.Mesh(liquidGeo, liquidMat);
  g.add(liquid);
  const extras = [];
  if (d.ice) for (let i = 0; i < 2; i++) {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022), iceMat);
    cube.position.set((i - 0.5) * 0.02, bowlY + bowlH * 0.5, (i % 2) * 0.01);
    cube.rotation.set(0.4 * i, 0.7, 0.2);
    g.add(cube);
    extras.push(cube);
  }
  if (d.garnish) {
    const garnish = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshStandardMaterial({ color: d.garnish, roughness: 0.6 }));
    garnish.position.set(0.01, bowlY + bowlH * 0.55, 0);
    g.add(garnish);
    extras.push(garnish);
  }
  g.userData.type = type;
  g.userData.setFill = (f) => {
    f = Math.max(0, Math.min(1, f));
    liquid.visible = f > 0.01;
    for (const e of extras) e.visible = f > 0.5;
    if (d.glass === 'martini') {
      const h = bowlH * 0.85 * f;
      liquid.scale.set(f, h, f);
      liquid.rotation.x = Math.PI;
      liquid.position.y = bowlY + h / 2;
    } else if (d.glass === 'snifter') {
      liquid.scale.setScalar(0.4 + 0.6 * f);
      liquid.position.y = bowlY + bowlR;
    } else {
      const h = bowlH * 0.7 * f;
      liquid.scale.set(1, Math.max(0.001, h), 1);
      liquid.position.y = bowlY + 0.006 + h / 2;
    }
  };
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
};

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
  g.traverse((o) => o.isMesh && (o.castShadow = false));
  return g;
}

export const BOTTLE_KINDS = Object.keys(BOTTLES);
