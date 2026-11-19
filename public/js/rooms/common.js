// Helpers shared by every room: lighting that follows the room's status,
// and the brand plaque.
import * as THREE from 'three';
import { M } from '../core/materials.js';
import { box, plane } from '../core/build.js';
import * as T from '../core/textures.js';

/**
 * Warm room lighting. level 0 = empty (dimmed), 1 = someone working.
 * Interior lights read stronger at night, softer during the day.
 */
export function roomLights(parent, points, { color = '#ffd2a0', power = 22, distance = 16, fixtures = [] } = {}) {
  const lights = points.map(([x, y, z, p = 1]) => {
    const l = new THREE.PointLight(color, 0, distance, 1.7);
    l.position.set(x, y, z);
    l.userData.p = p;
    parent.add(l);
    return l;
  });
  let level = 0;
  return {
    lights,
    set(target, daylight, dt) {
      level += (target - level) * Math.min(1, dt * 2.5);
      const base = 0.22 + level * 0.78; // never fully dark
      const nightBoost = 0.7 + (1 - daylight) * 0.6;
      for (const l of lights) l.intensity = power * 3.2 * l.userData.p * base * nightBoost;
      for (const f of fixtures) f.emissiveIntensity = (f.userData.max ?? 2) * (0.25 + level * 0.75);
      return level;
    },
    get level() {
      return level;
    },
  };
}

/** Cloned emissive material so one room can dim its fixtures independently. */
export function fixtureMat(base = M.warmLight, max = 2.2) {
  const m = base.clone();
  m.userData.max = max;
  return m;
}

/** Small brass-framed name plaque with the Agentium mark. */
export function plaque(parent, text, x, y, z, rotY = 0, { w = 1.3, h = 0.36, sub = 'AGENTIUM' } = {}) {
  const tex = T.textTexture(
    [
      { text: sub, font: '600 40px Manrope, sans-serif' },
      { text, font: '500 84px "Cormorant Garamond", serif' },
    ],
    { w: 1024, h: 288, bg: '#15110d', color: '#d8b77d', spacing: 0.22 },
  );
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  box(w + 0.06, h + 0.06, 0.03, M.brass, 0, -(h + 0.06) / 2, -0.016, g, { cast: false });
  const p = plane(w, h, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 }), 0, 0, 0.001, g);
  p.receiveShadow = false;
  parent.add(g);
  return g;
}

/** Track spotlights on a rail (workshop / gallery feel). */
export function trackLights(parent, x0, x1, y, z, n, mat) {
  box(x1 - x0, 0.05, 0.06, M.blackMetal, (x0 + x1) / 2, y - 0.05, z, parent, { cast: false });
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) / n) * (x1 - x0);
    const head = new THREE.Group();
    head.position.set(x, y - 0.12, z);
    head.rotation.x = 0.5;
    box(0.09, 0.2, 0.09, M.blackMetal, 0, -0.1, 0, head, { cast: false });
    box(0.07, 0.01, 0.07, mat, 0, -0.105, 0, head, { cast: false });
    parent.add(head);
  }
}

// ---------------------------------------------------------------- canvas UI
export const UI = {
  bg: '#0b0f14',
  panel: '#121821',
  line: '#223042',
  text: '#e8edf3',
  dim: '#7f8ea3',
  green: '#3ddc97',
  red: '#ff4d4f',
  amber: '#ffb547',
  gold: '#d8b77d',
  cyan: '#38e1ff',
};

export function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function brandHeader(g, w, title, sub, { color = UI.gold, size = 1 } = {}) {
  g.fillStyle = color;
  g.font = `600 ${18 * size}px Manrope, sans-serif`;
  if ('letterSpacing' in g) g.letterSpacing = '0.3em';
  g.fillText('AGENTIUM', 40 * size, 46 * size);
  if ('letterSpacing' in g) g.letterSpacing = '0em';
  g.fillStyle = UI.text;
  g.font = `500 ${40 * size}px "Cormorant Garamond", serif`;
  g.fillText(title, 40 * size, 92 * size);
  if (sub) {
    g.fillStyle = UI.dim;
    g.font = `500 ${18 * size}px Manrope, sans-serif`;
    g.textAlign = 'right';
    g.fillText(sub, w - 40 * size, 46 * size);
    g.textAlign = 'left';
  }
}

export function wrapText(g, text, x, y, maxW, lineH, maxLines = 3) {
  const words = String(text).split(' ');
  let line = '';
  let n = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y + n * lineH);
      n++;
      line = w;
      if (n >= maxLines) return n;
    } else line = test;
  }
  if (line) g.fillText(line, x, y + n * lineH), n++;
  return n;
}
