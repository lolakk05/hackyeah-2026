# Connecting the backend

The app reads all of its data through **`client.ts`**. No screen calls `fetch` directly.

| File | What it does |
| --- | --- |
| `config.ts` | Backend address, endpoint paths, planner options |
| `client.ts` | Route planning and places, plus local fallbacks for features the backend doesn't have yet |
| `account.ts` | Sign-in, XP, coins, ranking and rewards |
| `mock-accounts.ts` | Sample account backend kept on the phone, used when no account server is set |
| `route-finder.ts` | Route Finder types, converting its JSON to the app's types, and its error codes |
| `types.ts` | The data shapes the screens use |
| `mock-data.ts`, `mock-data-pl.ts`, `mock-ai.ts` | Sample data used when no backend is set |

## Switching to the Route Finder backend

1. Start the backend so the phone can reach it, for example `uvicorn … --host 0.0.0.0 --port 8000`.
2. In `frontend/.env` (copy it from `.env.example` if it's missing), set:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.0.12:8000
   ```
   Use your computer's LAN IP address (not `127.0.0.1`). The phone and computer must be on the same Wi-Fi.
3. Restart `npx expo start -c`. With the URL set, the sample data turns off.

A release build bakes this address in when you build, so rebuild after you change it.

## What the app uses from Route Finder

### `POST /routes/plan`

Sent from the setup screen:

```json
{ "duration_minutes": 60, "max_intermediate_stops": 2, "tolerance_percent": 15 }
```

- **Start point:** "My location" adds `start_location` (from the phone's GPS). "Main Square" leaves it out.
- **Accessibility:** wheelchair and no-stairs choices are **not sent**, because the planner doesn't support them yet and they would cause a 422. The app warns the user instead.
- **Trip length:** limited to 5–360 minutes (up to 6 hours).

The response is converted by `planResponseToTrip()` in `route-finder.ts`:

| Response | In the app |
| --- | --- |
| `start_poi`, `intermediate_pois`, `end_poi` | Roadmap stops, kept in this exact order |
| POI `tags` (`name:pl` / `name:en`, address, `wheelchair`, `opening_hours`, `heritage`, `wikipedia`…) | Place page: name, description, facts, wheelchair info |
| Known landmarks (Sukiennice, Mariacki, Barbakan, Wawel…) | Their 3D model; other places get a pin |
| `geometry` | Thin route line on the 3D map |
| `legs` + `snapped_waypoints` | Line cut into one walk per stop, and the walking time shown on each roadmap card |
| `duration_s`, `distance_m`, `matches_target`, `warnings`, `attribution` | Route summary on the roadmap, with a "Fix the map" link |

Errors (`detail.code`) are shown as friendly messages on the setup screen:

| Code | Message shown |
| --- | --- |
| `no_start_poi` | Choose the Main Square instead |
| `no_candidate_pois`, `no_route_within_budget` | Try a different trip length |
| `*_busy`, `*_timeout`, `osrm_*` | Busy, try again in `retry_after_s` |
| `422` validation errors | The validation message |
| Network or timeout | Check the server address and Wi-Fi |

The request timeout is 50 s (`PLAN_TIMEOUT_MS` in `config.ts`).

### `GET /pois/{id}`

Refreshes a place's details when its page opens.

## Not in Route Finder yet (local fallbacks)

Set these in `ENDPOINTS` in `config.ts` once your other services exist:

| Endpoint | Fallback until it exists |
| --- | --- |
| `ask: (id) => '/landmarks/' + id + '/ask'`: AI guide, `{ question, history } → { answer }` | Sample answers |
| `reports: '/reports'`: yes/no accessibility answers (`AccessibilityReport` in `types.ts`, includes the walked path) | Kept on the phone |

Walking directions to a stop when the visitor is away from the planned line (for example, walking to the start) come from free OpenStreetMap foot routing.

## Accounts, XP, coins, ranking and rewards

Set the account server in `frontend/.env`. It can be the same server as the route planner:

```
EXPO_PUBLIC_ACCOUNT_API_URL=https://your-server.example
```

Without it, the app uses a sample backend that keeps accounts on the phone (`mock-accounts.ts`). Its discount codes start with `DEMO-` and are not real tickets.

Paths are in `ACCOUNT_ENDPOINTS` in `config.ts`; types are in `types.ts`. After sign-in, every request sends `Authorization: Bearer <token>`.

| Request | Body | Response |
| --- | --- | --- |
| `POST /auth/register` | `{ username, email, password }` | `{ token, user }` |
| `POST /auth/login` | `{ email, password }` | `{ token, user }` |
| `GET /users/me` | | `user` |
| `POST /users/me/xp-events` | `XpEvent` (below) | `{ awarded, coinsAwarded, xp, coins }` |
| `GET /ranking?limit=50` | | `{ entries: [{ rank, userId, username, xp }], me? }` |
| `GET /rewards` | | `[{ id, title, description, cost, icon? }]` (texts in the `Accept-Language` language) |
| `POST /rewards/{id}/redeem` | | `{ redemption: { id, rewardId, title, code, createdAt, expiresAt? }, coins }` |
| `GET /users/me/redemptions` | | `[redemption]` |

`user` is `{ id, username, email, xp, coins }`. `coins` can end in `.5`.

**Errors:** send `{ "detail": { "code": "...", "message": "..." } }`. The app understands these codes:

| Code | When | Status |
| --- | --- | --- |
| `invalid_credentials` | Wrong email or password | 401 |
| `email_taken`, `username_taken` | Register with a used email or name | 409 |
| `not_enough_coins` | Redeem without enough coins | 402 |
| `unauthorized` | Missing or expired token (the app signs out) | 401 |

### XP events

The app sends one event per action. **The backend calculates the points** with the rules below (the same rules are in `src/game/progression.ts`). It must ignore an event `id` it has already counted, because the app re-sends events that failed on a bad connection.

```json
{ "id": "lx3k9a-4f8e2c1b", "type": "visit", "landmarkId": "node/123", "distanceMeters": 620, "createdAt": "2026-10-03T17:40:00Z" }
{ "id": "…", "type": "report", "landmarkId": "node/123", "category": "wheelchair", "createdAt": "…" }
{ "id": "…", "type": "route_complete", "distanceMeters": 2400, "stops": 4, "createdAt": "…" }
```

| Type | XP |
| --- | --- |
| `report` (accessibility answer) | 50 |
| `visit` (reached a landmark) | 5 + 1 per 100 m walked to it |
| `route_complete` (last stop reached) | 20 + 10 per km of the route |

- **Coins:** 0.5 per XP, rounded to 0.1. Redeeming takes away the reward's `cost`.
- **Level:** worked out on the phone from XP. Level 2 is at 100 XP, and each next level needs 50 XP more than the one before: 100, 250, 450, 700, 1000…
- **No connection:** the app counts the XP on the phone straight away and sends the event later. Events waiting to be sent are kept in the phone's files, so they survive a restart.
