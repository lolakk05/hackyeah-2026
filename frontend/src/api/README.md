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
