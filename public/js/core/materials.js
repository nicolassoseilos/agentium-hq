// Shared, physically based materials for the whole tower.
import * as THREE from 'three';
import * as T from './textures.js';

const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

export const M = {};

/** Emissive materials whose glow follows day/night are registered here. */
export const nightGlow = [];

export function initMaterials() {
  // woods
  M.walnut = std({ map: T.wood({ base: '#4a2c1a', seed: 3 }), roughness: 0.42, metalness: 0 });
  M.walnutPanel = std({ map: T.slats({ base: '#4d301d', count: 16 }), roughness: 0.5 });
  M.ebony = std({ map: T.wood({ base: '#2a1a12', seed: 31, rings: 110 }), roughness: 0.28 });
  M.oak = std({ map: T.wood({ base: '#b78b5b', seed: 4 }), roughness: 0.55 });
  M.oakFloor = std({ map: T.planks({ base: '#7a6a5a', rows: 6, repeat: [2, 2], vary: 0.12 }), roughness: 0.55 });
  M.lightFloor = std({ map: T.planks({ base: '#c9b49a', rows: 6, repeat: [3, 3], vary: 0.1 }), roughness: 0.36 });
  M.darkFloor = std({ map: T.planks({ base: '#4a3222', rows: 8, repeat: [3, 3] }), roughness: 0.32 });
  M.deck = std({ map: T.planks({ base: '#6d5440', rows: 10, repeat: [4, 4], gap: '#1a120c' }), roughness: 0.6 });

  // stone
  M.marble = std({ map: T.marble({ repeat: [3, 3] }), roughness: 0.12, metalness: 0 });
  M.marbleDark = std({ map: T.marble({ base: '#2b2a2c', vein: '#8d8278', seed: 9, repeat: [2, 2] }), roughness: 0.15 });
  M.concrete = std({ map: T.concrete({ repeat: [3, 2] }), roughness: 0.9 });
  M.stone = std({ map: T.concrete({ base: '#bdb7ad', seed: 19, repeat: [6, 6] }), roughness: 0.75 });
  M.terrace = std({ map: T.concrete({ base: '#9c968c', seed: 23, repeat: [8, 8] }), roughness: 0.65 });
  M.granite = std({ map: T.marble({ base: '#c9c6c0', vein: '#5c5a57', seed: 13 }), roughness: 0.3 });

  // soft goods
  M.rugGrey = std({ map: T.mottledRug(), roughness: 1 });
  M.rugPersian = std({ map: T.persianRug(), roughness: 1 });
  M.leatherBlack = std({ map: T.tufted({ base: '#24262b' }), roughness: 0.42 });
  M.leatherCognac = std({ color: '#5a2c16', roughness: 0.35 });
  M.leatherDark = std({ color: '#1b1c20', roughness: 0.4 });
  M.leatherWhite = std({ color: '#d9d6d0', roughness: 0.45 });
  M.quiltWall = std({ map: T.quilted({ base: '#1d1d20', line: '#0b0b0c', repeat: [5, 3] }), color: '#4a4a4e', roughness: 0.62 });
  M.fabricBeige = std({ map: T.fabric({ base: '#d8cdbb' }), roughness: 0.95 });
  M.fabricCream = std({ map: T.fabric({ base: '#ece4d6', seed: 2 }), roughness: 0.95 });
  M.fabricNavy = std({ map: T.fabric({ base: '#1f2a44', seed: 5 }), roughness: 0.95 });
  M.towel = std({ map: T.fabric({ base: '#c7b08a', seed: 8 }), roughness: 1 });
  M.curtain = std({ color: '#141821', roughness: 0.9, side: THREE.DoubleSide });

  // metals
  M.brass = std({ color: '#c9a15e', metalness: 1, roughness: 0.28 });
  M.brushedBrass = std({ color: '#b18a4f', metalness: 1, roughness: 0.45 });
  M.chrome = std({ color: '#e8e8ea', metalness: 1, roughness: 0.12 });
  M.steel = std({ color: '#8b9097', metalness: 0.9, roughness: 0.35 });
  M.blackMetal = std({ color: '#141518', metalness: 0.6, roughness: 0.4 });
  M.navySteel = std({ color: '#1d2b45', metalness: 0.5, roughness: 0.45 });

  // paints & plastics
  M.white = std({ color: '#ecebe8', roughness: 0.6 });
  M.offWhite = std({ color: '#d9d4cb', roughness: 0.8 });
  M.charcoal = std({ color: '#25262a', roughness: 0.55 });
  M.black = std({ color: '#0d0e10', roughness: 0.35 });
  M.glossBlack = std({ color: '#0b0c0e', roughness: 0.08, metalness: 0.2 });
  M.labFloor = std({ color: '#161e27', roughness: 0.62, metalness: 0.05 });
  M.labWall = std({ color: '#1e252d', roughness: 0.4, metalness: 0.3 });
  M.labCabinet = std({ color: '#1b1e23', roughness: 0.3, metalness: 0.5 });
  M.robotWhite = std({ color: '#f1f2f4', roughness: 0.25, metalness: 0.1 });
  M.paper = std({ color: '#f3f1ea', roughness: 0.9 });
  M.ceilingDark = std({ color: '#141416', roughness: 0.9 });
  M.ceilingWhite = std({ color: '#efede8', roughness: 0.95 });

  // glass
  M.glass = phys({ color: '#cfe3ee', metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.5, side: THREE.DoubleSide });
  M.glassTint = phys({ color: '#8fb3c9', metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  M.glassFacade = phys({ color: '#6f95b3', metalness: 0.4, roughness: 0.06, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  M.glassDark = phys({ color: '#0e1116', metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.85 });
  M.decanterGlass = phys({ color: '#ffffff', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.28, depthWrite: false });
  M.cognac = std({ color: '#8a3e0d', roughness: 0.1, transparent: true, opacity: 0.9, emissive: '#3a1404', emissiveIntensity: 0.4 });
  M.whisky = std({ color: '#b56d16', roughness: 0.1, transparent: true, opacity: 0.88, emissive: '#4a2504', emissiveIntensity: 0.4 });

  // plants
  M.leaf = std({ color: '#3f6b35', roughness: 0.7, side: THREE.DoubleSide });
  M.leafDark = std({ color: '#2c4f2a', roughness: 0.7, side: THREE.DoubleSide });
  M.trunk = std({ color: '#6b5440', roughness: 0.9 });
  M.soil = std({ color: '#2a1f17', roughness: 1 });

  // emissives (glow scaled at night)
  M.warmLight = std({ color: '#fff3df', emissive: '#ffd9a0', emissiveIntensity: 2.2 });
  M.coolLight = std({ color: '#ffffff', emissive: '#f4f8ff', emissiveIntensity: 2.4 });
  M.neonCyan = std({ color: '#5ff', emissive: '#18e0ff', emissiveIntensity: 3 });
  M.neonAmber = std({ color: '#fc6', emissive: '#ffae3d', emissiveIntensity: 2.5 });
  M.ledWarm = std({ color: '#ffd59a', emissive: '#ffb45c', emissiveIntensity: 1.6 });
  M.bottleGlow = std({ color: '#ffcf8a', emissive: '#ffb052', emissiveIntensity: 1.2 });
  M.goldText = std({ color: '#c9a15e', metalness: 1, roughness: 0.3, emissive: '#c9a15e', emissiveIntensity: 0.15 });

  for (const k of ['warmLight', 'ledWarm', 'bottleGlow', 'neonAmber']) nightGlow.push({ mat: M[k], day: M[k].emissiveIntensity * 0.45, night: M[k].emissiveIntensity * 1.15 });
  return M;
}

export function setNight(daylight) {
  for (const g of nightGlow) g.mat.emissiveIntensity = g.night + (g.day - g.night) * daylight;
}
