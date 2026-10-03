/**
 * ─────────────────────────────────────────────────────────────
 *  API CLIENT: the only place the app talks to the backend
 * ─────────────────────────────────────────────────────────────
 *
 * Every function has two branches:
 *   1. USE_MOCK_API → returns prop data (mock-data.ts / mock-ai.ts)
 *   2. real API     → fetch() to your backend (look for "TODO(API)")
 *
 * If your backend's JSON looks different from the `Landmark` type,
 * adapt it in `toLandmark()` below; the UI will keep working.
 */
import { API_BASE_URL, ENDPOINTS, MOCK_DELAY_MS, USE_MOCK_API } from './config';
import { mockAnswer } from './mock-ai';
import { MOCK_LANDMARKS } from './mock-data';
import { planTripLocally, walkMinutes } from './trip-planner';
import type {
  AccessibilityNeeds,
  ChatMessage,
  Landmark,
  LatLng,
  TripPlan,
  TripPreferences,
  WalkingRoute,
} from './types';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // TODO(API): add auth here if needed, e.g. Authorization: `Bearer ${token}`
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/**
 * TODO(API): map your backend's landmark JSON to the app's `Landmark` type.
 * Fill in missing fields with sensible defaults so the UI never crashes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toLandmark(raw: any): Landmark {
  return {
    id: String(raw.id),
    name: raw.name ?? 'Unknown place',
    tagline: raw.tagline ?? raw.short_description ?? '',
    description: raw.description ?? raw.text ?? '',
    photos: raw.photos ?? raw.images ?? [],
    visitMinutes: raw.visitMinutes ?? raw.visit_minutes ?? 30,
    walkMinutesFromPrevious: raw.walkMinutesFromPrevious ?? raw.walk_minutes ?? 10,
    coordinates: raw.coordinates ?? { latitude: raw.lat ?? 0, longitude: raw.lng ?? 0 },
    accessibility: {
      wheelchair: raw.accessibility?.wheelchair ?? 'partial',
      stepFree: raw.accessibility?.stepFree ?? raw.accessibility?.step_free ?? false,
      accessibleToilet: raw.accessibility?.accessibleToilet ?? raw.accessibility?.toilet ?? false,
      audioGuide: raw.accessibility?.audioGuide ?? raw.accessibility?.audio_guide ?? false,
      hearingSupport: raw.accessibility?.hearingSupport ?? raw.accessibility?.hearing_support ?? false,
      notes: raw.accessibility?.notes ?? '',
    },
    facts: raw.facts ?? [],
    model: raw.model ?? 'generic',
    color: raw.color ?? '#1CB0F6',
    suggestedQuestions: raw.suggestedQuestions ?? raw.suggested_questions ?? [],
  };
}

/** All landmarks, in route order. */
export async function fetchLandmarks(): Promise<Landmark[]> {
  if (USE_MOCK_API) {
    await wait(MOCK_DELAY_MS);
    return MOCK_LANDMARKS;
  }
  // TODO(API): GET /landmarks
  const raw = await request<unknown[]>(ENDPOINTS.landmarks);
  return raw.map(toLandmark);
}

/** One landmark with all details (text, photos, accessibility, facts). */
export async function fetchLandmark(id: string): Promise<Landmark> {
  if (USE_MOCK_API) {
    await wait(MOCK_DELAY_MS);
    const lm = MOCK_LANDMARKS.find((l) => l.id === id);
    if (!lm) throw new Error(`Landmark "${id}" not found`);
    return lm;
  }
  // TODO(API): GET /landmarks/:id
  return toLandmark(await request<unknown>(ENDPOINTS.landmark(id)));
}

/** Pick stops that fit the trip length and accessibility needs. */
export async function planTrip(prefs: TripPreferences, landmarks: Landmark[]): Promise<TripPlan> {
  if (USE_MOCK_API) {
    await wait(MOCK_DELAY_MS);
    return planTripLocally(landmarks, prefs);
  }
  // TODO(API): POST /trips/plan. If your backend has no planner, just
  // `return planTripLocally(landmarks, prefs)` here instead.
  return request<TripPlan>(ENDPOINTS.planTrip, {
    method: 'POST',
    body: JSON.stringify(prefs),
  });
}

/** Ask the AI guide a question about a landmark. */
export async function askAboutLandmark(
  landmark: Landmark,
  question: string,
  history: ChatMessage[],
): Promise<string> {
  if (USE_MOCK_API) {
    await wait(MOCK_DELAY_MS * 2);
    return mockAnswer(landmark, question);
  }
  // TODO(API): POST /landmarks/:id/ask → { answer }
  const res = await request<{ answer: string }>(ENDPOINTS.ask(landmark.id), {
    method: 'POST',
    body: JSON.stringify({
      question,
      history: history.map(({ role, text }) => ({ role, text })),
    }),
  });
  return res.answer;
}

/**
 * Walking route from the visitor's position to the next stop (for the 3D map).
 *
 * Real API: POST /route { from, to, needs } → { path, distanceMeters, durationMinutes }
 * Mock: free OpenStreetMap foot routing (routing.openstreetmap.de), and a
 * straight line if that is unreachable.
 */
export async function fetchWalkingRoute(from: LatLng, to: LatLng, needs: AccessibilityNeeds): Promise<WalkingRoute> {
  const slow = needs.wheelchair || needs.reducedMobility;

  if (!USE_MOCK_API) {
    // TODO(API): your backend can pick step-free paths for wheelchair users here.
    try {
      const res = await request<Omit<WalkingRoute, 'source'>>(ENDPOINTS.route, {
        method: 'POST',
        body: JSON.stringify({ from, to, needs }),
      });
      return { ...res, source: 'api' };
    } catch (e) {
      console.warn('[route] API failed, falling back to OSM routing', e);
    }
  }

  try {
    const url =
      `https://routing.openstreetmap.de/routed-foot/route/v1/foot/` +
      `${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`routing ${res.status}`);
    const json = (await res.json()) as {
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    const r = json.routes?.[0];
    if (!r) throw new Error('no route');
    const path = r.geometry.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
    const speed = slow ? 50 : 75; // m/min
    return { path: [from, ...path, to], distanceMeters: r.distance, durationMinutes: Math.max(1, Math.round(r.distance / speed)), source: 'osm' };
  } catch {
    const minutes = walkMinutes(from, to, slow);
    const meters = (minutes * (slow ? 50 : 75)) / 1.3;
    return { path: [from, to], distanceMeters: meters, durationMinutes: minutes, source: 'straight' };
  }
}
