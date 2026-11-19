// Shared geometry of the Agentium tower. Everything is in metres.
// Front of the building (open cutaway) faces +z, the big windows face -z.

export const BASE = 1.4; // stone podium the tower stands on
export const H = 4.8; // floor-to-floor height
export const SLAB = 0.32; // slab thickness
export const X0 = -13, X1 = 13; // footprint
export const Z0 = -8, Z1 = 8;
export const LANE_Z = 4.7; // clear walkway along the front of every floor
export const LIFT = { x: 14.75, z: 4.7, doorX: 13, w: 2.6 };

// sunken rooftop pool (outer edge of the coping)
export const POOL_CUT = { x0: -3.3, x1: 3.3, z0: -7.7, z1: 3.6, depth: 1.2 };

export const floorY = (i) => BASE + i * H + SLAB;
export const ceilY = (i) => BASE + (i + 1) * H;

export const FLOORS = [
  { id: 'basement', index: 0, name: 'Basement', rooms: ['lab'] },
  { id: 'work', index: 1, name: 'Work Floor', rooms: ['workshop', 'planning'] },
  { id: 'top', index: 2, name: 'Top Floor', rooms: ['vault', 'penthouse'] },
  { id: 'roof', index: 3, name: 'Rooftop', rooms: ['rooftop'] },
];

// view: camera position and look-at point, relative to the room's floor height.
export const ROOMS = {
  lab: {
    id: 'lab', name: 'Testing Lab', floor: 0, x0: X0, x1: X1,
    view: { pos: [3.5, 2.6, 9.6], look: [1.2, 1.35, -3] },
  },
  workshop: {
    id: 'workshop', name: 'Workshop', floor: 1, x0: X0, x1: 0,
    view: { pos: [-5.2, 2.5, 6.4], look: [-7.2, 1.25, -2.4] },
  },
  planning: {
    id: 'planning', name: 'Planning Room', floor: 1, x0: 0, x1: X1,
    view: { pos: [7.6, 2.55, 6.6], look: [6.4, 1.55, -4] },
  },
  vault: {
    id: 'vault', name: 'The Vault', floor: 2, x0: X0, x1: -3,
    view: { pos: [-8, 2.3, 6.8], look: [-8, 1.8, -5] },
  },
  penthouse: {
    id: 'penthouse', name: 'CEO Penthouse', floor: 2, x0: -3, x1: X1,
    view: { pos: [5.6, 2.45, 6.2], look: [5, 0.95, -3.4] },
  },
  rooftop: {
    id: 'rooftop', name: 'Rooftop Lounge', floor: 3, x0: X0, x1: X1,
    view: { pos: [1.8, 3.2, 10.5], look: [0, 0.6, -6] },
  },
};

export const roomAt = (floorIndex, x) =>
  Object.values(ROOMS).find((r) => r.floor === floorIndex && x >= r.x0 && x <= r.x1);
