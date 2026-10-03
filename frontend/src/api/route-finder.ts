/**
 * Adapter for the Route Finder backend (POST /routes/plan, GET /pois/{id}).
 * Converts its JSON into the app's own types (Landmark, TripPlan) so the
 * screens don't need to know the backend format.
 * Contract: FRONTEND_INTEGRATION.md / example-plan.json from the backend repo.
 */
import type { Lang } from '@/i18n/strings';
import { KIND_CONFIG } from '@/map/landmark-placement';

import type { Landmark, LatLng, ModelKind, PlannedRoute, TripPlan, WheelchairAccess } from './types';

// ─── Backend types ──────────────────────────────────────────

export interface RfPoi {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  osm_url?: string | null;
  coordinate_source?: string;
  tags?: Record<string, string>;
}

export interface RfLeg {
  from_poi_id: string;
  to_poi_id: string;
  distance_m: number;
  duration_s: number;
}

export interface RfPlanResponse {
  start_poi: RfPoi;
  end_poi: RfPoi;
  intermediate_pois: RfPoi[];
  requested_duration_s: number;
  duration_s: number;
  distance_m: number;
  unused_duration_s: number;
  matches_target: boolean;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  legs: RfLeg[];
  snapped_waypoints: { poi_id: string; location: [number, number]; distance_from_poi_m: number }[];
  source: string;
  warnings: string[];
  candidates_considered?: number;
  attribution?: string;
}

/** Body of POST /routes/plan. Only these fields are allowed (others → 422). */
export interface RfPlanRequest {
  duration_minutes: number;
  start_location?: { latitude: number; longitude: number };
  start_poi_id?: string;
  category?: string;
  max_intermediate_stops?: 0 | 1 | 2;
  tolerance_percent?: number;
}

/** Error from the backend, with its `detail.code` when there is one. */
export class RouteFinderError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public retryAfterS?: number,
  ) {
    super(message);
  }
}

/** Turn a failed response into a RouteFinderError (422 list or domain error object). */
export async function toRouteFinderError(res: Response): Promise<RouteFinderError> {
  const retryHeader = Number(res.headers.get('Retry-After'));
  let body: { detail?: unknown } = {};
  try {
    body = await res.json();
  } catch {
    // no JSON body
  }
  const d = body.detail as
    | { code?: string; message?: string; retry_after_s?: number }
    | { msg?: string; loc?: (string | number)[] }[]
    | undefined;
  if (Array.isArray(d)) {
    const msg = d.map((e) => `${(e.loc ?? []).join('.')}: ${e.msg ?? ''}`).join('; ');
    return new RouteFinderError(msg || 'Validation error', res.status, 'validation_error');
  }
  return new RouteFinderError(
    d?.message ?? `HTTP ${res.status}`,
    res.status,
    d?.code ?? `http_${res.status}`,
    d?.retry_after_s ?? (Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : undefined),
  );
}

// ─── POI → Landmark ─────────────────────────────────────────

const CATEGORY_LABEL: Record<string, { pl: string; en: string; icon: string }> = {
  attraction: { pl: 'Atrakcja', en: 'Attraction', icon: '⭐' },
  museum: { pl: 'Muzeum', en: 'Museum', icon: '🏛️' },
  gallery: { pl: 'Galeria', en: 'Gallery', icon: '🖼️' },
  artwork: { pl: 'Sztuka w przestrzeni miejskiej', en: 'Public art', icon: '🎨' },
  viewpoint: { pl: 'Punkt widokowy', en: 'Viewpoint', icon: '🔭' },
  monument: { pl: 'Pomnik', en: 'Monument', icon: '🗿' },
  memorial: { pl: 'Miejsce pamięci', en: 'Memorial', icon: '🕯️' },
  castle: { pl: 'Zamek', en: 'Castle', icon: '🏰' },
  church: { pl: 'Kościół', en: 'Church', icon: '⛪' },
  place_of_worship: { pl: 'Świątynia', en: 'Place of worship', icon: '⛪' },
  park: { pl: 'Park', en: 'Park', icon: '🌳' },
  ruins: { pl: 'Ruiny', en: 'Ruins', icon: '🧱' },
  zoo: { pl: 'Zoo', en: 'Zoo', icon: '🦁' },
  theme_park: { pl: 'Park rozrywki', en: 'Theme park', icon: '🎡' },
};

/** Typical visiting time per category, in minutes (the backend only plans walking). */
const VISIT_MINUTES: Record<string, number> = {
  museum: 45,
  castle: 45,
  gallery: 20,
  attraction: 20,
  church: 15,
  place_of_worship: 15,
  viewpoint: 10,
  monument: 5,
  memorial: 5,
  artwork: 5,
};

const CATEGORY_COLORS: Record<string, string> = {
  attraction: '#E9A23B',
  museum: '#4C9EEB',
  gallery: '#9B7BEA',
  artwork: '#E46FA8',
  viewpoint: '#2BB5A3',
  monument: '#D9B44A',
  memorial: '#8E9AAF',
  castle: '#3DBE8B',
  church: '#E2683C',
  place_of_worship: '#E2683C',
};

function categoryLabel(category: string, lang: Lang) {
  const c = CATEGORY_LABEL[category];
  if (c) return c[lang];
  const pretty = category.replace(/_/g, ' ');
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}

/** Pick one of the 3D mini-models when the POI is a known Kraków landmark. */
export function modelKindForPoi(poi: RfPoi): ModelKind {
  const names = [poi.name, poi.tags?.name, poi.tags?.['name:en'], poi.tags?.['name:pl']]
    .filter(Boolean)
    .map((n) => n!.toLowerCase());
  for (const [kind, cfg] of Object.entries(KIND_CONFIG) as [ModelKind, (typeof KIND_CONFIG)[ModelKind]][]) {
    if (kind === 'generic') continue;
    if (cfg.names.some((pattern) => names.some((n) => n.includes(pattern.toLowerCase())))) return kind;
  }
  return 'generic';
}

function wheelchairFromTag(v?: string): WheelchairAccess {
  if (v === 'yes' || v === 'designated') return 'full';
  if (v === 'limited') return 'partial';
  if (v === 'no') return 'none';
  return 'unknown';
}

export function poiToLandmark(poi: RfPoi, lang: Lang): Landmark {
  const tags = poi.tags ?? {};
  const pl = lang === 'pl';
  const name = (pl ? tags['name:pl'] : tags['name:en']) || poi.name || tags.name || poi.id;
  const label = categoryLabel(poi.category, lang);
  const icon = CATEGORY_LABEL[poi.category]?.icon ?? '📍';
  const address = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const wheelchair = wheelchairFromTag(tags.wheelchair);

  const description =
    tags[`description:${lang}`] ||
    tags.description ||
    (pl
      ? `${name} – ${label.toLowerCase()} w Krakowie${address ? `, ${address}` : ''}.${tags.heritage ? ' Obiekt wpisany do rejestru zabytków.' : ''} Zapytaj przewodnika poniżej, aby dowiedzieć się więcej.`
      : `${name} is ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label.toLowerCase()} in Kraków${address ? ` at ${address}` : ''}.${tags.heritage ? ' It is a listed historic monument.' : ''} Ask the guide below to learn more.`);

  const facts: Landmark['facts'] = [];
  if (address) facts.push({ icon: '📍', label: pl ? 'Adres' : 'Address', value: address });
  if (tags.opening_hours)
    facts.push({ icon: '🕘', label: pl ? 'Godziny otwarcia' : 'Opening hours', value: tags.opening_hours });
  if (tags.heritage) facts.push({ icon: '🏛️', label: pl ? 'Zabytek' : 'Heritage', value: pl ? 'Tak, w rejestrze zabytków' : 'Listed monument' });
  if (tags.artwork_type) facts.push({ icon: '🎨', label: pl ? 'Rodzaj' : 'Type', value: tags.artwork_type });
  if (tags.website || tags.url) facts.push({ icon: '🔗', label: pl ? 'Strona' : 'Website', value: (tags.website || tags.url)! });
  if (tags.wikipedia) facts.push({ icon: '📖', label: 'Wikipedia', value: tags.wikipedia });

  return {
    id: poi.id,
    name,
    tagline: `${icon} ${label}`,
    description,
    photos: [],
    visitMinutes: VISIT_MINUTES[poi.category] ?? 15,
    walkMinutesFromPrevious: 0,
    coordinates: { latitude: poi.latitude, longitude: poi.longitude },
    accessibility: {
      wheelchair,
      stepFree: wheelchair === 'full',
      accessibleToilet: tags['toilets:wheelchair'] === 'yes',
      audioGuide: tags.audio_guide === 'yes' || tags['tactile_paving'] === 'yes',
      hearingSupport: tags['hearing_loop'] === 'yes',
      notes: tags['wheelchair:description'] ?? '',
    },
    facts,
    model: modelKindForPoi(poi),
    color: CATEGORY_COLORS[poi.category] ?? '#4C9EEB',
    suggestedQuestions: pl
      ? ['Co to za miejsce?', 'Co warto zobaczyć w pobliżu?', 'Gdzie zjeść w okolicy?']
      : ['What is this place?', 'What else is worth seeing nearby?', 'Where can I eat nearby?'],
  };
}

// ─── Plan → TripPlan + route ────────────────────────────────

const toLatLng = ([lon, lat]: [number, number]): LatLng => ({ latitude: lat, longitude: lon });

/** Cut the route LineString into one path per leg, at the snapped waypoints. */
export function splitIntoLegs(res: RfPlanResponse): LatLng[][] {
  const coords = res.geometry?.coordinates ?? [];
  if (coords.length < 2) return [];
  const sq = (a: [number, number], b: [number, number]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const cuts: number[] = [];
  let from = 0;
  for (const wp of res.snapped_waypoints ?? []) {
    let best = from;
    for (let i = from; i < coords.length; i++) if (sq(coords[i], wp.location) < sq(coords[best], wp.location)) best = i;
    cuts.push(best);
    from = best;
  }
  const legs: LatLng[][] = [];
  for (let i = 0; i + 1 < cuts.length; i++) legs.push(coords.slice(cuts[i], cuts[i + 1] + 1).map(toLatLng));
  return legs;
}

export function planResponseToTrip(res: RfPlanResponse, lang: Lang): { plan: TripPlan; landmarks: Landmark[] } {
  const pois = [res.start_poi, ...(res.intermediate_pois ?? []), res.end_poi];
  const landmarks = pois.map((p) => poiToLandmark(p, lang));
  const legPaths = splitIntoLegs(res);

  const route: PlannedRoute = {
    path: (res.geometry?.coordinates ?? []).map(toLatLng),
    legs: (res.legs ?? []).map((leg, i) => ({
      fromId: leg.from_poi_id,
      toId: leg.to_poi_id,
      distanceMeters: leg.distance_m,
      durationMinutes: Math.max(1, Math.round(leg.duration_s / 60)),
      path: legPaths[i] ?? [],
    })),
    distanceMeters: res.distance_m,
    walkMinutes: Math.round(res.duration_s / 60),
    requestedMinutes: Math.round(res.requested_duration_s / 60),
    matchesTarget: res.matches_target,
    warnings: res.warnings ?? [],
    attribution: res.attribution,
  };

  // Walking minutes into each stop, shown on the roadmap cards.
  for (const leg of route.legs) {
    const lm = landmarks.find((l) => l.id === leg.toId);
    if (lm) lm.walkMinutesFromPrevious = leg.durationMinutes;
  }

  const visitMinutes = landmarks.reduce((sum, l) => sum + l.visitMinutes, 0);
  return {
    plan: {
      stopIds: landmarks.map((l) => l.id),
      totalMinutes: route.walkMinutes + visitMinutes,
      skippedForAccessibility: [],
      route,
    },
    landmarks,
  };
}
