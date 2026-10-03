/**
 * ─────────────────────────────────────────────────────────────
 *  API CONFIG: change these to connect to your backend
 * ─────────────────────────────────────────────────────────────
 *
 * USE_MOCK_API = true  → the app uses the prop data in mock-data.ts / mock-ai.ts
 * USE_MOCK_API = false → the app calls API_BASE_URL with the endpoints below
 *
 * Tip: you can also set EXPO_PUBLIC_API_URL in a `.env` file instead of
 * editing this file, e.g.  EXPO_PUBLIC_API_URL=http://192.168.0.12:8000
 * (on a real phone use your computer's LAN IP, not "localhost").
 */

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export const USE_MOCK_API = !process.env.EXPO_PUBLIC_API_URL;

/** Fake network delay for mock calls, so loading states are visible. */
export const MOCK_DELAY_MS = 400;

/** Chance (0–1) of asking a yes/no accessibility question after reaching a stop. */
export const REPORT_QUESTION_CHANCE = 0.5;

/** Set to false to show emoji instead of 3D models (e.g. on a very slow device). */
export const ENABLE_3D_MODELS = true;

/**
 * Optional: URL of your backend serving the 3D map's building data
 * (Overpass JSON format). Leave undefined to download it from OpenStreetMap.
 */
export const MAP_DATA_URL: string | undefined = undefined;

export const ENDPOINTS = {
  /** GET → Landmark[] (or your own shape, mapped in client.ts) */
  landmarks: '/landmarks',
  /** GET → Landmark */
  landmark: (id: string) => `/landmarks/${encodeURIComponent(id)}`,
  /** POST { durationMinutes, needs } → TripPlan */
  planTrip: '/trips/plan',
  /** POST { question, history } → { answer: string } */
  ask: (id: string) => `/landmarks/${encodeURIComponent(id)}/ask`,
  /** POST { from, to, needs } → { path: LatLng[], distanceMeters, durationMinutes } */
  route: '/route',
  /** POST { landmarkId, reason: 'visit' | 'report' } → { awarded, total } */
  points: '/points',
  /** POST AccessibilityReport (see types.ts) */
  reports: '/reports',
} as const;
