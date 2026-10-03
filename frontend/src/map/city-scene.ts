/**
 * Builds the three.js scene for the 3D city map:
 * ground, parks, river, all ordinary buildings (one merged mesh, so it stays
 * fast on phones), the landmark models, the walking route and the markers.
 *
 * Pure three.js (no React), so it can be tested in a browser.
 */
import * as THREE from 'three';

import { buildLandmarkForMap, disposeModel } from '@/components/models/builders';

import type { Placement } from './landmark-placement';
import { signedArea, type MapData, type OsmBuilding, type P } from './osm';

export interface CityPalette {
  sky: string;
  ground: string;
  green: string;
  water: string;
  walls: string[];
  roofs: string[];
  church: string;
  route: string;
  user: string;
  light: number;
}

export const DAY_PALETTE: CityPalette = {
  sky: '#DDF4FF',
  ground: '#EFE9DD',
  green: '#A8DD7C',
  water: '#7FD3FA',
  walls: ['#F4E6CC', '#EED9B6', '#F7EFE2', '#E9CFA6', '#F1DDC4', '#E5D3BC'],
  roofs: ['#C8643C', '#B8573A', '#D07450', '#A94F37'],
  church: '#C9694A',
  route: '#1CB0F6',
  user: '#1CB0F6',
  light: 1,
};

export const NIGHT_PALETTE: CityPalette = {
  sky: '#0B1418',
  ground: '#17252B',
  green: '#1F3A2A',
  water: '#123A4D',
  walls: ['#3B4D57', '#34454F', '#415560', '#2F3F48'],
  roofs: ['#4C3A3A', '#56413B', '#463638'],
  church: '#5A4038',
  route: '#49C0F8',
  user: '#49C0F8',
  light: 0.75,
};

export interface CityScene {
  scene: THREE.Scene;
  /** Landmark pivots by landmark id (for tap picking and labels). */
  landmarkObjects: Map<string, THREE.Object3D>;
  setRoute: (path: P[] | null) => void;
  setUser: (p: P | null) => void;
  setStops: (stops: { id: string; position: P; height: number; color: string; state: 'done' | 'next' | 'later' }[]) => void;
  /** Animate markers; call every frame. */
  tick: (timeSeconds: number) => void;
  dispose: () => void;
}

export function createCityScene(data: MapData, placements: Placement[], buildings: OsmBuilding[], pal: CityPalette): CityScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(pal.sky);
  scene.fog = new THREE.Fog(pal.sky, 1400, 3200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8ab95, 2.0 * pal.light));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.5 * pal.light);
  sun.position.set(-300, 600, 400);
  scene.add(sun);

  const disposables: { dispose: () => void }[] = [];
  const flat = (color: string) => {
    const m = new THREE.MeshLambertMaterial({ color });
    disposables.push(m);
    return m;
  };

  // Ground
  const groundGeo = new THREE.PlaneGeometry(8000, 8000).rotateX(-Math.PI / 2);
  disposables.push(groundGeo);
  scene.add(new THREE.Mesh(groundGeo, flat(pal.ground)));

  // Parks and water as flat shapes slightly above the ground
  const greenGeo = flatShapes(data.green, 0.15);
  const waterGeo = flatShapes(data.water, 0.3);
  if (greenGeo) {
    disposables.push(greenGeo);
    scene.add(new THREE.Mesh(greenGeo, flat(pal.green)));
  }
  if (waterGeo) {
    disposables.push(waterGeo);
    scene.add(new THREE.Mesh(waterGeo, flat(pal.water)));
  }

  // All ordinary buildings in one mesh
  const buildingGeo = extrudeBuildings(buildings, pal);
  disposables.push(buildingGeo);
  const buildingMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  disposables.push(buildingMat);
  scene.add(new THREE.Mesh(buildingGeo, buildingMat));

  // Landmarks, fitted into their real footprints
  const landmarkObjects = new Map<string, THREE.Object3D>();
  for (const pl of placements) {
    const pivot = fitLandmark(pl);
    pivot.userData.landmarkId = pl.landmark.id;
    landmarkObjects.set(pl.landmark.id, pivot);
    scene.add(pivot);
  }

  // Route ribbon
  const routeGroup = new THREE.Group();
  scene.add(routeGroup);
  const routeMat = new THREE.MeshBasicMaterial({ color: pal.route });
  const routeEdgeMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
  disposables.push(routeMat, routeEdgeMat);

  const setRoute = (path: P[] | null) => {
    routeGroup.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
    routeGroup.clear();
    if (!path || path.length < 2) return;
    routeGroup.add(new THREE.Mesh(ribbon(path, 7, 0.5), routeEdgeMat));
    routeGroup.add(new THREE.Mesh(ribbon(path, 4.5, 0.7), routeMat));
  };

  // User marker: a blue dot with a pulsing ring
  const user = new THREE.Group();
  const userDot = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), new THREE.MeshLambertMaterial({ color: pal.user }));
  userDot.position.y = 4;
  const userRing = new THREE.Mesh(
    new THREE.RingGeometry(5, 7, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: pal.user, transparent: true, opacity: 0.6 }),
  );
  userRing.position.y = 0.9;
  user.add(userDot, userRing);
  user.visible = false;
  scene.add(user);

  const setUser = (p: P | null) => {
    user.visible = !!p;
    if (p) user.position.set(p.x, 0, p.z);
  };

  // Stop pins
  const pins = new THREE.Group();
  scene.add(pins);
  let nextPin: THREE.Object3D | null = null;
  const setStops: CityScene['setStops'] = (stops) => {
    pins.children.forEach((c) => disposeModel(c));
    pins.clear();
    nextPin = null;
    for (const s of stops) {
      const color = s.state === 'done' ? '#FFC800' : s.state === 'next' ? s.color : '#AFAFAF';
      const size = s.state === 'next' ? 2.2 : 1.2;
      const pin = makePin(color, size);
      pin.position.set(s.position.x, s.height + 10, s.position.z);
      pin.userData.baseY = pin.position.y;
      pins.add(pin);
      if (s.state === 'next') nextPin = pin;
    }
  };

  const tick = (t: number) => {
    const pulse = (t % 1.6) / 1.6;
    userRing.scale.setScalar(1 + pulse * 1.8);
    (userRing.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - pulse);
    if (nextPin) {
      nextPin.position.y = (nextPin.userData.baseY as number) + Math.sin(t * 3) * 3;
      nextPin.rotation.y = t;
    }
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
    landmarkObjects.forEach((o) => disposeModel(o));
    disposeModel(user);
    disposeModel(pins);
    routeGroup.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
  };

  return { scene, landmarkObjects, setRoute, setUser, setStops, tick, dispose };
}

// ─── Landmarks ──────────────────────────────────────────────

function fitLandmark(pl: Placement): THREE.Object3D {
  const model = buildLandmarkForMap(pl.landmark.model);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Centre the model on its own footprint, bottom at y = 0.
  model.position.set(-center.x, -box.min.y, -center.z);
  const pivot = new THREE.Group();
  pivot.add(model);

  const longIsX = size.x >= size.z;
  const fit = 0.97; // leave a hair of space so walls never touch neighbours
  const sx = ((longIsX ? pl.length : pl.width) / size.x) * fit;
  const sz = ((longIsX ? pl.width : pl.length) / size.z) * fit;
  pivot.scale.set(sx, pl.heightMeters / size.y, sz);

  // Rotate so the model's long axis follows the real footprint.
  let theta = longIsX ? Math.atan2(-pl.axis.z, pl.axis.x) : Math.atan2(pl.axis.x, pl.axis.z);
  if (pl.front !== undefined) {
    const fr = (pl.front * Math.PI) / 180;
    const want = { x: Math.sin(fr), z: -Math.cos(fr) };
    const have = { x: Math.sin(theta), z: Math.cos(theta) }; // model +Z after rotation
    if (want.x * have.x + want.z * have.z < 0) theta += Math.PI;
  }
  pivot.rotation.y = theta;
  pivot.position.set(pl.center.x, 0, pl.center.z);
  return pivot;
}

function makePin(color: string, s: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const head = new THREE.Mesh(new THREE.SphereGeometry(4 * s, 16, 12), mat);
  head.position.y = 9 * s;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(3.2 * s, 8 * s, 16).rotateX(Math.PI), mat);
  tip.position.y = 4 * s;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(1.6 * s, 12, 8), new THREE.MeshBasicMaterial({ color: '#FFFFFF' }));
  dot.position.set(0, 9 * s, 3.4 * s);
  g.add(head, tip, dot);
  return g;
}

// ─── Geometry builders ──────────────────────────────────────

const toV2 = (p: P) => new THREE.Vector2(p.x, -p.z);

/** Flat polygons merged into one geometry at height y. */
function flatShapes(rings: P[][], y: number): THREE.BufferGeometry | null {
  const positions: number[] = [];
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const contour = ring.map(toV2);
    const faces = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const f of faces) {
      const tri = f.map((i) => ring[i]);
      upwardTriangle(positions, tri[0], tri[1], tri[2], y);
    }
  }
  if (!positions.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Push a horizontal triangle, wound so it faces up. */
function upwardTriangle(out: number[], a: P, b: P, c: P, y: number) {
  // cross((b-a),(c-a)).y = (bz-az)(cx-ax) - (bx-ax)(cz-az)
  const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
  if (ny >= 0) out.push(a.x, y, a.z, b.x, y, b.z, c.x, y, c.z);
  else out.push(a.x, y, a.z, c.x, y, c.z, b.x, y, b.z);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Extrude every footprint to its height; walls + flat roof, vertex-coloured. */
export function extrudeBuildings(buildings: OsmBuilding[], pal: CityPalette): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const roofC = new THREE.Color();

  const pushV = (x: number, y: number, z: number, nx: number, ny: number, nz: number, color: THREE.Color) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    col.push(color.r, color.g, color.b);
  };

  for (const b of buildings) {
    const h = hash(b.id);
    if (b.kind === 'church') {
      c.set(pal.church);
      roofC.set(pal.roofs[h % pal.roofs.length]).multiplyScalar(0.85);
    } else {
      c.set(pal.walls[h % pal.walls.length]);
      roofC.set(pal.roofs[(h >> 4) % pal.roofs.length]);
    }
    const height = b.height;
    const rings = [b.ring, ...b.holes.map((hole) => (signedArea(hole) > 0 ? hole.slice().reverse() : hole))];

    // Walls
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i];
        const q = ring[(i + 1) % ring.length];
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        const nx = -dz / len;
        const nz = dx / len;
        // two triangles: (p0,q0,q1) and (p0,q1,p1)
        pushV(p.x, 0, p.z, nx, 0, nz, c);
        pushV(q.x, 0, q.z, nx, 0, nz, c);
        pushV(q.x, height, q.z, nx, 0, nz, c);
        pushV(p.x, 0, p.z, nx, 0, nz, c);
        pushV(q.x, height, q.z, nx, 0, nz, c);
        pushV(p.x, height, p.z, nx, 0, nz, c);
      }
    }

    // Roof
    const all = [b.ring, ...b.holes];
    const flatPts = all.flat();
    let faces: number[][] = [];
    try {
      faces = THREE.ShapeUtils.triangulateShape(b.ring.map(toV2), b.holes.map((hole) => hole.map(toV2)));
    } catch {
      faces = [];
    }
    for (const f of faces) {
      const a = flatPts[f[0]];
      const bb = flatPts[f[1]];
      const cc = flatPts[f[2]];
      if (!a || !bb || !cc) continue;
      const tmp: number[] = [];
      upwardTriangle(tmp, a, bb, cc, height);
      for (let k = 0; k < 9; k += 3) pushV(tmp[k], tmp[k + 1], tmp[k + 2], 0, 1, 0, roofC);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** A flat ribbon along a path (the walking route), with round joints. */
function ribbon(path: P[], width: number, y: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const hw = width / 2;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.01) continue;
    const nx = (-(b.z - a.z) / len) * hw;
    const nz = ((b.x - a.x) / len) * hw;
    const quad = [
      { x: a.x + nx, z: a.z + nz },
      { x: b.x + nx, z: b.z + nz },
      { x: b.x - nx, z: b.z - nz },
      { x: a.x - nx, z: a.z - nz },
    ];
    upwardTriangle(pos, quad[0], quad[1], quad[2], y);
    upwardTriangle(pos, quad[0], quad[2], quad[3], y);
  }
  // round joints
  const seg = 10;
  for (const p of path) {
    for (let k = 0; k < seg; k++) {
      const a1 = (k / seg) * Math.PI * 2;
      const a2 = ((k + 1) / seg) * Math.PI * 2;
      upwardTriangle(
        pos,
        p,
        { x: p.x + Math.cos(a1) * hw, z: p.z + Math.sin(a1) * hw },
        { x: p.x + Math.cos(a2) * hw, z: p.z + Math.sin(a2) * hw },
        y,
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}
