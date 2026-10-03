/**
 * Builds the three.js scene for the 3D city map:
 * ground, parks, river, streets and squares, trees, ordinary buildings, the
 * landmark models, the walking route and the markers.
 *
 * Kept light for phones:
 *  - flat ground layers are merged per type and drawn without depth writes
 *    (no flickering between layers, no extra depth work),
 *  - buildings are merged into a few large tiles (one draw call each; tiles
 *    off screen are skipped),
 *  - all trees are two instanced meshes (2 draw calls in total),
 *  - geometry is cached, so opening the map a second time is instant.
 *
 * Pure three.js (no React), so it can be tested in a browser.
 */
import * as THREE from 'three';

import { buildLandmarkForMap, disposeModel, ownMaterials } from '@/components/models/builders';

import type { Placement } from './landmark-placement';
import { signedArea, type Area, type MapData, type OsmBuilding, type P, type Road } from './osm';

export interface CityPalette {
  sky: string;
  ground: string;
  green: string;
  wood: string;
  water: string;
  road: string;
  plaza: string;
  treeTops: string[];
  trunk: string;
  walls: string[];
  roofs: string[];
  church: string;
  route: string;
  user: string;
  light: number;
}

/** Night-time city colours matching the app theme. */
export const CITY_PALETTE: CityPalette = {
  sky: '#0F1724',
  ground: '#172133',
  green: '#1D3C32',
  wood: '#1A372D',
  water: '#16466A',
  road: '#26324A',
  plaza: '#2E3B55',
  treeTops: ['#2F6E4C', '#357A53', '#2A6145', '#3E8457', '#4A7F4C'],
  trunk: '#5B4636',
  walls: ['#46566F', '#3F4E66', '#4C5D78', '#3A4860', '#52627C'],
  roofs: ['#8A4E3A', '#7C4636', '#93573F', '#6F4033'],
  church: '#8C5A44',
  route: '#FFB547',
  user: '#5CC8FF',
  light: 1,
};

export interface CityScene {
  scene: THREE.Scene;
  /** Landmark pivots by landmark id (for tap picking and labels). */
  landmarkObjects: Map<string, THREE.Object3D>;
  /** (Re)build parks, water, buildings and landmarks. Can be called again when data arrives. */
  setCity: (data: MapData, placements: Placement[], buildings: OsmBuilding[]) => void;
  setRoute: (path: P[] | null) => void;
  /** Whole planned route as a thin, dim line. */
  setFullRoute: (path: P[] | null) => void;
  setUser: (p: P | null) => void;
  /** Reported problems (warning signs on poles). */
  setIssues: (issues: { id: string; position: P; severity: 'info' | 'hard' | 'blocked' }[]) => void;
  setStops: (stops: { id: string; position: P; height: number; color: string; state: 'done' | 'next' | 'later' }[]) => void;
  /** Animate markers; call every frame. */
  tick: (timeSeconds: number) => void;
  dispose: () => void;
}

/**
 * The scene starts with just the ground and markers so it can be shown
 * immediately; call `setCity` once the buildings are loaded.
 */
export function createCityScene(pal: CityPalette): CityScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(pal.sky);
  scene.fog = new THREE.Fog(pal.sky, 1900, 4600);

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x50586a, 2.2 * pal.light));
  const sun = new THREE.DirectionalLight(0xffe2b8, 1.6 * pal.light);
  sun.position.set(-300, 600, 400);
  scene.add(sun);

  const disposables: { dispose: () => void }[] = [];
  /** Flat ground layers: drawn in order, without writing depth, so they never flicker. */
  const layer = (color: string) => {
    const m = new THREE.MeshLambertMaterial({ color, depthWrite: false });
    disposables.push(m);
    return m;
  };
  const LAYER = { ground: -10, green: -9, wood: -8, water: -7, plaza: -6, road: -5 } as const;

  // Ground
  const groundGeo = new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2);
  disposables.push(groundGeo);
  const ground = new THREE.Mesh(groundGeo, layer(pal.ground));
  ground.renderOrder = LAYER.ground;
  scene.add(ground);

  // City content (rebuilt by setCity)
  const cityGroup = new THREE.Group();
  scene.add(cityGroup);
  const greenMat = layer(pal.green);
  const woodMat = layer(pal.wood);
  const waterMat = layer(pal.water);
  const plazaMat = layer(pal.plaza);
  const roadMat = layer(pal.road);
  const buildingMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const crownMat = new THREE.MeshLambertMaterial({ color: '#FFFFFF', flatShading: true });
  const trunkMat = new THREE.MeshLambertMaterial({ color: pal.trunk });
  disposables.push(buildingMat, crownMat, trunkMat);
  const landmarkObjects = new Map<string, THREE.Object3D>();

  /** Materials owned by this scene's landmarks (the model builders share theirs between views). */
  let landmarkMaterials: THREE.Material[] = [];
  const clearCity = () => {
    // Pivots of landmarks are Groups (disposeModel); the rest are Meshes.
    cityGroup.children.forEach((c) => {
      if (c instanceof THREE.InstancedMesh) c.dispose(); // frees the instance buffers
      if (c instanceof THREE.Mesh) c.geometry.dispose();
      else disposeModel(c);
    });
    landmarkMaterials.forEach((m) => m.dispose());
    landmarkMaterials = [];
    landmarkObjects.clear();
    cityGroup.clear();
  };

  const addLayer = (geo: THREE.BufferGeometry | null, material: THREE.Material, order: number) => {
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, material);
    mesh.renderOrder = order;
    mesh.frustumCulled = false; // spread over the whole map anyway
    cityGroup.add(mesh);
  };

  const setCity: CityScene['setCity'] = (data, placements, buildings) => {
    clearCity();
    const cached = groundCache(data);
    addLayer(geometryFrom(cached.green), greenMat, LAYER.green);
    addLayer(geometryFrom(cached.wood), woodMat, LAYER.wood);
    addLayer(geometryFrom(cached.water), waterMat, LAYER.water);
    addLayer(geometryFrom(cached.plazas), plazaMat, LAYER.plaza);
    addLayer(geometryFrom(cached.roads), roadMat, LAYER.road);

    // Trees: two instanced meshes (crowns + trunks) for all of them
    if (cached.trees.count > 0) {
      const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), crownMat, cached.trees.count);
      const trunks = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.22, 0.32, 1, 5, 1, true).translate(0, 0.5, 0),
        trunkMat,
        cached.trees.count,
      );
      crowns.instanceMatrix.array.set(cached.trees.crowns);
      trunks.instanceMatrix.array.set(cached.trees.trunks);
      crowns.instanceColor = new THREE.InstancedBufferAttribute(cached.trees.colors.slice(), 3);
      crowns.computeBoundingSphere();
      trunks.computeBoundingSphere();
      cityGroup.add(crowns, trunks);
    }

    // Ordinary buildings, merged into tiles
    for (const tile of buildingTiles(data, placements, buildings, pal)) {
      const mesh = new THREE.Mesh(geometryFrom(tile, true)!, buildingMat);
      cityGroup.add(mesh);
    }

    // Landmarks, fitted into their real footprints
    for (const pl of placements) {
      const pivot = fitLandmark(pl);
      landmarkMaterials.push(...ownMaterials(pivot));
      pivot.userData.landmarkId = pl.landmark.id;
      landmarkObjects.set(pl.landmark.id, pivot);
      cityGroup.add(pivot);
    }
  };

  // Route ribbon
  const routeGroup = new THREE.Group();
  scene.add(routeGroup);
  const routeMat = new THREE.MeshBasicMaterial({ color: pal.route });
  const routeEdgeMat = new THREE.MeshBasicMaterial({ color: '#241703' });
  disposables.push(routeMat, routeEdgeMat);

  const setRoute = (path: P[] | null) => {
    routeGroup.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
    routeGroup.clear();
    if (!path || path.length < 2) return;
    const edge = new THREE.Mesh(ribbon(path, 7, 0.5), routeEdgeMat);
    const line = new THREE.Mesh(ribbon(path, 4.5, 0.7), routeMat);
    edge.renderOrder = 1;
    line.renderOrder = 2;
    routeGroup.add(edge, line);
  };

  // Whole planned route (thin, under the current leg)
  const fullRouteGroup = new THREE.Group();
  scene.add(fullRouteGroup);
  const fullRouteMat = new THREE.MeshBasicMaterial({ color: '#7A6A4F' });
  disposables.push(fullRouteMat);
  const setFullRoute = (path: P[] | null) => {
    fullRouteGroup.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
    fullRouteGroup.clear();
    if (!path || path.length < 2) return;
    const line = new THREE.Mesh(ribbon(path, 3, 0.4), fullRouteMat);
    line.renderOrder = 0;
    fullRouteGroup.add(line);
  };

  // User marker: a dot with a pulsing ring
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

  // Reported problems: a pole with a turning warning sign. Instanced: 4 draw calls for all of them.
  const MAX_ISSUES = 80;
  const poleGeo = new THREE.CylinderGeometry(0.8, 0.8, 24, 6).translate(0, 12, 0);
  const signGeo = new THREE.CylinderGeometry(9, 9, 1.6, 3).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
  const markGeo = new THREE.BoxGeometry(1.6, 5.4, 2.2).translate(0, 0.6, 0);
  const spotGeo = new THREE.CircleGeometry(10, 20).rotateX(-Math.PI / 2).translate(0, 0.2, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: '#C9D3DF' });
  const signMat = new THREE.MeshLambertMaterial({ color: '#FFFFFF' });
  const markMat = new THREE.MeshBasicMaterial({ color: '#1A1A1A' });
  const spotMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.35, depthWrite: false });
  disposables.push(poleGeo, signGeo, markGeo, spotGeo, poleMat, signMat, markMat, spotMat);
  const issuePoles = new THREE.InstancedMesh(poleGeo, poleMat, MAX_ISSUES);
  const issueSigns = new THREE.InstancedMesh(signGeo, signMat, MAX_ISSUES);
  const issueMarks = new THREE.InstancedMesh(markGeo, markMat, MAX_ISSUES);
  const issueSpots = new THREE.InstancedMesh(spotGeo, spotMat, MAX_ISSUES);
  const issueMeshes = [issuePoles, issueSigns, issueMarks, issueSpots];
  for (const m of issueMeshes) {
    m.count = 0;
    m.frustumCulled = false; // spread over the map
    scene.add(m);
  }
  const ISSUE_COLORS = { blocked: '#FF6B6B', hard: '#FF9F43', info: '#5CC8FF' } as const;
  let issuePositions: P[] = [];
  const tmpMatrix = new THREE.Matrix4();
  const tmpQuat = new THREE.Quaternion();
  const tmpPos = new THREE.Vector3();
  const unit = new THREE.Vector3(1, 1, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const tmpColor = new THREE.Color();

  const setIssues: CityScene['setIssues'] = (issues) => {
    const list = issues.slice(0, MAX_ISSUES);
    issuePositions = list.map((i) => i.position);
    list.forEach((issue, i) => {
      tmpMatrix.makeTranslation(issue.position.x, 0, issue.position.z);
      issuePoles.setMatrixAt(i, tmpMatrix);
      issueSpots.setMatrixAt(i, tmpMatrix);
      tmpColor.set(ISSUE_COLORS[issue.severity] ?? ISSUE_COLORS.hard);
      issueSigns.setColorAt(i, tmpColor);
      issueSpots.setColorAt(i, tmpColor);
    });
    for (const m of issueMeshes) {
      m.count = list.length;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    turnSigns(0);
  };

  /** Turn the signs so they are readable from every side. */
  const turnSigns = (t: number) => {
    issuePositions.forEach((p, i) => {
      tmpQuat.setFromAxisAngle(yAxis, t * 0.8 + i * 0.7);
      tmpPos.set(p.x, 30, p.z);
      tmpMatrix.compose(tmpPos, tmpQuat, unit);
      issueSigns.setMatrixAt(i, tmpMatrix);
      issueMarks.setMatrixAt(i, tmpMatrix);
    });
    if (issuePositions.length) {
      issueSigns.instanceMatrix.needsUpdate = true;
      issueMarks.instanceMatrix.needsUpdate = true;
    }
  };

  // Stop pins
  const pins = new THREE.Group();
  scene.add(pins);
  /** One material per pin colour, shared by all pins of this scene. */
  const pinMats = new Map<string, THREE.Material>();
  const pinMat = (color: string) => {
    let m = pinMats.get(color);
    if (!m) pinMats.set(color, (m = new THREE.MeshLambertMaterial({ color })));
    return m;
  };
  const whiteMat = pinMat('#FFFFFF');
  let nextPin: THREE.Object3D | null = null;
  const setStops: CityScene['setStops'] = (stops) => {
    pins.children.forEach((c) => disposeModel(c));
    pins.clear();
    nextPin = null;
    for (const s of stops) {
      const color = s.state === 'done' ? '#3DDC97' : s.state === 'next' ? '#FFB547' : '#6B7A93';
      const size = s.state === 'next' ? 2.2 : 1.2;
      const pin = makePin(pinMat(color), whiteMat, size);
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
    turnSigns(t);
  };

  const dispose = () => {
    clearCity();
    disposables.forEach((d) => d.dispose());
    disposeModel(user);
    disposeModel(pins);
    issueMeshes.forEach((m) => m.dispose());
    pinMats.forEach((m) => m.dispose());
    routeGroup.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
    fullRouteGroup.children.forEach((c) => (c as THREE.Mesh).geometry?.dispose());
  };

  return { scene, landmarkObjects, setCity, setRoute, setFullRoute, setUser, setIssues, setStops, tick, dispose };
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

function makePin(mat: THREE.Material, white: THREE.Material, s: number): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(4 * s, 16, 12), mat);
  head.position.y = 9 * s;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(3.2 * s, 8 * s, 16).rotateX(Math.PI), mat);
  tip.position.y = 4 * s;
  const dot = new THREE.Mesh(new THREE.SphereGeometry(1.6 * s, 12, 8), white);
  dot.position.set(0, 9 * s, 3.4 * s);
  g.add(head, tip, dot);
  return g;
}

// ─── Geometry builders ──────────────────────────────────────

/** Raw vertex data; turned into GPU geometry without copying. */
interface Arrays {
  position: Float32Array;
  normal: Float32Array;
  color?: Float32Array;
}

function geometryFrom(a: Arrays | null, withColor = false): THREE.BufferGeometry | null {
  if (!a || a.position.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
  if (withColor && a.color) geo.setAttribute('color', new THREE.BufferAttribute(a.color, 3));
  geo.computeBoundingSphere();
  return geo;
}

/** Flat geometry facing up (all normals = +Y). */
function upArrays(positions: number[]): Arrays | null {
  if (!positions.length) return null;
  const normal = new Float32Array(positions.length);
  for (let i = 1; i < normal.length; i += 3) normal[i] = 1;
  return { position: new Float32Array(positions), normal };
}

interface TreeData {
  count: number;
  crowns: Float32Array;
  trunks: Float32Array;
  colors: Float32Array;
}

interface GroundCache {
  green: Arrays | null;
  wood: Arrays | null;
  water: Arrays | null;
  plazas: Arrays | null;
  roads: Arrays | null;
  trees: TreeData;
  /** Building tiles for the last set of landmarks. */
  tiles: Map<string, Arrays[]>;
}

/** Geometry is built once per loaded map and reused every time the map opens. */
const cacheByData = new WeakMap<MapData, GroundCache>();

function groundCache(data: MapData): GroundCache {
  let c = cacheByData.get(data);
  if (!c) {
    const green = data.green ?? [];
    c = {
      green: flatShapes(green.filter((g) => g.kind !== 'wood')),
      wood: flatShapes(green.filter((g) => g.kind === 'wood')),
      water: flatShapes(data.water ?? []),
      plazas: flatShapes(data.plazas ?? []),
      roads: roadRibbons(data.roads ?? []),
      trees: treeInstances(data.trees ?? [], CITY_PALETTE),
      tiles: new Map(),
    };
    cacheByData.set(data, c);
  }
  return c;
}

/** Flat polygons (with holes) merged into one geometry. */
function flatShapes(areas: Area[]): Arrays | null {
  const positions: number[] = [];
  for (const { ring, holes } of areas) {
    if (ring.length < 3) continue;
    const pts = [ring, ...holes].flat();
    let faces: number[][] = [];
    try {
      faces = THREE.ShapeUtils.triangulateShape(ring.map(toV2), holes.map((h) => h.map(toV2)));
    } catch {
      continue;
    }
    for (const f of faces) {
      const a = pts[f[0]];
      const b = pts[f[1]];
      const c = pts[f[2]];
      if (a && b && c) upwardTriangle(positions, a, b, c, 0);
    }
  }
  return upArrays(positions);
}

/** Streets as flat ribbons with rounded bends, all in one geometry. */
function roadRibbons(roads: Road[]): Arrays | null {
  const pos: number[] = [];
  const SEG = 6;
  for (const { path, width } of roads) {
    const hw = width / 2;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.01) continue;
      const nx = (-(b.z - a.z) / len) * hw;
      const nz = ((b.x - a.x) / len) * hw;
      const q0 = { x: a.x + nx, z: a.z + nz };
      const q1 = { x: b.x + nx, z: b.z + nz };
      const q2 = { x: b.x - nx, z: b.z - nz };
      const q3 = { x: a.x - nx, z: a.z - nz };
      upwardTriangle(pos, q0, q1, q2, 0);
      upwardTriangle(pos, q0, q2, q3, 0);
    }
    // Round joints at the bends (and the ends), so corners have no gaps.
    for (const p of path) {
      for (let k = 0; k < SEG; k++) {
        const a1 = (k / SEG) * Math.PI * 2;
        const a2 = ((k + 1) / SEG) * Math.PI * 2;
        upwardTriangle(
          pos,
          p,
          { x: p.x + Math.cos(a1) * hw, z: p.z + Math.sin(a1) * hw },
          { x: p.x + Math.cos(a2) * hw, z: p.z + Math.sin(a2) * hw },
          0,
        );
      }
    }
  }
  return upArrays(pos);
}

/** Instance matrices and colours for every tree (round crown on a short trunk). */
function treeInstances(trees: P[], pal: CityPalette): TreeData {
  const count = trees.length;
  const crowns = new Float32Array(count * 16);
  const trunks = new Float32Array(count * 16);
  const colors = new Float32Array(count * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  trees.forEach((p, i) => {
    const r1 = fract(Math.sin(i * 12.9898 + p.x * 0.013) * 43758.5453);
    const r2 = fract(Math.sin(i * 78.233 + p.z * 0.017) * 12543.853);
    const s = 0.75 + r1 * 0.6;
    q.setFromAxisAngle(up, r2 * Math.PI * 2);
    const radius = 3.3 * s;
    pos.set(p.x, 3.6 * s + radius * 0.75, p.z);
    scale.set(radius, radius * 1.15, radius);
    m.compose(pos, q, scale).toArray(crowns, i * 16);
    pos.set(p.x, 0, p.z);
    scale.set(s, 4.2 * s, s);
    m.compose(pos, q, scale).toArray(trunks, i * 16);
    color.set(pal.treeTops[Math.floor(r2 * pal.treeTops.length) % pal.treeTops.length]).multiplyScalar(0.85 + r1 * 0.3);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  });
  return { count, crowns, trunks, colors };
}

const fract = (n: number) => n - Math.floor(n);

/** Buildings grouped into ~500 m tiles, so tiles outside the view are skipped. */
const TILE = 500;

function buildingTiles(data: MapData, placements: Placement[], buildings: OsmBuilding[], pal: CityPalette): Arrays[] {
  const cache = groundCache(data).tiles;
  const key = `${buildings.length}|${placements.map((p) => p.landmark.id).join(',')}`;
  let tiles = cache.get(key);
  if (!tiles) {
    const groups = new Map<string, OsmBuilding[]>();
    for (const b of buildings) {
      const k = `${Math.floor(b.ring[0].x / TILE)},${Math.floor(b.ring[0].z / TILE)}`;
      const list = groups.get(k);
      if (list) list.push(b);
      else groups.set(k, [b]);
    }
    tiles = [...groups.values()].map((list) => extrudeBuildings(list, pal));
    cache.clear(); // keep only the latest variant
    cache.set(key, tiles);
  }
  return tiles;
}

const toV2 = (p: P) => new THREE.Vector2(p.x, -p.z);

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

/**
 * Extrude every footprint to its height: walls (darker at the bottom, a cheap
 * "ambient occlusion" look) and a flat roof, vertex-coloured.
 */
export function extrudeBuildings(buildings: OsmBuilding[], pal: CityPalette): Arrays {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const cLow = new THREE.Color();
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
    cLow.copy(c).multiplyScalar(0.62);
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
        pushV(p.x, 0, p.z, nx, 0, nz, cLow);
        pushV(q.x, 0, q.z, nx, 0, nz, cLow);
        pushV(q.x, height, q.z, nx, 0, nz, c);
        pushV(p.x, 0, p.z, nx, 0, nz, cLow);
        pushV(q.x, height, q.z, nx, 0, nz, c);
        pushV(p.x, height, p.z, nx, 0, nz, c);
      }
    }

    // Roof
    const flatPts = [b.ring, ...b.holes].flat();
    let faces: number[][] = [];
    try {
      faces = THREE.ShapeUtils.triangulateShape(b.ring.map(toV2), b.holes.map((hole) => hole.map(toV2)));
    } catch {
      faces = [];
    }
    const tmp: number[] = [];
    for (const f of faces) {
      const a = flatPts[f[0]];
      const bb = flatPts[f[1]];
      const cc = flatPts[f[2]];
      if (!a || !bb || !cc) continue;
      tmp.length = 0;
      upwardTriangle(tmp, a, bb, cc, height);
      for (let k = 0; k < 9; k += 3) pushV(tmp[k], tmp[k + 1], tmp[k + 2], 0, 1, 0, roofC);
    }
  }

  return { position: new Float32Array(pos), normal: new Float32Array(nor), color: new Float32Array(col) };
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
