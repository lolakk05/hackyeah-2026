/**
 * More low-poly mini-models: several variants for each kind of place the
 * route planner returns (churches, synagogues, museums, palaces, gates,
 * monuments, theatres, the dragon's cave). Same style and scale as
 * builders.ts: each fits on the round island about 2.6 units wide.
 */
import * as THREE from 'three';

// Small local helpers (same conventions as builders.ts: bottom at y)
const mats = new Map<number, THREE.MeshLambertMaterial>();
function mat(color: number) {
  let m = mats.get(color);
  if (!m) mats.set(color, (m = new THREE.MeshLambertMaterial({ color, flatShading: true })));
  return m;
}
function mesh(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  return m;
}
const box = (w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) =>
  mesh(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z);
const cyl = (rt: number, rb: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 12) =>
  mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y + h / 2, z);
function cone(r: number, h: number, c: number, x = 0, y = 0, z = 0, seg = 8) {
  const m = mesh(new THREE.ConeGeometry(r, h, seg), c, x, y + h / 2, z);
  if (seg === 4) m.rotation.y = Math.PI / 4;
  return m;
}
const sphere = (r: number, c: number, x = 0, y = 0, z = 0) => mesh(new THREE.SphereGeometry(r, 10, 8), c, x, y, z);
/** Half sphere (dome) whose base sits at y. */
const dome = (r: number, c: number, x = 0, y = 0, z = 0) =>
  mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), c, x, y, z);
/** Gable/pitched roof: triangle across X, ridge along Z, bottom at y. */
function roof(w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
  return mesh(geo, c, x, y, z);
}
/** Same roof with the ridge along X. */
function roofX(w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) {
  const r = roof(d, h, w, c, x, y, z);
  r.rotation.y = Math.PI / 2;
  return r;
}
/** Row of small windows on a wall facing +Z at depth z. */
function windowRow(g: THREE.Group, n: number, width: number, y: number, z: number, x0 = 0, h = 0.14, color = C.window) {
  for (let i = 0; i < n; i++) g.add(box(0.07, h, 0.02, color, x0 - width / 2 + (width / (n + 1)) * (i + 1), y, z));
}
function crenels(g: THREE.Group, length: number, y: number, z: number, c: number) {
  const n = Math.max(2, Math.round(length / 0.16));
  for (let i = 0; i < n; i++) g.add(box(0.08, 0.09, 0.08, c, -length / 2 + (length / (n - 1)) * i, y, z));
}
function tree(x: number, z: number, s = 1) {
  const g = new THREE.Group();
  g.name = 'decor'; // left out on the city map
  g.add(cyl(0.035 * s, 0.045 * s, 0.14 * s, C.trunk, x, 0, z, 6));
  g.add(mesh(new THREE.IcosahedronGeometry(0.17 * s, 0), C.leaf, x, 0.27 * s, z));
  return g;
}
const cross = (g: THREE.Group, x: number, y: number, z: number, s = 1) => {
  g.add(box(0.025 * s, 0.16 * s, 0.025 * s, C.gold, x, y, z));
  g.add(box(0.1 * s, 0.025 * s, 0.025 * s, C.gold, x, y + 0.09 * s, z));
};

const C = {
  cream: 0xf6e7c8,
  stone: 0xe9dcc0,
  stoneDark: 0xcdbb98,
  white: 0xffffff,
  yellow: 0xf4cf73,
  pink: 0xeab3a8,
  mint: 0xbfe3cf,
  sky: 0xa9cdf0,
  brick: 0xc8583a,
  brickDark: 0x9e4430,
  roofRed: 0xc8432b,
  slate: 0x5a6270,
  copper: 0x3fb39a,
  gold: 0xffc800,
  window: 0x34383f,
  glass: 0x7fc8f8,
  granite: 0x8a8f99,
  graniteDark: 0x6b707a,
  patina: 0x4f8a76,
  rock: 0x9a9a9a,
  rockDark: 0x77787c,
  fire: 0xff9600,
  red: 0xff4b4b,
  blue: 0x3a6fd8,
  trunk: 0x8a5a3c,
  leaf: 0x58a700,
  flowers: 0xff7eb6,
} as const;

// ─── Churches ───────────────────────────────────────────────

/** Gothic parish church: nave, apse and one tall front tower with a spire. */
export function church(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.7, 0.62, 1.25, C.brick, 0, 0, -0.2));
  g.add(roof(0.8, 0.45, 1.25, C.roofRed, 0, 0.62, -0.2));
  g.add(cyl(0.34, 0.34, 0.55, C.brick, 0, 0, -0.85, 10));
  g.add(cone(0.38, 0.35, C.roofRed, 0, 0.55, -0.85, 10));
  g.add(box(0.36, 1.35, 0.36, C.brick, 0, 0, 0.55));
  g.add(box(0.4, 0.06, 0.4, C.stoneDark, 0, 1.35, 0.55));
  g.add(cone(0.24, 0.65, C.copper, 0, 1.41, 0.55, 8));
  cross(g, 0, 2.06, 0.55);
  g.add(box(0.16, 0.28, 0.02, C.window, 0, 0, 0.74));
  windowRow(g, 1, 0.36, 0.95, 0.74, 0, 0.22);
  g.add(tree(-0.85, 0.6));
  g.add(tree(0.8, -0.7, 0.9));
  return g;
}

/** Baroque church with a two-tower facade, pediment, crossing dome and saint statues. */
export function twinTower(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.9, 0.7, 1.15, C.stone, 0, 0, -0.3));
  g.add(roof(1.0, 0.4, 1.15, C.roofRed, 0, 0.7, -0.3));
  g.add(box(1.0, 1.0, 0.14, C.stoneDark, 0, 0, 0.32));
  g.add(roof(1.0, 0.3, 0.14, C.stoneDark, 0, 1.0, 0.32));
  for (const x of [-0.52, 0.52]) {
    g.add(box(0.3, 1.45, 0.3, C.stone, x, 0, 0.32));
    g.add(dome(0.17, C.copper, x, 1.45, 0.32));
    g.add(cone(0.05, 0.22, C.gold, x, 1.6, 0.32, 6));
  }
  g.add(cyl(0.26, 0.26, 0.25, C.stone, 0, 0.7, -0.45, 12));
  g.add(dome(0.28, C.copper, 0, 0.95, -0.45));
  cross(g, 0, 1.22, -0.45);
  g.add(box(0.2, 0.36, 0.02, C.window, 0, 0, 0.4));
  windowRow(g, 2, 0.6, 0.55, 0.4, 0, 0.2);
  // saints on posts in front
  for (let i = 0; i < 4; i++) {
    const x = -0.45 + i * 0.3;
    g.add(box(0.08, 0.16, 0.08, C.white, x, 0, 0.72));
    g.add(cyl(0.035, 0.05, 0.14, C.white, x, 0.16, 0.72, 6));
    g.add(sphere(0.03, C.white, x, 0.33, 0.72));
  }
  return g;
}

/** Domed baroque church: square body, drum, big copper dome and two small towers. */
export function domeChurch(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.0, 0.62, 1.0, C.pink));
  g.add(box(1.06, 0.06, 1.06, C.white, 0, 0.62, 0));
  g.add(cyl(0.38, 0.38, 0.32, C.cream, 0, 0.68, 0, 14));
  windowRow(g, 3, 0.5, 0.78, 0.38, 0, 0.12);
  g.add(dome(0.42, C.copper, 0, 1.0, 0));
  g.add(cyl(0.07, 0.07, 0.18, C.cream, 0, 1.4, 0, 8));
  g.add(cone(0.07, 0.16, C.gold, 0, 1.58, 0, 8));
  for (const x of [-0.42, 0.42]) {
    g.add(box(0.2, 1.0, 0.2, C.pink, x, 0, 0.45));
    g.add(sphere(0.11, C.copper, x, 1.1, 0.45));
    g.add(cone(0.04, 0.18, C.gold, x, 1.18, 0.45, 6));
  }
  for (let i = 0; i < 4; i++) g.add(cyl(0.035, 0.035, 0.5, C.white, -0.21 + i * 0.14, 0, 0.56, 6));
  g.add(roof(0.56, 0.16, 0.12, C.white, 0, 0.5, 0.56));
  g.add(tree(0.85, -0.6));
  return g;
}

/** Small chapel with a bell turret, surrounded by trees. */
export function chapel(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.62, 0.48, 0.85, C.cream));
  g.add(roof(0.72, 0.4, 0.9, C.roofRed, 0, 0.48, 0));
  g.add(box(0.12, 0.2, 0.12, C.cream, 0, 0.72, 0.3));
  g.add(cone(0.1, 0.25, C.copper, 0, 0.92, 0.3, 6));
  cross(g, 0, 1.17, 0.3, 0.7);
  g.add(box(0.16, 0.28, 0.02, C.window, 0, 0, 0.43));
  g.add(sphere(0.05, C.window, 0, 0.36, 0.43));
  g.add(tree(-0.7, 0.4, 1.1));
  g.add(tree(0.7, 0.5));
  g.add(tree(0.6, -0.65, 1.2));
  g.add(tree(-0.65, -0.6, 0.9));
  return g;
}

/** Orthodox church (cerkiew): pale walls and onion domes with crosses. */
export function orthodox(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.75, 0.6, 1.05, C.sky));
  g.add(roof(0.82, 0.25, 1.05, C.slate, 0, 0.6, 0));
  const onion = (x: number, y: number, z: number, s: number, c: number) => {
    g.add(cyl(0.1 * s, 0.1 * s, 0.22 * s, C.sky, x, y, z, 10));
    const bulb = sphere(0.15 * s, c, x, y + 0.36 * s, z);
    bulb.scale.set(1, 1.25, 1);
    g.add(bulb);
    g.add(cone(0.07 * s, 0.16 * s, c, x, y + 0.5 * s, z, 8));
    cross(g, x, y + 0.66 * s, z, 0.8 * s);
  };
  onion(0, 0.75, 0, 1.4, C.gold);
  onion(0, 0.62, 0.42, 1, C.blue);
  onion(0, 0.62, -0.42, 1, C.blue);
  g.add(box(0.18, 0.3, 0.02, C.window, 0, 0, 0.53));
  windowRow(g, 2, 0.6, 0.32, 0.53, 0, 0.14);
  g.add(tree(-0.8, 0.5));
  g.add(tree(0.8, -0.55));
  return g;
}

// ─── Synagogues ─────────────────────────────────────────────

/** Neo-Moorish synagogue: two slim towers with domes and a round window. */
export function synagogueMoorish(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.0, 0.75, 0.85, C.yellow));
  g.add(box(1.04, 0.06, 0.89, C.brick, 0, 0.75, 0));
  g.add(roof(0.9, 0.22, 0.85, C.slate, 0, 0.81, 0));
  for (const x of [-0.45, 0.45]) {
    g.add(box(0.18, 1.05, 0.18, C.yellow, x, 0, 0.36));
    g.add(dome(0.11, C.copper, x, 1.05, 0.36));
    g.add(sphere(0.035, C.gold, x, 1.2, 0.36));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.03, 16).rotateX(Math.PI / 2), C.white, 0, 0.55, 0.43));
  g.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 6).rotateX(Math.PI / 2), C.blue, 0, 0.55, 0.44));
  for (const x of [-0.22, 0, 0.22]) {
    g.add(box(0.12, 0.26, 0.02, C.window, x, 0, 0.43));
    g.add(sphere(0.06, C.window, x, 0.26, 0.43));
  }
  g.add(tree(0.85, -0.55));
  return g;
}

/** Small old synagogue with a high roof, a walled yard and old tombstones. */
export function synagogueSmall(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.7, 0.5, 0.6, C.stone, 0, 0, -0.3));
  const hip = cone(0.55, 0.45, C.brickDark, 0, 0.5, -0.3, 4);
  hip.scale.set(1.05, 1, 0.9);
  g.add(hip);
  windowRow(g, 2, 0.6, 0.2, 0.01, 0, 0.2);
  // yard wall
  g.add(box(1.5, 0.18, 0.06, C.stoneDark, 0, 0, 0.75));
  g.add(box(0.06, 0.18, 0.9, C.stoneDark, -0.75, 0, 0.3));
  g.add(box(0.06, 0.18, 0.9, C.stoneDark, 0.75, 0, 0.3));
  // tombstones
  for (let i = 0; i < 6; i++) {
    const x = -0.5 + (i % 3) * 0.25 + (i > 2 ? 0.12 : 0);
    const z = 0.25 + (i > 2 ? 0.25 : 0);
    const t = box(0.12, 0.18 + (i % 2) * 0.05, 0.03, C.granite, x, 0, z);
    t.rotation.z = (i % 3 - 1) * 0.12;
    g.add(t);
  }
  g.add(tree(0.55, 0.35, 0.9));
  return g;
}

// ─── Museums ────────────────────────────────────────────────

/** Classical museum: columned portico, pediment and wide steps. */
export function museum(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.6, 0.68, 0.85, C.cream, 0, 0, -0.15));
  g.add(box(1.66, 0.08, 0.9, C.white, 0, 0.68, -0.15));
  windowRow(g, 6, 1.5, 0.3, 0.28, 0, 0.18);
  g.add(box(0.9, 0.06, 0.45, C.white, 0, 0, 0.45));
  g.add(box(0.8, 0.06, 0.4, C.white, 0, 0.06, 0.42));
  for (let i = 0; i < 6; i++) g.add(cyl(0.04, 0.045, 0.6, C.white, -0.35 + i * 0.14, 0.12, 0.52, 8));
  g.add(box(0.86, 0.07, 0.24, C.white, 0, 0.72, 0.45));
  g.add(roof(0.86, 0.22, 0.24, C.white, 0, 0.79, 0.45));
  g.add(box(0.03, 0.45, 0.03, C.window, -0.78, 0, 0.55));
  g.add(box(0.03, 0.45, 0.03, C.window, 0.78, 0, 0.55));
  g.add(box(0.1, 0.22, 0.01, C.red, -0.73, 0.2, 0.55));
  g.add(box(0.1, 0.22, 0.01, C.blue, 0.83, 0.2, 0.55));
  return g;
}

/** Modern gallery: offset cubes, glass walls and a sculpture in front. */
export function gallery(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.3, 0.48, 0.9, 0xdfe5ec, 0, 0, -0.1));
  g.add(box(0.9, 0.42, 0.95, C.glass, 0.18, 0.48, -0.18));
  g.add(box(0.55, 0.3, 0.6, 0x3c4452, -0.25, 0.9, -0.2));
  g.add(box(1.0, 0.3, 0.02, C.glass, 0.1, 0.06, 0.36));
  for (let i = 0; i < 5; i++) g.add(box(0.02, 0.42, 0.97, 0xffffff, -0.22 + i * 0.2, 0.48, -0.18));
  // sculpture
  const ring = mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 18), C.red, -0.55, 0.35, 0.6);
  ring.rotation.y = 0.6;
  g.add(ring);
  g.add(box(0.2, 0.12, 0.2, C.granite, -0.55, 0, 0.6));
  return g;
}

/** A row of colourful tenement houses (kamienice), one of them a museum. */
export function townhouse(): THREE.Group {
  const g = new THREE.Group();
  const houses: [number, number, number][] = [
    [-0.5, 0.95, C.yellow],
    [0, 1.15, C.pink],
    [0.5, 0.85, C.mint],
  ];
  for (const [x, h, c] of houses) {
    g.add(box(0.48, h, 0.7, c, x, 0, 0));
    g.add(roof(0.5, 0.3, 0.72, C.roofRed, x, h, 0));
    for (let row = 0; row < 3; row++) windowRow(g, 2, 0.4, 0.22 + row * 0.26, 0.36, x, 0.13);
  }
  g.add(box(0.16, 0.24, 0.02, C.window, 0, 0, 0.36));
  g.add(box(0.08, 0.45, 0.02, C.red, 0.12, 0.55, 0.37));
  return g;
}

// ─── Palaces ────────────────────────────────────────────────

/** Palace with a central block, two wings, a columned front and slate roofs. */
export function palace(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.8, 0.82, 0.75, C.cream));
  g.add(roofX(0.84, 0.32, 0.8, C.slate, 0, 0.82, 0));
  for (const x of [-0.68, 0.68]) {
    g.add(box(0.56, 0.62, 0.65, C.cream, x, 0, 0.02));
    g.add(roofX(0.6, 0.26, 0.7, C.slate, x, 0.62, 0.02));
    windowRow(g, 2, 0.5, 0.18, 0.35, x, 0.16);
    windowRow(g, 2, 0.5, 0.42, 0.35, x, 0.14);
  }
  g.add(box(0.42, 0.9, 0.08, C.white, 0, 0, 0.4));
  g.add(roof(0.46, 0.2, 0.08, C.white, 0, 0.9, 0.4));
  for (const x of [-0.15, -0.05, 0.05, 0.15]) g.add(cyl(0.025, 0.025, 0.4, C.stoneDark, x, 0.42, 0.45, 6));
  g.add(box(0.36, 0.04, 0.12, C.stoneDark, 0, 0.42, 0.46));
  g.add(box(0.14, 0.3, 0.02, C.window, 0, 0, 0.45));
  return g;
}

/** Gothic brick college around a courtyard with an arcade and a small tower. */
export function college(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.4, 0.7, 0.32, C.brick, 0, 0, -0.5));
  g.add(roofX(1.44, 0.45, 0.36, C.roofRed, 0, 0.7, -0.5));
  for (const x of [-0.56, 0.56]) {
    g.add(box(0.28, 0.7, 0.8, C.brick, x, 0, 0.05));
    g.add(roof(0.32, 0.4, 0.8, C.roofRed, x, 0.7, 0.05));
  }
  // courtyard arcade
  for (let i = 0; i < 5; i++) g.add(cyl(0.03, 0.03, 0.3, C.stone, -0.32 + i * 0.16, 0, -0.28, 6));
  g.add(box(0.8, 0.06, 0.06, C.stone, 0, 0.3, -0.28));
  g.add(cyl(0.08, 0.1, 0.12, C.stoneDark, 0, 0, 0.1, 10));
  // tower with clock
  g.add(box(0.22, 1.2, 0.22, C.brickDark, 0.56, 0, -0.5));
  g.add(cone(0.18, 0.4, C.roofRed, 0.56, 1.2, -0.5, 4));
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12).rotateX(Math.PI / 2), C.gold, 0.56, 1.0, -0.38));
  windowRow(g, 4, 1.2, 0.35, -0.33, 0, 0.18);
  return g;
}

// ─── City gates and walls ───────────────────────────────────

/** Gothic gate tower with an archway, a copper helmet and bits of the city wall. */
export function gate(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.55, 1.4, 0.55, C.brick));
  g.add(box(0.6, 0.08, 0.6, C.stone, 0, 1.0, 0));
  g.add(box(0.26, 0.42, 0.57, C.window));
  g.add(dome(0.27, C.copper, 0, 1.4, 0));
  g.add(cyl(0.06, 0.1, 0.22, C.copper, 0, 1.62, 0, 8));
  g.add(sphere(0.08, C.copper, 0, 1.9, 0));
  g.add(cone(0.04, 0.2, C.gold, 0, 1.95, 0, 6));
  windowRow(g, 1, 0.3, 0.7, 0.28, 0, 0.18);
  for (const x of [-0.7, 0.7]) {
    g.add(box(0.85, 0.55, 0.2, C.brickDark, x, 0, 0));
    crenels(g, 0.8, 0.55, 0, C.brickDark);
  }
  return g;
}

/** Defensive wall with a gate between two square towers. */
export function wallGate(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.0, 0.55, 0.24, C.brick));
  crenels(g, 1.95, 0.55, 0.06, C.brick);
  for (const x of [-0.38, 0.38]) {
    g.add(box(0.36, 0.95, 0.36, C.brick, x, 0, 0.02));
    g.add(cone(0.3, 0.4, C.roofRed, x, 0.95, 0.02, 4));
    windowRow(g, 1, 0.3, 0.55, 0.21, x, 0.14);
  }
  g.add(box(0.3, 0.38, 0.26, C.window));
  g.add(cyl(0.15, 0.15, 0.26, C.window, 0, 0.38, 0, 12).rotateX(Math.PI / 2));
  return g;
}

// ─── Monuments ──────────────────────────────────────────────

/** Granite pedestal; returns its height. */
function pedestal(g: THREE.Group, w = 0.5, h = 0.75): number {
  g.add(box(w + 0.3, 0.12, w + 0.3, C.graniteDark));
  g.add(box(w, h, w, C.granite, 0, 0.12));
  g.add(box(w + 0.1, 0.08, w + 0.1, C.graniteDark, 0, 0.12 + h));
  return 0.2 + h;
}
const flowers = (g: THREE.Group, r = 0.55) => {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(sphere(0.06, i % 2 ? C.flowers : C.gold, Math.cos(a) * r, 0.06, Math.sin(a) * r));
  }
};

/** Bronze figure in a long coat, one hand forward, on a granite pedestal. */
export function statue(): THREE.Group {
  const g = new THREE.Group();
  const y = pedestal(g);
  g.add(box(0.1, 0.32, 0.12, C.patina, -0.07, y, 0));
  g.add(box(0.1, 0.32, 0.12, C.patina, 0.07, y, 0));
  g.add(cyl(0.15, 0.24, 0.45, C.patina, 0, y + 0.22, 0, 10));
  g.add(cyl(0.17, 0.15, 0.22, C.patina, 0, y + 0.66, 0, 10));
  g.add(sphere(0.1, C.patina, 0, y + 0.98, 0));
  const arm = box(0.07, 0.36, 0.07, C.patina, 0.18, y + 0.62, 0.12);
  arm.rotation.x = 1.1;
  g.add(arm);
  g.add(box(0.07, 0.36, 0.07, C.patina, -0.2, y + 0.52, 0));
  flowers(g);
  return g;
}

/** Rider on a horse raising a sword, on a long pedestal. */
export function rider(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.3, 0.12, 0.7, C.graniteDark));
  g.add(box(1.1, 0.55, 0.5, C.granite, 0, 0.12));
  const y = 0.67;
  const horse = new THREE.Group();
  const body = sphere(0.24, C.patina, 0, y + 0.42, 0);
  body.scale.set(1.7, 0.8, 0.75);
  horse.add(body);
  for (const [x, z] of [
    [0.25, 0.1],
    [0.25, -0.1],
    [-0.25, 0.1],
    [-0.25, -0.1],
  ])
    horse.add(cyl(0.035, 0.04, 0.32, C.patina, x, y, z, 6));
  const neck = box(0.12, 0.35, 0.12, C.patina, 0.42, y + 0.45, 0);
  neck.rotation.z = -0.6;
  horse.add(neck);
  const head = box(0.22, 0.1, 0.1, C.patina, 0.6, y + 0.68, 0);
  head.rotation.z = -0.3;
  horse.add(head);
  const tail = cone(0.05, 0.3, C.patina, -0.45, y + 0.2, 0, 6);
  tail.rotation.z = -0.5;
  horse.add(tail);
  // rider
  horse.add(cyl(0.09, 0.12, 0.32, C.patina, 0, y + 0.58, 0, 8));
  horse.add(sphere(0.08, C.patina, 0, y + 0.98, 0));
  const arm = box(0.05, 0.3, 0.05, C.patina, 0.08, y + 1.0, 0.1);
  arm.rotation.z = -0.4;
  horse.add(arm);
  horse.add(box(0.025, 0.4, 0.025, C.patina, 0.17, y + 1.12, 0.1));
  g.add(horse);
  return g;
}

/** Bust on a tall column, with a bench and flowers. */
export function bust(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.5, 0.1, 0.5, C.graniteDark));
  g.add(cyl(0.16, 0.18, 0.95, C.granite, 0, 0.1, 0, 10));
  g.add(box(0.36, 0.08, 0.36, C.graniteDark, 0, 1.05, 0));
  g.add(box(0.36, 0.16, 0.2, C.patina, 0, 1.13, 0));
  g.add(cyl(0.06, 0.07, 0.1, C.patina, 0, 1.29, 0, 8));
  g.add(sphere(0.14, C.patina, 0, 1.48, 0));
  g.add(box(0.6, 0.06, 0.2, C.trunk, 0, 0.18, 0.7));
  g.add(box(0.05, 0.18, 0.15, C.window, -0.25, 0, 0.7));
  g.add(box(0.05, 0.18, 0.15, C.window, 0.25, 0, 0.7));
  flowers(g, 0.42);
  g.add(tree(-0.8, -0.4));
  return g;
}

// ─── Theatres ───────────────────────────────────────────────

/** Eclectic theatre: loggia with columns, statues on the roof and a copper dome. */
export function theatre(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.4, 0.72, 1.0, C.cream));
  g.add(box(1.44, 0.07, 1.04, C.white, 0, 0.72, 0));
  g.add(cyl(0.34, 0.38, 0.25, C.cream, 0, 0.79, -0.15, 14));
  g.add(dome(0.36, C.copper, 0, 1.04, -0.15));
  g.add(sphere(0.06, C.gold, 0, 1.42, -0.15));
  for (let i = 0; i < 6; i++) g.add(cyl(0.035, 0.035, 0.32, C.white, -0.4 + i * 0.16, 0.36, 0.52, 6));
  g.add(box(0.95, 0.04, 0.1, C.white, 0, 0.36, 0.52));
  for (let i = 0; i < 3; i++) g.add(box(0.14, 0.26, 0.02, C.window, -0.3 + i * 0.3, 0, 0.51));
  // statues on the attic
  for (const x of [-0.55, 0, 0.55]) {
    g.add(cyl(0.04, 0.05, 0.16, C.gold, x, 0.79, 0.45, 6));
    g.add(sphere(0.04, C.gold, x, 1.0, 0.45));
  }
  for (const x of [-0.6, 0.6]) g.add(dome(0.14, C.copper, x, 0.79, -0.35));
  return g;
}

/** Art-nouveau theatre: tall facade with a big arch, green ornament and masks. */
export function theatreNouveau(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.2, 0.85, 0.8, 0xd7c4a3));
  g.add(roofX(1.24, 0.3, 0.84, C.slate, 0, 0.85, 0));
  const arch = mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 16, Math.PI), C.white, 0, 0.35, 0.41);
  g.add(arch);
  g.add(box(0.5, 0.35, 0.02, C.glass, 0, 0, 0.41));
  g.add(box(1.22, 0.05, 0.02, C.copper, 0, 0.72, 0.41));
  g.add(box(1.22, 0.05, 0.02, C.copper, 0, 0.1, 0.41));
  for (const x of [-0.45, 0.45]) {
    g.add(sphere(0.07, C.gold, x, 0.55, 0.42));
    windowRow(g, 1, 0.2, 0.2, 0.41, x, 0.22);
  }
  g.add(tree(0.8, 0.55, 0.9));
  return g;
}

// ─── Cave ───────────────────────────────────────────────────

/** Rocky hill with a dark cave opening and the glow of dragon fire inside. */
export function cave(): THREE.Group {
  const g = new THREE.Group();
  const big = mesh(new THREE.DodecahedronGeometry(0.75, 0), C.rock, 0, 0.35, -0.2);
  big.scale.set(1.3, 0.85, 1);
  g.add(big);
  g.add(mesh(new THREE.DodecahedronGeometry(0.4, 0), C.rockDark, 0.7, 0.2, 0.15));
  g.add(mesh(new THREE.DodecahedronGeometry(0.32, 0), C.rockDark, -0.75, 0.15, 0.2));
  g.add(box(0.5, 0.3, 0.12, 0x111317, 0, 0, 0.42));
  const arch = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 12, 1, false, -Math.PI / 2, Math.PI), 0x111317, 0, 0.3, 0.42);
  arch.rotation.x = Math.PI / 2;
  g.add(arch);
  g.add(cone(0.08, 0.22, C.fire, 0, 0, 0.36, 6));
  g.add(cone(0.05, 0.14, C.gold, 0, 0, 0.38, 6));
  // lantern
  g.add(cyl(0.02, 0.02, 0.5, C.window, 0.45, 0, 0.7, 6));
  g.add(box(0.08, 0.1, 0.08, C.gold, 0.45, 0.5, 0.7));
  // stepping stones
  for (let i = 0; i < 3; i++) g.add(cyl(0.08, 0.08, 0.03, C.granite, -0.1 + i * 0.1, 0, 0.62 + i * 0.18, 8));
  g.add(tree(-0.85, 0.65));
  return g;
}
