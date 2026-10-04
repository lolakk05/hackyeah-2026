/**
 * Puts each landmark model exactly where the real building stands.
 *
 * For every landmark we look for its footprint in the OpenStreetMap data (by
 * name, near the landmark's coordinates). The plain block(s) for that building
 * are removed, and the landmark model is fitted into the footprint's oriented
 * bounding box (same position, size and rotation). If nothing matches, the
 * fallback size/heading below is used around the landmark's coordinates.
 */
import type { Landmark, ModelKind } from '@/api/types';

import { toLocal } from './geo';
import { centroid, pointInRing, type MapData, type OsmBuilding, type P } from './osm';

interface KindConfig {
  /** OSM `name` patterns (Polish and English). */
  names: string[];
  /** Real height of the landmark in metres (model is scaled to it). */
  heightMeters: number;
  /** Footprint used when OSM has no match: length along `axisBearing` × width. */
  fallback: { length: number; width: number; axisBearing: number };
  /** Compass direction the model's front (+Z, e.g. church towers) should face. */
  front?: number;
  /** Never replace OSM buildings (statues, bridges). */
  noBuilding?: boolean;
}

export const KIND_CONFIG: Record<ModelKind, KindConfig> = {
  // The Barbican is a round fortress, about 30 m across.
  barbican: { names: ['Barbakan', 'Barbican'], heightMeters: 18, fallback: { length: 30, width: 30, axisBearing: 0 }, front: 180 },
  basilica: {
    // (not every "Najświętszej Marii Panny" church: only St Mary's on the Main Square)
    names: ['Mariack', "St. Mary's Basilica", 'Bazylika Wniebowzięcia Najświętszej'],
    heightMeters: 81,
    fallback: { length: 80, width: 30, axisBearing: 90 },
    front: 270, // towers face west, onto the Main Square
  },
  clothhall: { names: ['Sukiennice', 'Cloth Hall'], heightMeters: 22, fallback: { length: 108, width: 26, axisBearing: 0 } },
  tower: {
    names: ['Wieża Ratuszowa', 'Town Hall Tower'],
    heightMeters: 70,
    fallback: { length: 14, width: 14, axisBearing: 0 },
  },
  castle: {
    names: ['Zamek Królewski', 'Royal Castle', 'Wawel Castle'],
    heightMeters: 32,
    fallback: { length: 95, width: 80, axisBearing: 0 },
    front: 0,
  },
  dragon: {
    names: ['Smok Wawelski'],
    heightMeters: 8,
    fallback: { length: 10, width: 10, axisBearing: 0 },
    front: 180,
    noBuilding: true,
  },
  synagogue: { names: ['Stara Synagoga', 'Old Synagogue'], heightMeters: 18, fallback: { length: 40, width: 24, axisBearing: 0 } },
  bridge: {
    names: ['Bernatka'],
    heightMeters: 18,
    fallback: { length: 145, width: 16, axisBearing: 0 },
    noBuilding: true,
  },
  // Variants for places returned by the route planner (matched by OSM id or name).
  church: { names: [], heightMeters: 45, fallback: { length: 50, width: 20, axisBearing: 0 } },
  twintower: { names: [], heightMeters: 48, fallback: { length: 55, width: 26, axisBearing: 0 } },
  domechurch: { names: [], heightMeters: 40, fallback: { length: 40, width: 32, axisBearing: 0 } },
  chapel: { names: [], heightMeters: 14, fallback: { length: 14, width: 9, axisBearing: 0 } },
  orthodox: { names: [], heightMeters: 26, fallback: { length: 26, width: 15, axisBearing: 0 } },
  synagogue2: { names: [], heightMeters: 22, fallback: { length: 30, width: 22, axisBearing: 0 } },
  synagogue3: { names: [], heightMeters: 14, fallback: { length: 22, width: 16, axisBearing: 0 } },
  museum: { names: [], heightMeters: 20, fallback: { length: 45, width: 26, axisBearing: 0 } },
  gallery: { names: [], heightMeters: 18, fallback: { length: 40, width: 30, axisBearing: 0 } },
  townhouse: { names: [], heightMeters: 18, fallback: { length: 26, width: 16, axisBearing: 0 } },
  palace: { names: [], heightMeters: 20, fallback: { length: 50, width: 26, axisBearing: 0 } },
  college: { names: [], heightMeters: 20, fallback: { length: 40, width: 32, axisBearing: 0 } },
  gate: { names: [], heightMeters: 34, fallback: { length: 14, width: 12, axisBearing: 0 } },
  wallgate: { names: [], heightMeters: 15, fallback: { length: 32, width: 9, axisBearing: 0 } },
  // Statues are small in real life: shown a bit bigger so they can be seen on the map.
  statue: { names: [], heightMeters: 14, fallback: { length: 8, width: 8, axisBearing: 0 }, noBuilding: true },
  rider: { names: [], heightMeters: 14, fallback: { length: 12, width: 7, axisBearing: 90 }, noBuilding: true },
  bust: { names: [], heightMeters: 11, fallback: { length: 7, width: 7, axisBearing: 0 }, noBuilding: true },
  theatre: { names: [], heightMeters: 28, fallback: { length: 50, width: 36, axisBearing: 0 } },
  theatre2: { names: [], heightMeters: 20, fallback: { length: 40, width: 26, axisBearing: 0 } },
  cave: { names: ['Smocza Jama'], heightMeters: 12, fallback: { length: 18, width: 16, axisBearing: 0 }, noBuilding: true },
  generic: { names: [], heightMeters: 30, fallback: { length: 12, width: 12, axisBearing: 0 }, noBuilding: true },
};

/** All landmark name patterns, for the Overpass query. */
export function allLandmarkNamePatterns(): string[] {
  return Object.values(KIND_CONFIG).flatMap((c) => c.names);
}

export interface Placement {
  landmark: Landmark;
  /** Centre in local metres. */
  center: P;
  /** Unit vector of the footprint's long axis. */
  axis: P;
  length: number;
  width: number;
  heightMeters: number;
  front?: number;
  /** True when the footprint came from real OSM data. */
  matched: boolean;
  /** Footprint outline (for hit-testing and clearing). */
  outline: P[];
}

const SEARCH_RADIUS = 400;

export function placeLandmarks(
  landmarks: Landmark[],
  data: MapData,
): { placements: Placement[]; buildings: OsmBuilding[] } {
  const removed = new Set<string>();
  const placements: Placement[] = [];

  for (const lm of landmarks) {
    const cfg = KIND_CONFIG[lm.model] ?? KIND_CONFIG.generic;
    const anchor = toLocal(lm.coordinates);
    const near = (p: P) => Math.hypot(p.x - anchor.x, p.z - anchor.z) < SEARCH_RADIUS;
    const nameMatches = (name?: string) =>
      !!name && cfg.names.some((n) => name.toLowerCase().includes(n.toLowerCase()));

    // Places from the route planner carry their OpenStreetMap id ("way-123"): use that exact building.
    const osm = /^(way|relation)[-/](\d+)$/.exec(lm.id);
    const osmId = osm ? `${osm[1]}/${osm[2]}` : null;
    const ownName = lm.name.toLowerCase();

    let points: P[] = [];
    let matched = false;
    let matchedIds: string[] = [];
    let trusted = false;

    if (!cfg.noBuilding) {
      let hits = osmId ? data.buildings.filter((b) => b.id === osmId) : [];
      trusted = hits.length > 0;
      if (!trusted) {
        hits = data.buildings.filter(
          (b) => (nameMatches(b.name) || b.name?.toLowerCase() === ownName) && near(centroid(b.ring)),
        );
      }
      if (hits.length) {
        // keep only the buildings right next to the one closest to the anchor
        const closest = hits.reduce((a, b) => (dist(centroid(a.ring), anchor) < dist(centroid(b.ring), anchor) ? a : b));
        const c0 = centroid(closest.ring);
        const cluster = hits.filter((b) => dist(centroid(b.ring), c0) < 60);
        matchedIds = cluster.map((b) => b.id);
        points = cluster.flatMap((b) => b.ring);
        matched = true;
      }
    }
    if (!matched) {
      // Statues, bridges…: use only the single named feature closest to the anchor.
      const named = (data.named ?? []).filter((n) => nameMatches(n.name) && n.points.some(near));
      if (named.length) {
        const nearest = (n: { points: P[] }) => Math.min(...n.points.map((p) => dist(p, anchor)));
        points = named.reduce((a, b) => (nearest(a) <= nearest(b) ? a : b)).points;
        matched = true;
      }
    }

    let box = points.length >= 2 ? orientedBox(points) : null;
    if (box && box.length < 4) box = null;
    // Lines (bridges) have almost no width in OSM: use the configured width.
    if (box && cfg.noBuilding) box.width = Math.max(box.width, cfg.fallback.width);

    // Sanity check: if the match is far away or much bigger than the real
    // landmark (a wrong feature with a similar name), don't trust it.
    const maxLength = cfg.fallback.length * 1.6;
    const maxWidth = Math.max(cfg.fallback.width, cfg.fallback.length) * 1.6;
    if (!trusted && box && (box.length > maxLength || box.width > maxWidth || dist(box.center, anchor) > 120)) {
      box = null;
      points = [];
      matched = false;
      matchedIds = [];
    }

    if (!box || points.length < 3) {
      // Fallback: configured size around the anchor (or the matched point/line).
      const center = box?.center ?? (points.length ? centroid(points) : anchor);
      const rad = ((box ? 0 : cfg.fallback.axisBearing) * Math.PI) / 180;
      const axis = box?.axis ?? { x: Math.sin(rad), z: -Math.cos(rad) };
      box = {
        center,
        axis,
        length: Math.min(Math.max(box?.length ?? 0, cfg.fallback.length), maxLength),
        width: cfg.fallback.width,
      };
    }
    matchedIds.forEach((id) => removed.add(id));

    const outline = boxOutline(box.center, box.axis, box.length, box.width);
    placements.push({ landmark: lm, ...box, heightMeters: cfg.heightMeters, front: cfg.front, matched, outline });

    // Clear any other block standing inside the landmark's footprint.
    if (!cfg.noBuilding) {
      const grown = boxOutline(box.center, box.axis, box.length + 4, box.width + 4);
      for (const b of data.buildings) {
        if (!removed.has(b.id) && pointInRing(centroid(b.ring), grown)) removed.add(b.id);
      }
    }
  }

  return { placements, buildings: data.buildings.filter((b) => !removed.has(b.id)) };
}

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Minimum-area oriented bounding box: tries the direction of every footprint
 * edge (rotating calipers, brute force; footprints are small).
 */
function orientedBox(points: P[]): { center: P; axis: P; length: number; width: number } {
  let best: { center: P; axis: P; length: number; width: number; area: number } | null = null;
  const c = centroid(points);
  const tryAxis = (axis: P) => {
    const perp = { x: -axis.z, z: axis.x };
    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;
    for (const p of points) {
      const a = (p.x - c.x) * axis.x + (p.z - c.z) * axis.z;
      const b = (p.x - c.x) * perp.x + (p.z - c.z) * perp.z;
      if (a < minA) minA = a;
      if (a > maxA) maxA = a;
      if (b < minB) minB = b;
      if (b > maxB) maxB = b;
    }
    const lenA = maxA - minA;
    const lenB = maxB - minB;
    const area = Math.max(lenA, 0.5) * Math.max(lenB, 0.5);
    if (best && area >= best.area - 1e-6) return;
    const midA = (minA + maxA) / 2;
    const midB = (minB + maxB) / 2;
    const center = { x: c.x + axis.x * midA + perp.x * midB, z: c.z + axis.z * midA + perp.z * midB };
    best = lenA >= lenB
      ? { center, axis, length: lenA, width: lenB, area }
      : { center, axis: perp, length: lenB, width: lenA, area };
  };
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    if (len > 0.5) tryAxis({ x: (q.x - p.x) / len, z: (q.z - p.z) / len });
  }
  if (!best) tryAxis({ x: 1, z: 0 });
  const { center, axis, length, width } = best!;
  return { center, axis, length, width };
}

function boxOutline(center: P, axis: P, length: number, width: number): P[] {
  const perp = { x: -axis.z, z: axis.x };
  const hl = length / 2;
  const hw = width / 2;
  return [
    [hl, hw],
    [-hl, hw],
    [-hl, -hw],
    [hl, -hw],
  ].map(([a, b]) => ({ x: center.x + axis.x * a + perp.x * b, z: center.z + axis.z * a + perp.z * b }));
}
