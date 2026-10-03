# Connecting the backend

The app reads all of its data through **`client.ts`**. No component calls `fetch` directly.

| File | What to change |
| --- | --- |
| `config.ts` | Backend URL, endpoint paths, and the mock on/off switch |
| `client.ts` | The real `fetch` calls (search for `TODO(API)`) and `toLandmark()`, which maps your JSON to the app's types |
| `types.ts` | The data shapes the UI expects |
| `mock-data.ts`, `mock-ai.ts` | Sample data used while mocks are on |

## Switching from mock data to the real API

Create a `.env` file in `frontend/`:

```
EXPO_PUBLIC_API_URL=http://192.168.0.12:8000
```

On a real phone, use your computer's LAN IP address, not `localhost`. Then restart `npx expo start`.
When `EXPO_PUBLIC_API_URL` is set, the mocks turn off automatically.

## Language

Every request gets `?lang=pl` or `?lang=en` and an `Accept-Language` header.
Return landmark texts (name, tagline, description, facts, accessibility notes, suggested questions) and AI answers in that language.

## Endpoints the app expects

### `GET /landmarks` → `Landmark[]` (in route order)

```json
{
  "id": "wawel-castle",
  "name": "Wawel Castle",
  "tagline": "Royal castle on the hill",
  "description": "Long text…",
  "photos": ["https://…jpg"],
  "visitMinutes": 60,
  "walkMinutesFromPrevious": 15,
  "coordinates": { "latitude": 50.054, "longitude": 19.9354 },
  "accessibility": {
    "wheelchair": "full | partial | none",
    "stepFree": true,
    "accessibleToilet": true,
    "audioGuide": true,
    "hearingSupport": false,
    "notes": "Free text"
  },
  "facts": [{ "icon": "🕘", "label": "Opening hours", "value": "9:00 – 17:00" }],
  "model": "castle",
  "color": "#58CC02",
  "suggestedQuestions": ["Who is buried in the cathedral?"]
}
```

`model` can be one of: `barbican`, `basilica`, `clothhall`, `tower`, `castle`, `dragon`, `synagogue`, `bridge`, `generic`.
Any missing field gets a default value in `toLandmark()`, and snake_case names are accepted too.

### `GET /landmarks/:id` → `Landmark`

### `POST /trips/plan`

Request: `{ "durationMinutes": 120, "needs": { "wheelchair": true, "reducedMobility": false, "lowVision": false, "hearing": false } }`

Response: `{ "stopIds": ["barbican", "st-marys"], "totalMinutes": 110, "skippedForAccessibility": ["town-hall-tower"] }`

If your backend has no trip planner, return `planTripLocally(landmarks, prefs)` in `client.ts` instead.

### `POST /landmarks/:id/ask` (AI guide)

Request: `{ "question": "Is it good for kids?", "history": [{ "role": "user", "text": "…" }, { "role": "assistant", "text": "…" }] }`

Response: `{ "answer": "Yes! …" }`

### `POST /route` (walking directions on the 3D map)

Request: `{ "from": LatLng, "to": LatLng, "needs": AccessibilityNeeds }`

Response: `{ "path": LatLng[], "distanceMeters": 420, "durationMinutes": 6 }`

Use the accessibility reports below to avoid street sections that people marked as not accessible for these `needs`.

### `POST /points` (experience points)

Called when a visitor reaches a landmark (`reason: "visit"`) and when they answer an accessibility question (`reason: "report"`).

Request: `{ "landmarkId": "wawel-castle", "reason": "visit" }`

Response: `{ "awarded": 50, "total": 150 }`

Identify the user with an auth header (add it in `request()` in `client.ts`).

### `POST /reports` (accessibility reports)

After arriving at a stop, there is a 50% chance (`REPORT_QUESTION_CHANCE` in `config.ts`) that the visitor gets one yes/no question about the way they just walked:

| category | question |
| --- | --- |
| `wheelchair` | Could a wheelchair get along the way here? |
| `stepFree` | Was the way here free of stairs and steps? |
| `smoothSurface` | Was the pavement smooth (no rough cobblestones)? |
| `lowVision` | Was the way safe for a blind or low-vision person? |

The visitor's own need is asked first. Visitors without needs get a random general question, so everyone contributes.

```json
{
  "category": "wheelchair",
  "accessible": false,
  "segment": {
    "fromStopId": "cloth-hall",
    "toStopId": "wawel-castle",
    "path": [{ "latitude": 50.0617, "longitude": 19.9373 }, { "latitude": 50.054, "longitude": 19.9354 }]
  },
  "needs": { "wheelchair": true, "reducedMobility": false, "lowVision": false, "hearing": false },
  "createdAt": "2026-10-03T13:00:00.000Z"
}
```

Suggested backend logic: snap `path` to street segments (for example OSM way ids), keep a yes/no count per segment and category, and give a segment a high cost in `/route` and `/trips/plan` once enough answers say "no" for a visitor's needs.
