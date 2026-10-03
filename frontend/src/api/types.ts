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

/** 'unknown' when the data source has no wheelchair information. */
export type WheelchairAccess = 'full' | 'partial' | 'none' | 'unknown';

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

/** One walk between two stops of a planned route. */
export interface RouteLeg {
  fromId: string;
  toId: string;
  distanceMeters: number;
  durationMinutes: number;
  /** Walking path of this leg (part of the route line). */
  path: LatLng[];
}

/** The walking route returned by the route planner (Route Finder backend). */
export interface PlannedRoute {
  /** Whole route line, start → end. */
  path: LatLng[];
  legs: RouteLeg[];
  distanceMeters: number;
  /** Walking time only (no sightseeing). */
  walkMinutes: number;
  requestedMinutes: number;
  /** false = shorter than asked; still a valid route. */
  matchesTarget: boolean;
  warnings: string[];
  attribution?: string;
}

export interface TripPlan {
  /** Ordered landmark ids to visit. */
  stopIds: string[];
  /** Estimated total time (visits + walking), in minutes. */
  totalMinutes: number;
  /** Landmarks skipped because of accessibility needs. */
  skippedForAccessibility: string[];
  /** Route line + legs, when the plan comes from the route planner backend. */
  route?: PlannedRoute;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

/** Kinds of yes/no accessibility questions asked after reaching a stop. */
export type ReportCategory = 'wheelchair' | 'stepFree' | 'smoothSurface' | 'lowVision';

/**
 * A visitor's yes/no answer about the walk they just made between two stops.
 * The backend collects these per route section; when enough people say a
 * section is NOT accessible for a need, routes for that need avoid it.
 */
export interface AccessibilityReport {
  category: ReportCategory;
  /** true = "yes, it was accessible" */
  accessible: boolean;
  /** The route section the answer is about. */
  segment: {
    fromStopId: string | null;
    toStopId: string;
    /** Walked path (from the routing service), so the backend can match it to streets. */
    path: LatLng[];
  };
  needs: AccessibilityNeeds;
  /** ISO time of the answer. */
  createdAt: string;
}


// ─── Account, XP, ranking and rewards ───────────────────────

/** The signed-in user (from the account backend). */
export interface AccountUser {
  id: string;
  username: string;
  email: string;
  /** Total experience points. */
  xp: number;
  /** Virtual coins (0.5 per XP, minus coins spent on rewards). May end in .5. */
  coins: number;
}

export interface AuthSession {
  /** Bearer token sent as `Authorization: Bearer <token>`. */
  token: string;
  user: AccountUser;
}

export type XpEventType = 'visit' | 'report' | 'route_complete';

/**
 * Something the visitor did that earns XP. The backend calculates the points
 * (see game/progression.ts) and ignores an `id` it has already seen, so
 * events can be safely re-sent after a network error.
 */
export interface XpEvent {
  /** Unique per event, made on the phone. */
  id: string;
  type: XpEventType;
  /** Landmark reached / the stop the accessibility answer is about. */
  landmarkId?: string;
  /** visit: metres walked to the landmark · route_complete: length of the route. */
  distanceMeters?: number;
  /** route_complete: number of stops. */
  stops?: number;
  /** report: which question was answered. */
  category?: ReportCategory;
  /** ISO time. */
  createdAt: string;
}

export interface XpEventResult {
  /** XP added by this event. */
  awarded: number;
  /** Coins added by this event. */
  coinsAwarded: number;
  /** New totals. */
  xp: number;
  coins: number;
}

export interface RankingEntry {
  rank: number;
  userId: string;
  username: string;
  xp: number;
}

export interface Ranking {
  entries: RankingEntry[];
  /** The signed-in user's place (also when outside `entries`). */
  me?: RankingEntry;
}

/** Something coins can be spent on, e.g. a public transport discount. */
export interface Reward {
  id: string;
  title: string;
  description: string;
  /** Price in coins. */
  cost: number;
  icon?: string;
}

/** A reward the user bought: the discount code to use. */
export interface Redemption {
  id: string;
  rewardId: string;
  title: string;
  code: string;
  createdAt: string;
  /** ISO time after which the code stops working. */
  expiresAt?: string;
}
