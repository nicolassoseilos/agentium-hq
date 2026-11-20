// Reaching: find shoulder and elbow angles that put a hand at a point in the
// world (a glass on the table, the ashtray, the mouth). Works for any arm rig
// that is driven by three numbers (shoulder pitch, shoulder roll, elbow bend),
// so the cartoon agents and the realistic guests share it.
import * as THREE from 'three';

const tmp = new THREE.Vector3();

/**
 * @param set    (a, b, c) => void   applies the three angles to the joints
 * @param hand   (out) => Vector3    the hand's world position (after `set`)
 * @param update () => void          refreshes the arm's world matrices
 * @param target Vector3             where the hand should be
 * @param start  [a, b, c]           where to start (the current angles)
 * @param limits [[min,max] ×3]
 * @returns [a, b, c]
 */
export function solveReach(set, hand, update, target, start, limits) {
  const clamp = (k, v) => Math.min(limits[k][1], Math.max(limits[k][0], v));
  const cost = (x) => {
    set(x[0], x[1], x[2]);
    update();
    return hand(tmp).distanceToSquared(target);
  };
  const descend = (seed) => {
    const x = seed.map((v, k) => clamp(k, v));
    let best = cost(x);
    let step = 0.6;
    for (let it = 0; it < 14 && best > 4e-6; it++) {
      let improved = false;
      for (let k = 0; k < 3; k++) {
        for (const dir of [1, -1]) {
          const keep = x[k];
          x[k] = clamp(k, keep + dir * step);
          const c = cost(x);
          if (c < best) { best = c; improved = true; } else x[k] = keep;
        }
      }
      if (!improved) step *= 0.5;
    }
    return { x, best };
  };
  // from where the arm is now, and from a couple of typical reaching poses
  let win = descend(start);
  if (win.best > 0.0004) {
    for (const seed of [[-1.9, 0.35, -1.6], [-1.2, 0.0, -0.4], [-2.4, 0.5, -2.0]]) {
      const r = descend(seed);
      if (r.best < win.best - 1e-5) win = r;
      if (win.best < 0.0004) break;
    }
  }
  // still poor (an unusual rig): a coarse sweep of arm poses, then refine the best
  if (win.best > 0.0016) {
    let seed = null, sb = Infinity;
    const span = (k, n) => Array.from({ length: n }, (_, i) => limits[k][0] + ((limits[k][1] - limits[k][0]) * i) / (n - 1));
    for (const a of span(0, 9)) for (const b of span(1, 6)) for (const c of span(2, 6)) {
      const v = cost([a, b, c]);
      if (v < sb) { sb = v; seed = [a, b, c]; }
    }
    const r = descend(seed);
    if (r.best < win.best) win = r;
  }
  return win.x;
}
