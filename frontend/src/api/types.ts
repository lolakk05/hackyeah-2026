/**
 * Shared data types for the sightseeing app.
 *
 * These describe the shape the UI expects. If your backend returns something
 * different, convert it in `src/api/client.ts` (see the `toLandmark` mapper)
 * so the components never have to change.
 */

/** Which procedural 3D mini-model to draw for a landmark (see src/components/models/builders.ts). */
export type ModelKind =
  | 'barbican'
  | 'basilica'
  | 'clothhall'
  | 'tower'
  | 'castle'
  | 'dragon'
  | 'synagogue'
  | 'bridge'
  | 'generic';

export type WheelchairAccess = 'full' | 'partial' | 'none';

export interface AccessibilityInfo {
  /** Can a wheelchair user visit the place? */
  wheelchair: WheelchairAccess;
  /** Is there a route without any stairs? */
  stepFree: boolean;
  /** Is there an accessible toilet on site or very close? */
  accessibleToilet: boolean;
  /** Audio guide / audio description available (useful for blind & low-vision visitors). */
  audioGuide: boolean;
  /** Induction loop, sign-language or written guide (useful for deaf & hard-of-hearing visitors). */
  hearingSupport: boolean;
  /** Free-text notes from the API, shown on the place page. */
  notes: string;
}

export interface LandmarkFact {
  /** Emoji shown next to the fact, e.g. "🕘". */
  icon: string;
  label: string;
  value: string;
}

export interface Landmark {
  id: string;
  name: string;
  /** One short line used on the roadmap and in headers. */
  tagline: string;
  /** Long text shown on the place page. */
  description: string;
  /** Photo URLs. */
  photos: string[];
  /** How long a typical visit takes, in minutes. */
  visitMinutes: number;
  /** Walking time from the previous stop on the default route, in minutes. */
  walkMinutesFromPrevious: number;
  coordinates: { latitude: number; longitude: number };
  accessibility: AccessibilityInfo;
  facts: LandmarkFact[];
  /** 3D mini-model to render. */
  model: ModelKind;
  /** Accent colour for this stop (node background, page header). */
  color: string;
  /** Questions suggested in the "Ask AI" section. */
  suggestedQuestions: string[];
}

/** Accessibility needs the visitor selects on the setup screen. */
export interface AccessibilityNeeds {
  wheelchair: boolean;
  reducedMobility: boolean;
  lowVision: boolean;
  hearing: boolean;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface TripPreferences {
  /** Trip length in minutes (30 – 360). */
  durationMinutes: number;
  needs: AccessibilityNeeds;
  /** Where the visitor is now (if known), so the route can start nearby. */
  startLocation?: LatLng;
}

/** A walking route between two points, for navigation on the 3D map. */
export interface WalkingRoute {
  path: LatLng[];
  distanceMeters: number;
  durationMinutes: number;
  /** Where the route came from: your API, OpenStreetMap routing, or a straight-line guess. */
  source: 'api' | 'osm' | 'straight';
}

export interface TripPlan {
  /** Ordered landmark ids to visit. */
  stopIds: string[];
  /** Estimated total time (visits + walking), in minutes. */
  totalMinutes: number;
  /** Landmarks skipped because of accessibility needs. */
  skippedForAccessibility: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}
