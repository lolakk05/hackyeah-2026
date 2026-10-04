/**
 * ─────────────────────────────────────────────────────────────
 *  API CLIENT: the only place the app talks to the backend
 * ─────────────────────────────────────────────────────────────
 *
 * USE_MOCK_API (no EXPO_PUBLIC_API_URL) → sample data (mock-data.ts / mock-ai.ts)
 * otherwise → the Route Finder backend:
 *   POST /routes/plan   plan a walk for the chosen time   (route-finder.ts maps the JSON)
 *   GET  /pois/{id}     details of one place
 * Features the backend doesn't have yet (AI guide, accessibility reports)
 * fall back to local behaviour automatically, so the app keeps working.
 * Accounts, XP, ranking and rewards are in account.ts.
 */
import type { Lang } from '@/i18n/strings';
import { distanceMeters, MAP_ORIGIN } from '@/map/geo';

import {
  API_BASE_URL,
  ENDPOINTS,
  FALLBACK_CAPABILITIES,
  MINUTES_PER_STOP,
  MOCK_DELAY_MS,
  PLAN_TIMEOUT_MS,
  TOLERANCE_PERCENT,
  USE_MOCK_API,
} from './config';
import { mockAnswer } from './mock-ai';
import { MOCK_LANDMARKS } from './mock-data';
import { localizeToPolish } from './mock-data-pl';
import {
  planResponseToTrip,
  poiToLandmark,
  RouteFinderError,
  toRouteFinderError,
  type RfPlanRequest,
  type RfPlanResponse,
  type RfPoi,
} from './route-finder';
import { AI_GUIDE_URL, askGuide, buildQuestion } from './ai-guide';
import { diversifyModels } from './model-choice';
import { planTripLocally, walkMinutes } from './trip-planner';
import type {
  AccessibilityNeeds,
  AccessibilityReport,
  ChatMessage,
  Landmark,
  LatLng,
  TripPlan,
  TripPreferences,
  WalkingRoute,
} from './types';

export { RouteFinderError } from './route-finder';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Language for texts (set from the language screen). */
let apiLang: Lang = 'en';
export function setApiLanguage(lang: Lang) {
  apiLang = lang;
}

/**
 * Call the backend. Throws RouteFinderError for HTTP errors (with the
 * backend's `detail.code`) and for network problems (code "network").
 */
async function request<T>(path: string, init?: RequestInit, timeoutMs = 20_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': apiLang,
        // ngrok's free plan shows a warning page instead of the API without this.
        'ngrok-skip-browser-warning': 'true',
        // TODO(API): add auth here if needed, e.g. Authorization: `Bearer ${token}`
        ...init?.headers,
      },
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    throw new RouteFinderError(
      aborted ? 'Request timed out' : `Network error: ${e instanceof Error ? e.message : String(e)}`,
      0,
      aborted ? 'client_timeout' : 'network',
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw await toRouteFinderError(res);
  return (await res.json()) as T;
}

const mockLandmarks = () => (apiLang === 'pl' ? localizeToPolish(MOCK_LANDMARKS) : MOCK_LANDMARKS);

/** Log quietly (no warning banner in the app): sample data is shown instead. */
function fellBack(what: string, e?: unknown) {
  if (__DEV__) console.log(`[api] ${what}: using sample data`, e instanceof Error ? e.message : (e ?? 'no data'));
}

/** How many places the start screen and the 3D map show before a trip is planned. */
const PREVIEW_PLACES = 12;

/**
 * Landmarks shown before a trip is planned (roadmap preview, 3D map).
 * Tries the API's place list first; the sample places if it fails or is empty.
 */
export async function fetchLandmarks(): Promise<Landmark[]> {
  const fromApi = await fetchApiPlaces();
  if (fromApi) return fromApi.slice(0, PREVIEW_PLACES);
  await wait(MOCK_DELAY_MS);
  return mockLandmarks();
}

/** The API's place list, or null when it can't be loaded or is empty (never throws). */
async function fetchApiPlaces(): Promise<Landmark[] | null> {
  if (USE_MOCK_API || !ENDPOINTS.landmarks) return null;
  try {
    const res = await request<RfPoi[] | { items: RfPoi[] }>(ENDPOINTS.landmarks);
    const pois = Array.isArray(res) ? res : (res?.items ?? []);
    if (pois.length) return diversifyModels(pois.map((p) => poiToLandmark(p, apiLang)));
    fellBack('places (empty list)');
  } catch (e) {
    fellBack('places', e);
  }
  return null;
}

/**
 * Every place the app knows, for the "Places" screen.
 * Real API: GET ENDPOINTS.landmarks (a list of POIs, like the route planner's).
 * Until that endpoint is set, the sample landmarks are shown.
 */
export async function fetchAllLandmarks(): Promise<Landmark[]> {
  const fromApi = await fetchApiPlaces();
  if (fromApi) return fromApi;
  await wait(MOCK_DELAY_MS);
  return mockLandmarks();
}

/** One place with all details. Real API: GET /pois/{id}. */
export async function fetchLandmark(id: string): Promise<Landmark> {
  if (!USE_MOCK_API) {
    try {
      const poi = await request<RfPoi>(ENDPOINTS.poi(id));
      if (poi) return poiToLandmark(poi, apiLang);
    } catch (e) {
      fellBack(`place ${id}`, e);
    }
  } else {
    await wait(MOCK_DELAY_MS);
  }
  const lm = mockLandmarks().find((l) => l.id === id);
  if (!lm) throw new Error(`Landmark "${id}" not found`);
  return lm;
}

/**
 * Plan the walk.
 * Real API: POST /routes/plan → start POI, stops, end POI, route line and legs.
 * Returns the plan and the places in it (the roadmap is built from these).
 */
export async function planTrip(
  prefs: TripPreferences,
  landmarks: Landmark[],
): Promise<{ plan: TripPlan; landmarks: Landmark[] }> {
  // Planned on the phone with the sample places (no API, or the API failed).
  // A start far away from the Old Town is moved to the Main Square, like the planner does.
  const planLocally = () => {
    const places = landmarks.length ? landmarks : mockLandmarks();
    const far = !!prefs.startLocation && distanceMeters(prefs.startLocation, MAP_ORIGIN) > TOO_FAR_METERS;
    const plan = planTripLocally(places, far ? { ...prefs, startLocation: undefined } : prefs);
    return { plan: { ...plan, startedAtMarket: far || undefined }, landmarks: places };
  };
  if (USE_MOCK_API) {
    await wait(MOCK_DELAY_MS);
    return planLocally();
  }
  try {
    const result = await planTripOnServer(prefs);
    if (result.plan.stopIds.length) return result;
    fellBack('route plan (no stops)');
  } catch (e) {
    // "You are too far": plan from the Main Square and tell the visitor why.
    if (prefs.startLocation && isTooFarError(e)) {
      try {
        const result = await planTripOnServer({ ...prefs, startLocation: undefined });
        if (result.plan.stopIds.length) return { ...result, plan: { ...result.plan, startedAtMarket: true } };
      } catch (e2) {
        fellBack('route plan from the Main Square', e2);
      }
      return planLocally();
    }
    fellBack('route plan', e);
  }
  return planLocally();
}

/** Further than this from the Main Square, "start from my location" starts at the Main Square. */
const TOO_FAR_METERS = 5_000;

/** The planner says the start is too far away (code names vary between backend versions). */
function isTooFarError(e: unknown): boolean {
  if (!(e instanceof RouteFinderError)) return false;
  return /too_far|far_from|out_of_area|outside/i.test(e.code) || /too far|za daleko|zbyt daleko/i.test(e.message);
}

async function planTripOnServer(prefs: TripPreferences): Promise<{ plan: TripPlan; landmarks: Landmark[] }> {
  // Only fields from the contract (anything else → 422).
  // Wheelchair / no-stairs are not supported by the planner yet, so they are not sent.
  const caps = await getCapabilities();
  const minutes = Math.min(caps.maxMinutes, Math.max(caps.minMinutes, prefs.durationMinutes));
  const body: RfPlanRequest = {
    duration_minutes: minutes,
    // more time → more places: ~1 per 30 min, at least 3 in total (start + 1 + end)
    max_intermediate_stops: Math.min(caps.maxIntermediateStops, Math.max(1, Math.round(minutes / MINUTES_PER_STOP))),
    tolerance_percent: TOLERANCE_PERCENT,
  };
  if (prefs.startLocation) {
    body.start_mode = 'user';
    body.user_location = { latitude: prefs.startLocation.latitude, longitude: prefs.startLocation.longitude };
  }
  const res = await request<RfPlanResponse>(
    ENDPOINTS.planTrip,
    { method: 'POST', body: JSON.stringify(body) },
    PLAN_TIMEOUT_MS,
  );
  return planResponseToTrip(res, apiLang);
}

let capabilities: typeof FALLBACK_CAPABILITIES | null = null;

/** The planner's limits (asked once). Older backends without /capabilities get safe defaults. */
async function getCapabilities() {
  if (capabilities) return capabilities;
  try {
    const c = await request<{ max_intermediate_stops?: number; duration_minutes?: { min?: number; max?: number } }>(
      ENDPOINTS.capabilities,
      undefined,
      6_000,
    );
    capabilities = {
      maxIntermediateStops: c.max_intermediate_stops ?? FALLBACK_CAPABILITIES.maxIntermediateStops,
      minMinutes: c.duration_minutes?.min ?? FALLBACK_CAPABILITIES.minMinutes,
      maxMinutes: c.duration_minutes?.max ?? FALLBACK_CAPABILITIES.maxMinutes,
    };
  } catch (e) {
    if (e instanceof RouteFinderError && e.status === 404) capabilities = FALLBACK_CAPABILITIES; // old backend
    else return FALLBACK_CAPABILITIES; // network trouble: try again next time
  }
  return capabilities;
}

/** Ask the AI guide a question about a place (falls back to sample answers). */
export async function askAboutLandmark(
  landmark: Landmark,
  question: string,
  history: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  // The AI service (EXPO_PUBLIC_AI_GUIDE_URL) first; a sample answer if it fails.
  if (AI_GUIDE_URL) {
    try {
      const answer = await askGuide(buildQuestion(landmark.name, question, history), signal);
      if (answer?.trim()) return answer;
    } catch (e) {
      if (signal?.aborted) throw e; // the chat was closed
      fellBack('AI guide', e);
    }
  } else if (!USE_MOCK_API && ENDPOINTS.ask) {
    try {
      const res = await request<{ answer: string }>(ENDPOINTS.ask(landmark.id), {
        method: 'POST',
        body: JSON.stringify({ question, history: history.map(({ role, text }) => ({ role, text })) }),
      });
      return res.answer;
    } catch (e) {
      fellBack('AI answer', e);
    }
  }
  await wait(MOCK_DELAY_MS * 2);
  return mockAnswer(landmark, question, apiLang);
}

/**
 * Walking route from the visitor's position to a stop, used on the 3D map
 * when the visitor is not on the planned route line (e.g. walking to the start).
 * Uses free OpenStreetMap foot routing; a straight line if that is unreachable.
 */
export async function fetchWalkingRoute(from: LatLng, to: LatLng, needs: AccessibilityNeeds): Promise<WalkingRoute> {
  const slow = needs.wheelchair || needs.reducedMobility;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const url =
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`routing ${res.status}`);
    const json = (await res.json()) as {
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = json.routes?.[0];
    if (!r) throw new Error('no route');
    const path = r.geometry.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
    const speed = slow ? 50 : 75; // m/min
    return {
      path: [from, ...path, to],
      distanceMeters: r.distance,
      durationMinutes: Math.max(1, Math.round(r.distance / speed)),
      source: 'osm',
    };
  } catch {
    const minutes = walkMinutes(from, to, slow);
    const meters = (minutes * (slow ? 50 : 75)) / 1.3;
    return { path: [from, to], distanceMeters: meters, durationMinutes: minutes, source: 'straight' };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Accessibility reports ──────────────────────────────────

/** Answers kept on the phone when no reports endpoint is available. */
export const localReports: AccessibilityReport[] = [];

/** Send a yes/no accessibility answer about the route section just walked. */
export async function submitAccessibilityReport(report: AccessibilityReport): Promise<void> {
  if (!USE_MOCK_API && ENDPOINTS.reports) {
    try {
      await request<unknown>(ENDPOINTS.reports, { method: 'POST', body: JSON.stringify(report) });
      return;
    } catch (e) {
      if (__DEV__) console.log('[reports] endpoint failed, keeping report locally', e);
    }
  }
  await wait(150);
  localReports.push(report);
}
