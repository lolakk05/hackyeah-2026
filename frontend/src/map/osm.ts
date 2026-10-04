/**
 * Real building footprints for the 3D map, from OpenStreetMap.
 *
 * Loading strategy (fastest first):
 *   1. parsed data saved on the phone from an earlier launch (instant)
 *   2. your backend, if MAP_DATA_URL is set in src/api/config.ts
 *   3. the public Overpass API: all mirrors are asked at once and the first
 *      answer wins. The result is then saved on the phone.
 * The download starts when the app opens (see journey-context), not when the
 * map opens.
 */
import { readMapCache, writeMapCache } from './map-cache';
import { MAP_BOUNDS, toLocal } from './geo';

export interface P {
  x: number;
  z: number;
}

export interface OsmBuilding {
  id: string;
  name?: string;
  wikidata?: string;
  /** Outer footprint in local metres, counter-clockwise, not closed. */
  ring: P[];
  holes: P[][];
  height: number;
  /** Rough category, used for colour. */
  kind: 'church' | 'public' | 'house' | 'roof';
}

/** A flat polygon with optional holes (local metres). */
export interface Area {
  ring: P[];
  holes: P[][];
}

export type GreenKind = 'park' | 'wood' | 'garden' | 'cemetery' | 'grass';

export interface Road {
  path: P[];
  /** Drawn width in metres. */
  width: number;
}

export interface MapData {
  buildings: OsmBuilding[];
  water: Area[];
  green: (Area & { kind: GreenKind })[];
  /** Streets drawn on the ground. */
  roads: Road[];
  /** Squares and pedestrian areas (Main Square…). */
  plazas: Area[];
  /** Tree positions, planted in parks and green areas when the data is parsed. */
  trees: P[];
  /** Named non-building features (statues, bridges) used to place landmarks. */
  named: { name: string; points: P[] }[];
}

export const EMPTY_MAP_DATA: MapData = { buildings: [], water: [], green: [], roads: [], plazas: [], trees: [], named: [] };

/** Most trees drawn (one instanced mesh, so this stays cheap). */
const MAX_TREES = 3500;

const ROAD_WIDTH: Record<string, number> = {
  motorway: 16,
  trunk: 15,
  primary: 14,
  secondary: 12,
  tertiary: 10,
  motorway_link: 8,
  trunk_link: 8,
  primary_link: 8,
  secondary_link: 8,
  tertiary_link: 8,
  unclassified: 8,
  residential: 8,
  living_street: 6,
  pedestrian: 7,
};

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function overpassQuery(namePatterns: string[]): string {
  const b = `${MAP_BOUNDS.south},${MAP_BOUNDS.west},${MAP_BOUNDS.north},${MAP_BOUNDS.east}`;
  const names = namePatterns.join('|');
  const roads = Object.keys(ROAD_WIDTH).join('|');
  // Mostly ways (relations are slow to assemble on the server): only the river and big parks.
  return `[out:json][timeout:60];
(
  way["building"](${b});
  way["natural"="water"](${b});
  relation["natural"="water"](${b});
  way["waterway"="riverbank"](${b});
  way["leisure"~"^(park|garden)$"](${b});
  relation["leisure"="park"](${b});
  way["landuse"~"^(grass|forest|cemetery|meadow|recreation_ground|village_green|allotments)$"](${b});
  way["natural"~"^(wood|scrub|grassland)$"](${b});
  way["highway"~"^(${roads})$"](${b});
  way["place"="square"](${b});
  node["name"~"${names}",i](${b});
  way["name"~"${names}",i](${b});
);
out geom(${b}) qt;`;
}

let cache: Promise<MapData> | null = null;

/**
 * Load (and cache) the map data. Safe to call many times: one download only.
 * @param namePatterns landmark names to look up (statues, bridges…)
 * @param customUrl    optional backend URL returning Overpass JSON
 */
export function loadMapData(namePatterns: string[], customUrl?: string): Promise<MapData> {
  if (!cache) {
    cache = (async () => {
      const saved = await readMapCache();
      if (saved) return saved;
      const data = parseOverpass(await fetchRaw(namePatterns, customUrl), namePatterns);
      if (data.buildings.length > 0) writeMapCache(data);
      return data;
    })().catch((e) => {
      cache = null; // allow retry
      throw e;
    });
  }
  return cache;
}

async function fetchRaw(namePatterns: string[], customUrl?: string): Promise<OverpassResponse> {
  if (customUrl) {
    const res = await fetch(customUrl);
    if (!res.ok) throw new Error(`Map data ${res.status}`);
    return res.json();
  }
  const body = `data=${encodeURIComponent(overpassQuery(namePatterns))}`;
  const controllers = OVERPASS_SERVERS.map(() => new AbortController());
  const timer = setTimeout(() => controllers.forEach((c) => c.abort()), 70_000);

  // Ask every mirror at once; the first good answer wins, the rest are cancelled.
  return new Promise<OverpassResponse>((resolve, reject) => {
    let failures = 0;
    let done = false;
    OVERPASS_SERVERS.forEach((server, i) => {
      fetch(server, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controllers[i].signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Overpass ${res.status}`);
          const json = (await res.json()) as OverpassResponse;
          if (!json.elements?.length) throw new Error('Overpass returned no data');
          if (done) return;
          done = true;
          clearTimeout(timer);
          controllers.forEach((c, j) => j !== i && c.abort());
          resolve(json);
        })
        .catch((e) => {
          failures += 1;
          if (failures === OVERPASS_SERVERS.length && !done) {
            clearTimeout(timer);
            reject(e instanceof Error ? e : new Error('Could not download map data'));
          }
        });
    });
  });
}

// ─── Parsing ────────────────────────────────────────────────

interface OverpassLatLon {
  lat: number;
  lon: number;
}
interface OverpassElement {
  type: 'way' | 'relation' | 'node';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: (OverpassLatLon | null)[];
  members?: { type: string; role: string; geometry?: (OverpassLatLon | null)[] }[];
}
interface OverpassResponse {
  elements: OverpassElement[];
}

export function parseOverpass(data: OverpassResponse, namePatterns?: string[]): MapData {
  const buildings: OsmBuilding[] = [];
  const water: Area[] = [];
  const green: MapData['green'] = [];
  const roads: Road[] = [];
  const plazas: Area[] = [];
  const named: MapData['named'] = [];
  // Keep only names a landmark could match (the data also has every street name).
  const patterns = namePatterns?.map((n) => n.toLowerCase());
  const wanted = (name: string) => !patterns || patterns.some((n) => name.toLowerCase().includes(n));

  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    if (el.type === 'node') {
      if (tags.name && el.lat !== undefined && el.lon !== undefined && wanted(tags.name))
        named.push({ name: tags.name, points: [toLocal({ latitude: el.lat, longitude: el.lon })] });
      continue;
    }
    if (tags.name && !tags.building && el.type === 'way' && el.geometry && wanted(tags.name)) {
      named.push({ name: tags.name, points: toPath(el.geometry) });
    }

    // Streets (lines) and pedestrian areas / squares (polygons)
    const isArea = tags.area === 'yes' || tags.place === 'square';
    if (tags.highway && !isArea && el.type === 'way' && el.geometry) {
      const width = ROAD_WIDTH[tags.highway];
      const path = toPath(el.geometry);
      if (width && path.length >= 2) roads.push({ path, width });
      continue;
    }

    let outers: P[][] = [];
    let holes: P[][] = [];

    if (el.type === 'way' && el.geometry) {
      outers = [toRing(el.geometry)];
    } else if (el.type === 'relation' && el.members) {
      outers = joinRings(el.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => toPath(m.geometry!)));
      holes = joinRings(el.members.filter((m) => m.role === 'inner' && m.geometry).map((m) => toPath(m.geometry!)));
    }
    outers = outers.filter((r) => r.length >= 3);
    if (outers.length === 0) continue;
    const areas = outers.map((ring) => ({
      ring,
      holes: holes.filter((h) => h.length >= 3 && pointInRing(h[0], ring)),
    }));

    if (tags.building) {
      for (const { ring, holes: inner } of areas) {
        const area = signedArea(ring);
        if (Math.abs(area) < 4) continue; // skip tiny sheds / kiosks
        buildings.push({
          id: `${el.type}/${el.id}`,
          name: tags.name,
          wikidata: tags.wikidata,
          ring: area < 0 ? ring.slice().reverse() : ring,
          holes: inner,
          height: buildingHeight(tags),
          kind: buildingKind(tags),
        });
      }
    } else if (tags.natural === 'water' || tags.waterway === 'riverbank') {
      water.push(...areas);
    } else if (tags.highway || tags.place === 'square') {
      plazas.push(...areas);
    } else {
      const kind = greenKind(tags);
      if (kind) green.push(...areas.map((a) => ({ ...a, kind })));
    }
  }
  return { buildings, water, green, roads, plazas, trees: plantTrees(green, buildings, plazas), named };
}

function greenKind(tags: Record<string, string>): GreenKind | null {
  const v = tags.leisure ?? tags.landuse ?? tags.natural;
  switch (v) {
    case 'park':
    case 'recreation_ground':
    case 'village_green':
      return 'park';
    case 'forest':
    case 'wood':
    case 'scrub':
      return 'wood';
    case 'garden':
    case 'allotments':
      return 'garden';
    case 'cemetery':
      return 'cemetery';
    case 'grass':
    case 'meadow':
    case 'grassland':
      return 'grass';
    default:
      return null;
  }
}

/** Distance between trees for each kind of green area (metres). */
const TREE_SPACING: Record<GreenKind, number> = { wood: 9, park: 12, cemetery: 12, garden: 15, grass: 24 };

/**
 * Plant trees on a jittered grid inside green areas, never inside a building
 * or on a square. Deterministic, so the map looks the same every time.
 */
function plantTrees(green: MapData['green'], buildings: OsmBuilding[], plazas: Area[]): P[] {
  // Buildings in a 40 m grid, so each tree only checks the buildings near it.
  const CELL = 40;
  const grid = new Map<string, P[][]>();
  const add = (ring: P[]) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    for (let gx = Math.floor(minX / CELL); gx <= Math.floor(maxX / CELL); gx++)
      for (let gz = Math.floor(minZ / CELL); gz <= Math.floor(maxZ / CELL); gz++) {
        const key = `${gx},${gz}`;
        const list = grid.get(key);
        if (list) list.push(ring);
        else grid.set(key, [ring]);
      }
  };
  buildings.forEach((b) => add(b.ring));
  plazas.forEach((a) => add(a.ring));
  const blocked = (p: P) =>
    (grid.get(`${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`) ?? []).some((r) => pointInRing(p, r));

  const trees: P[] = [];
  green.forEach((area, index) => {
    const spacing = TREE_SPACING[area.kind];
    let seed = (index + 1) * 2654435761;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of area.ring) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    for (let x = minX; x < maxX; x += spacing)
      for (let z = minZ; z < maxZ; z += spacing) {
        const p = { x: x + rand() * spacing * 0.8, z: z + rand() * spacing * 0.8 };
        if (!pointInRing(p, area.ring) || area.holes.some((h) => pointInRing(p, h)) || blocked(p)) continue;
        trees.push({ x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10 });
      }
  });
  if (trees.length <= MAX_TREES) return trees;
  // Too many: keep an even spread.
  const step = trees.length / MAX_TREES;
  return Array.from({ length: MAX_TREES }, (_, i) => trees[Math.floor(i * step)]);
}

/** Round to 10 cm (keeps the saved file small and quick to write). */
const r10 = (n: number) => Math.round(n * 10) / 10;

function toPath(geometry: (OverpassLatLon | null)[]): P[] {
  return geometry
    .filter((g): g is OverpassLatLon => !!g)
    .map((g) => {
      const p = toLocal({ latitude: g.lat, longitude: g.lon });
      return { x: r10(p.x), z: r10(p.z) };
    });
}

function toRing(geometry: (OverpassLatLon | null)[]): P[] {
  const path = toPath(geometry);
  if (path.length > 1 && same(path[0], path[path.length - 1])) path.pop();
  return path;
}

const same = (a: P, b: P) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.z - b.z) < 0.01;

/** Join multipolygon member ways into closed rings by matching endpoints. */
function joinRings(paths: P[][]): P[][] {
  const pending = paths.filter((p) => p.length > 1).map((p) => p.slice());
  const rings: P[][] = [];
  while (pending.length) {
    let ring = pending.shift()!;
    let extended = true;
    while (!same(ring[0], ring[ring.length - 1]) && extended) {
      extended = false;
      const end = ring[ring.length - 1];
      for (let i = 0; i < pending.length; i++) {
        const p = pending[i];
        if (same(p[0], end)) ring = ring.concat(p.slice(1));
        else if (same(p[p.length - 1], end)) ring = ring.concat(p.slice(0, -1).reverse());
        else continue;
        pending.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (same(ring[0], ring[ring.length - 1])) ring.pop();
    rings.push(ring);
  }
  return rings;
}

function parseMeters(v?: string): number | undefined {
  if (!v) return undefined;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function buildingHeight(tags: Record<string, string>): number {
  const h = parseMeters(tags.height) ?? parseMeters(tags['building:height']);
  if (h) return Math.min(h, 120);
  const levels = parseMeters(tags['building:levels']);
  if (levels) return levels * 3.4 + 2;
  switch (tags.building) {
    case 'roof':
      return 4;
    case 'church':
    case 'cathedral':
    case 'chapel':
      return 22;
    case 'garage':
    case 'shed':
    case 'kiosk':
      return 4;
    default:
      return 14; // typical 3–4 storey Old Town tenement
  }
}

function buildingKind(tags: Record<string, string>): OsmBuilding['kind'] {
  const b = tags.building;
  if (b === 'roof') return 'roof';
  if (b === 'church' || b === 'cathedral' || b === 'chapel' || tags.amenity === 'place_of_worship') return 'church';
  if (b === 'public' || b === 'university' || b === 'civic' || b === 'government' || b === 'museum') return 'public';
  return 'house';
}

// ─── Geometry helpers (also used by landmark placement) ─────

/** Positive for counter-clockwise in (x, -z) i.e. map view with north up. */
export function signedArea(ring: P[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p.x * -q.z - q.x * -p.z;
  }
  return a / 2;
}

export function centroid(ring: P[]): P {
  let x = 0;
  let z = 0;
  for (const p of ring) {
    x += p.x;
    z += p.z;
  }
  return { x: x / ring.length, z: z / ring.length };
}

export function pointInRing(pt: P, ring: P[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.z > pt.z !== b.z > pt.z && pt.x < ((b.x - a.x) * (pt.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
