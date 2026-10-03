/**
 * ─────────────────────────────────────────────────────────────
 *  API CONFIG: change these to connect to your backend
 * ─────────────────────────────────────────────────────────────
 *
 * Set the Route Finder address in a `.env` file in `frontend/`:
 *   EXPO_PUBLIC_API_URL=http://192.168.0.12:8000
 * (on a real phone use your computer's LAN IP, not "localhost" or 127.0.0.1,
 * and start the backend so it listens on all interfaces: --host 0.0.0.0).
 * Without it, the app uses the sample data in mock-data.ts.
 */

// Trailing "/" or a pasted "/routes/plan" are removed, so only the base address is used.
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/routes\/plan$/, '');

export const USE_MOCK_API = !process.env.EXPO_PUBLIC_API_URL;

/** Fake network delay for mock calls, so loading states are visible. */
export const MOCK_DELAY_MS = 400;

/** Route Finder planning options (see FRONTEND_INTEGRATION.md). */
export const MAX_INTERMEDIATE_STOPS: 0 | 1 | 2 = 2;
export const TOLERANCE_PERCENT = 15;
/** The backend may work up to 40 s; allow for network overhead. */
export const PLAN_TIMEOUT_MS = 50_000;

/** Chance (0–1) of asking a yes/no accessibility question after reaching a stop. */
export const REPORT_QUESTION_CHANCE = 0.6;

/** Set to false to show emoji instead of 3D models (e.g. on a very slow device). */
export const ENABLE_3D_MODELS = true;

/**
 * Optional: URL of your backend serving the 3D map's building data
 * (Overpass JSON format). Leave undefined to download it from OpenStreetMap.
 */
export const MAP_DATA_URL: string | undefined = undefined;

export const ENDPOINTS = {
  /** Route Finder: POST { duration_minutes, start_location?, max_intermediate_stops?, tolerance_percent? } */
  planTrip: '/routes/plan',
  /** Route Finder: GET one place */
  poi: (id: string) => `/pois/${encodeURIComponent(id)}`,
  /**
   * Not part of Route Finder yet. Set these when your other services exist;
   * leave `undefined` and the app uses its local fallback.
   */
  ask: undefined as ((id: string) => string) | undefined, // POST { question, history } → { answer }
  reports: undefined as string | undefined, // POST AccessibilityReport
};

// ─── Accounts: login, XP, coins, ranking, rewards ───────────

/**
 * Account backend address: EXPO_PUBLIC_ACCOUNT_API_URL in `.env`.
 * It can be the same server as the route planner. Without it, accounts,
 * XP, ranking and rewards are simulated on the phone (sample backend).
 */
const accountUrl = process.env.EXPO_PUBLIC_ACCOUNT_API_URL?.trim().replace(/\/+$/, '');
export const ACCOUNT_API_URL = accountUrl || '';
export const USE_MOCK_ACCOUNTS = !accountUrl;

/** Account endpoints (see src/api/README.md for the request/response shapes). */
export const ACCOUNT_ENDPOINTS = {
  register: '/auth/register', // POST { username, email, password } → AuthSession
  login: '/auth/login', // POST { email, password } → AuthSession
  me: '/users/me', // GET → AccountUser
  xpEvents: '/users/me/xp-events', // POST XpEvent → XpEventResult
  redemptions: '/users/me/redemptions', // GET → Redemption[]
  ranking: '/ranking', // GET ?limit=50 → Ranking
  rewards: '/rewards', // GET → Reward[]
  redeem: (rewardId: string) => `/rewards/${encodeURIComponent(rewardId)}/redeem`, // POST → { redemption, coins }
};
