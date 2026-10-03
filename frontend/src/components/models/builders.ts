/**
 * Procedural low-poly "mini diorama" models of Kraków landmarks.
 *
 * Every model is built from simple three.js shapes, so no 3D model files are
 * needed. Each one sits on a round grass island about 2.6 units wide.
 *
 * To use real .glb models later, load them with GLTFLoader in
 * landmark-model.tsx and skip `buildLandmarkModel`.
 */
import * as THREE from 'three';

import type { ModelKind } from '@/api/types';

import * as extra from './builders-extra';

const C = {
  grass: 0x7ed957,
  grassSide: 0x58a700,
  dirt: 0xa0663c,
  brick: 0xd1603d,
  brickDark: 0xa84a2e,
  stone: 0xf3e3c3,
  stoneDark: 0xd9c49d,
  copper: 0x3fb39a,
  roofRed: 0xc8432b,
  gold: 0xffc800,
  white: 0xffffff,
  window: 0x3c3c3c,
  water: 0x1cb0f6,
  steel: 0xdde8f0,
  dragon: 0x3caa3c,
  rock: 0x9a9a9a,
  fire: 0xff9600,
  red: 0xff4b4b,
  purple: 0xce82ff,
} as const;

/** Children with this name are scenery (trees, water) and are left out on the city map. */
const DECOR = 'decor';

const mats = new Map<number, THREE.MeshLambertMaterial>();
function mat(color: number): THREE.MeshLambertMaterial {
  let m = mats.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    mats.set(color, m);
  }
  return m;
}

function mesh(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  return m;
}

/** Box whose bottom sits at y. */
function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  return mesh(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z);
}

/** Cylinder whose bottom sits at y. */
function cyl(rTop: number, rBottom: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 12) {
  return mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, x, y + h / 2, z);
}

/** Cone / pyramid whose bottom sits at y. */
function cone(r: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 8) {
  const m = mesh(new THREE.ConeGeometry(r, h, seg), color, x, y + h / 2, z);
  if (seg === 4) m.rotation.y = Math.PI / 4;
  return m;
}

/** Pitched roof (triangular prism) running along Z, bottom at y. */
function roof(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return mesh(geo, color, x, y, z);
}

/** Row of crenellations along X (or Z). */
function battlements(group: THREE.Group, length: number, y: number, z: number, color: number, alongZ = false) {
  const n = Math.max(2, Math.round(length / 0.18));
  for (let i = 0; i < n; i++) {
    const t = -length / 2 + (length / (n - 1)) * i;
    const b = box(0.09, 0.1, 0.09, color, alongZ ? z : t, y, alongZ ? t : z);
    group.add(b);
  }
}

/** Small dark windows on the +Z face of a wall. */
function windows(group: THREE.Group, count: number, width: number, y: number, z: number, x0 = 0, h = 0.16) {
  for (let i = 0; i < count; i++) {
    const x = x0 - width / 2 + (width / (count + 1)) * (i + 1);
    group.add(box(0.08, h, 0.02, C.window, x, y, z));
  }
}

function island(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(1.3, 1.3, 0.12, C.grass, 0, -0.12, 0, 16));
  g.add(cyl(1.3, 1.18, 0.14, C.grassSide, 0, -0.26, 0, 16));
  g.add(cyl(1.18, 0.7, 0.35, C.dirt, 0, -0.61, 0, 16));
  return g;
}

function tree(x: number, z: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.name = DECOR;
  g.add(cyl(0.035 * s, 0.045 * s, 0.14 * s, C.dirt, x, 0, z, 6));
  g.add(cone(0.15 * s, 0.32 * s, C.grassSide, x, 0.1 * s, z, 6));
  return g;
}

// ─── Landmarks ──────────────────────────────────────────────

function barbican(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.72, 0.78, 0.62, C.brick, 0, 0, 0, 14));
  g.add(cyl(0.74, 0.74, 0.08, C.brickDark, 0, 0.62, 0, 14));
  // seven turrets with green spires
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const x = Math.cos(a) * 0.62;
    const z = Math.sin(a) * 0.62;
    g.add(cyl(0.11, 0.11, 0.32, C.brick, x, 0.62, z, 8));
    g.add(cone(0.14, 0.34, C.copper, x, 0.94, z, 8));
  }
  // gate house
  g.add(box(0.4, 0.5, 0.35, C.brick, 0, 0, 0.78));
  g.add(box(0.2, 0.28, 0.02, C.window, 0, 0, 0.96));
  return g;
}

function basilica(): THREE.Group {
  const g = new THREE.Group();
  // nave and pitched roof
  g.add(box(0.7, 0.75, 1.3, C.brick, 0, 0, -0.25));
  g.add(roof(0.78, 0.45, 1.3, C.brickDark, 0, 0.75, -0.25));
  windows(g, 2, 0.7, 0.25, 0.41, 0, 0.3);
  // taller tower (with golden crown) on the left, shorter tower on the right
  g.add(box(0.36, 1.65, 0.36, C.brick, -0.3, 0, 0.45));
  g.add(cone(0.26, 0.55, C.copper, -0.3, 1.65, 0.45, 8));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(cone(0.05, 0.22, C.copper, -0.3 + Math.cos(a) * 0.2, 1.65, 0.45 + Math.sin(a) * 0.2, 6));
  }
  g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), C.gold, -0.3, 2.25, 0.45));
  g.add(box(0.36, 1.3, 0.36, C.brick, 0.3, 0, 0.45));
  g.add(cone(0.22, 0.38, C.copper, 0.3, 1.3, 0.45, 4));
  // portal
  g.add(box(0.18, 0.3, 0.02, C.window, 0, 0, 0.64));
  windows(g, 1, 0.36, 1.05, 0.64, -0.3, 0.22);
  windows(g, 1, 0.36, 0.85, 0.64, 0.3, 0.2);
  return g;
}

function clothHall(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.9, 0.5, 0.62, C.stone));
  g.add(roof(0.62, 0.25, 1.86, C.roofRed, 0, 0.5, 0).rotateY(Math.PI / 2));
  // attic with white crenellations on both long sides
  battlements(g, 1.86, 0.5, 0.29, C.white);
  battlements(g, 1.86, 0.5, -0.29, C.white);
  // arcades along both long sides
  for (const z of [0.33, -0.33]) {
    for (let i = 0; i < 7; i++) {
      const x = -0.81 + i * 0.27;
      g.add(box(0.05, 0.3, 0.08, C.stoneDark, x, 0, z));
    }
    g.add(box(1.7, 0.06, 0.08, C.stoneDark, 0, 0.3, z));
  }
  // central portal
  g.add(box(0.26, 0.6, 0.66, C.stoneDark, 0, 0, 0));
  g.add(cone(0.12, 0.2, C.copper, 0, 0.6, 0, 4));
  g.add(tree(-0.9, 0.75, 0.9));
  g.add(tree(0.95, -0.72, 0.9));
  return g;
}

function townHallTower(): THREE.Group {
  const g = new THREE.Group();
  const tower = new THREE.Group();
  tower.add(box(0.55, 1.45, 0.55, C.brick));
  tower.add(box(0.62, 0.08, 0.62, C.stone, 0, 0.55, 0));
  tower.add(box(0.62, 0.08, 0.62, C.stone, 0, 1.45, 0));
  windows(tower, 2, 0.55, 0.85, 0.28, 0, 0.26);
  // clock face
  tower.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 16).rotateX(Math.PI / 2), C.white, 0, 1.25, 0.29));
  // baroque helmet
  tower.add(mesh(new THREE.SphereGeometry(0.26, 10, 8), C.copper, 0, 1.68, 0));
  tower.add(cyl(0.07, 0.12, 0.2, C.copper, 0, 1.88, 0, 8));
  tower.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), C.copper, 0, 2.12, 0));
  tower.add(cone(0.05, 0.3, C.gold, 0, 2.18, 0, 6));
  // it really leans a little
  tower.rotation.z = -0.04;
  g.add(tower);
  g.add(box(0.9, 0.12, 0.9, C.stoneDark));
  g.add(tree(0.75, 0.55));
  g.add(tree(-0.8, -0.4));
  return g;
}

function castle(): THREE.Group {
  const g = new THREE.Group();
  // hill
  g.add(cyl(0.95, 1.15, 0.25, C.grassSide, 0, 0, 0, 12));
  const y = 0.25;
  // courtyard castle: four wings
  g.add(box(1.2, 0.45, 0.28, C.stone, 0, y, -0.4));
  g.add(box(1.2, 0.45, 0.28, C.stone, 0, y, 0.4));
  g.add(box(0.28, 0.45, 0.6, C.stone, -0.46, y, 0));
  g.add(box(0.28, 0.45, 0.6, C.stone, 0.46, y, 0));
  g.add(roof(0.34, 0.22, 1.22, C.roofRed, 0, y + 0.45, -0.4).rotateY(Math.PI / 2));
  g.add(roof(0.34, 0.22, 1.22, C.roofRed, 0, y + 0.45, 0.4).rotateY(Math.PI / 2));
  g.add(roof(0.34, 0.22, 0.6, C.roofRed, -0.46, y + 0.45, 0));
  g.add(roof(0.34, 0.22, 0.6, C.roofRed, 0.46, y + 0.45, 0));
  windows(g, 4, 1.2, y + 0.18, 0.55, 0, 0.14);
  // round tower
  g.add(cyl(0.17, 0.17, 0.85, C.stone, 0.7, y, 0.55, 10));
  g.add(cone(0.22, 0.4, C.roofRed, 0.7, y + 0.85, 0.55, 10));
  // cathedral tower + golden Sigismund dome
  g.add(box(0.24, 1.0, 0.24, C.stone, -0.65, y, -0.55));
  g.add(cone(0.2, 0.42, C.copper, -0.65, y + 1.0, -0.55, 4));
  g.add(cyl(0.16, 0.16, 0.2, C.stone, -0.25, y + 0.45, -0.62, 10));
  const dome = mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.gold);
  dome.position.set(-0.25, y + 0.65, -0.62);
  g.add(dome);
  return g;
}

function dragon(): THREE.Group {
  const g = new THREE.Group();
  // rock
  g.add(mesh(new THREE.DodecahedronGeometry(0.42, 0), C.rock, 0, 0.18, 0));
  const d = new THREE.Group();
  d.position.set(0, 0.5, 0);
  const body = mesh(new THREE.SphereGeometry(0.3, 10, 8), C.dragon);
  body.scale.set(1.3, 0.85, 0.9);
  d.add(body);
  // neck + head
  const neck = mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.5, 8), C.dragon, 0.28, 0.32, 0);
  neck.rotation.z = -0.6;
  d.add(neck);
  const head = box(0.3, 0.18, 0.2, C.dragon, 0.52, 0.48, 0);
  d.add(head);
  d.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), C.white, 0.6, 0.62, 0.09));
  d.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), C.white, 0.6, 0.62, -0.09));
  d.add(cone(0.03, 0.12, C.gold, 0.45, 0.66, 0.06, 4));
  d.add(cone(0.03, 0.12, C.gold, 0.45, 0.66, -0.06, 4));
  // fire!
  const fire = mesh(new THREE.ConeGeometry(0.09, 0.4, 8), C.fire, 0.88, 0.57, 0);
  fire.rotation.z = Math.PI / 2;
  d.add(fire);
  const fireCore = mesh(new THREE.ConeGeometry(0.05, 0.25, 6), C.gold, 0.8, 0.57, 0);
  fireCore.rotation.z = Math.PI / 2;
  d.add(fireCore);
  // wings
  for (const side of [1, -1]) {
    const wing = mesh(new THREE.ConeGeometry(0.22, 0.5, 3), C.grassSide, -0.05, 0.3, side * 0.25);
    wing.rotation.x = side * 0.9;
    d.add(wing);
  }
  // spikes along the back
  for (let i = 0; i < 4; i++) d.add(cone(0.05, 0.13, C.gold, -0.25 + i * 0.15, 0.2, 0, 4));
  // tail
  const tail = mesh(new THREE.ConeGeometry(0.1, 0.55, 8), C.dragon, -0.55, -0.05, 0);
  tail.rotation.z = Math.PI / 2 + 0.4;
  d.add(tail);
  // legs
  for (const [x, z] of [
    [0.18, 0.16],
    [0.18, -0.16],
    [-0.2, 0.16],
    [-0.2, -0.16],
  ])
    d.add(cyl(0.06, 0.07, 0.25, C.dragon, x, -0.3, z, 6));
  d.rotation.y = -0.4;
  d.scale.setScalar(1.35);
  d.position.y = 0.62;
  g.add(d);
  return g;
}

function synagogue(): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.1, 0.7, 0.75, C.stone));
  // renaissance attic wall hides the roof
  g.add(box(1.14, 0.14, 0.79, C.stoneDark, 0, 0.7, 0));
  battlements(g, 1.1, 0.84, 0.37, C.stoneDark);
  battlements(g, 1.1, 0.84, -0.37, C.stoneDark);
  battlements(g, 0.75, 0.84, 0.55, C.stoneDark, true);
  battlements(g, 0.75, 0.84, -0.55, C.stoneDark, true);
  g.add(roof(0.7, 0.18, 1.05, C.roofRed, 0, 0.7, 0).rotateY(Math.PI / 2));
  // tall arched windows
  windows(g, 3, 1.1, 0.25, 0.38, 0, 0.32);
  // buttresses
  for (const x of [-0.56, 0.56]) g.add(box(0.1, 0.55, 0.12, C.stoneDark, x, 0, 0.36));
  // annex
  g.add(box(0.45, 0.4, 0.4, C.brick, 0.7, 0, -0.35));
  g.add(roof(0.48, 0.2, 0.4, C.roofRed, 0.7, 0.4, -0.35));
  g.add(tree(-0.85, 0.6));
  g.add(tree(0.9, 0.65, 0.8));
  return g;
}

function bridge(): THREE.Group {
  const g = new THREE.Group();
  // river
  const river = box(2.3, 0.04, 0.9, C.water, 0, 0, 0);
  river.name = DECOR;
  g.add(river);
  // deck spans the river along Z
  g.add(box(0.5, 0.06, 2.3, C.steel, 0, 0.12, 0));
  for (const x of [-0.25, 0.25]) {
    // railing
    g.add(box(0.03, 0.12, 2.3, C.window, x, 0.18, 0));
    // steel arch
    const arch = mesh(new THREE.TorusGeometry(0.95, 0.04, 6, 24, Math.PI), C.white, x, 0.12, 0);
    arch.rotation.y = Math.PI / 2;
    g.add(arch);
    // hangers
    for (let i = -3; i <= 3; i++) {
      const z = i * 0.25;
      const h = Math.sqrt(Math.max(0, 0.95 * 0.95 - z * z));
      g.add(box(0.015, h, 0.015, C.white, x, 0.12, z));
    }
  }
  // love padlocks
  for (let i = 0; i < 8; i++)
    g.add(box(0.04, 0.05, 0.03, [C.red, C.gold, C.purple, C.water][i % 4], 0.27, 0.16, -0.7 + i * 0.2));
  // floating acrobat
  const acro = new THREE.Group();
  acro.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), C.window, 0, 0.32, 0));
  acro.add(cyl(0.03, 0.05, 0.22, C.window, 0, 0.08, 0, 6));
  acro.position.set(0, 0.95, 0);
  g.add(acro);
  // riverbanks
  g.add(tree(-0.9, 0.85));
  g.add(tree(0.85, -0.85));
  return g;
}

function generic(): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.05, 0.05, 0.8, C.window, 0, 0, 0, 6));
  g.add(mesh(new THREE.SphereGeometry(0.3, 12, 10), C.red, 0, 1.0, 0));
  g.add(tree(0.6, 0.4));
  g.add(tree(-0.5, -0.5));
  return g;
}

const BUILDERS: Record<ModelKind, () => THREE.Group> = {
  barbican,
  basilica,
  clothhall: clothHall,
  tower: townHallTower,
  castle,
  dragon,
  synagogue,
  bridge,
  church: extra.church,
  twintower: extra.twinTower,
  domechurch: extra.domeChurch,
  chapel: extra.chapel,
  orthodox: extra.orthodox,
  synagogue2: extra.synagogueMoorish,
  synagogue3: extra.synagogueSmall,
  museum: extra.museum,
  gallery: extra.gallery,
  townhouse: extra.townhouse,
  palace: extra.palace,
  college: extra.college,
  gate: extra.gate,
  wallgate: extra.wallGate,
  statue: extra.statue,
  rider: extra.rider,
  bust: extra.bust,
  theatre: extra.theatre,
  theatre2: extra.theatreNouveau,
  cave: extra.cave,
  generic,
};

/** Build the full diorama (island + landmark) for a model kind. */
export function buildLandmarkModel(kind: ModelKind): THREE.Group {
  const root = new THREE.Group();
  root.add(island());
  root.add((BUILDERS[kind] ?? generic)());
  return root;
}

/**
 * The landmark alone, without the grass island and scenery, for the city map.
 * Its bottom sits at y = 0.
 */
export function buildLandmarkForMap(kind: ModelKind): THREE.Group {
  const g = (BUILDERS[kind] ?? generic)();
  g.children.filter((c) => c.name === DECOR).forEach((c) => g.remove(c));
  // The map shows many landmarks at once: one mesh per colour instead of
  // dozens of small parts keeps the number of draw calls low.
  return mergeByMaterial(g);
}

/**
 * Merge all meshes of a static model into one mesh per material
 * (same look, far fewer draw calls). The original geometry is freed.
 */
export function mergeByMaterial(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const local = new THREE.Matrix4();
  const parts = new Map<THREE.Material, { pos: number[]; nor: number[] }>();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    local.multiplyMatrices(toRoot, o.matrixWorld);
    normalMatrix.getNormalMatrix(local);
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const p = geo.getAttribute('position');
    const nn = geo.getAttribute('normal');
    let part = parts.get(o.material);
    if (!part) parts.set(o.material, (part = { pos: [], nor: [] }));
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(local);
      part.pos.push(v.x, v.y, v.z);
      if (nn) n.fromBufferAttribute(nn, i).applyMatrix3(normalMatrix).normalize();
      else n.set(0, 1, 0);
      part.nor.push(n.x, n.y, n.z);
    }
    if (geo !== o.geometry) geo.dispose();
  });
  disposeModel(root);
  const out = new THREE.Group();
  for (const [material, { pos, nor }] of parts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.add(new THREE.Mesh(geo, material));
  }
  return out;
}

/** Hide the colours of a locked stop: everything grey. */
export function greyOut(root: THREE.Object3D) {
  const grey = new THREE.MeshLambertMaterial({ color: 0xd0d0d0, flatShading: true });
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.material = grey;
  });
}

/** Free GPU memory when a model is removed. */
export function disposeModel(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}

/**
 * Give a model its own copies of the (shared) materials, so a short-lived
 * renderer doesn't stay in memory through listeners on shared materials.
 * Dispose the returned materials together with the model.
 */
export function ownMaterials(root: THREE.Object3D): THREE.Material[] {
  const copies = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !Array.isArray(o.material)) {
      let copy = copies.get(o.material);
      if (!copy) copies.set(o.material, (copy = o.material.clone()));
      o.material = copy;
    }
  });
  return [...copies.values()];
}
