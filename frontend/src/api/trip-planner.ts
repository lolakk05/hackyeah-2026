import type { AccessibilityNeeds, LatLng, Landmark, TripPlan, TripPreferences } from './types';

/** Does this landmark work for the visitor's accessibility needs? */
export function isAccessibleFor(landmark: Landmark, needs: AccessibilityNeeds): boolean {
  const a = landmark.accessibility;
  if (needs.wheelchair && a.wheelchair === 'none') return false;
  if (needs.reducedMobility && !a.stepFree && a.wheelchair !== 'full') return false;
  // Low vision / hearing don't exclude places; the place page shows the
  // relevant support (audio guide, hearing loop) instead.
  return true;
}

/** Straight-line distance in metres. */
function meters(a: LatLng, b: LatLng): number {
  const dLat = (b.latitude - a.latitude) * 110_574;
  const dLon = (b.longitude - a.longitude) * 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLon);
}

/** Estimated walking minutes between two points (streets are ~30 % longer than a straight line). */
export function walkMinutes(a: LatLng, b: LatLng, slow: boolean): number {
  const speed = slow ? 50 : 75; // metres per minute
  return Math.max(1, Math.round((meters(a, b) * 1.3) / speed));
}

/**
 * Simple local planner, used by the mock API and as a fallback.
 * Keeps accessible landmarks, then builds the route greedily: always walk to
 * the nearest unvisited place next, while it still fits in the trip length.
 */
export function planTripLocally(landmarks: Landmark[], prefs: TripPreferences): TripPlan {
  const slow = prefs.needs.wheelchair || prefs.needs.reducedMobility;
  const skippedForAccessibility = landmarks.filter((l) => !isAccessibleFor(l, prefs.needs)).map((l) => l.id);
  const candidates = landmarks.filter((l) => isAccessibleFor(l, prefs.needs));

  const stopIds: string[] = [];
  let total = 0;
  let here: LatLng | null = prefs.startLocation ?? null;

  while (candidates.length) {
    // nearest next stop (the first one is the landmark closest to the start, or the first in the list)
    let bestIndex = 0;
    if (here) {
      let best = Infinity;
      candidates.forEach((c, i) => {
        const d = meters(here!, c.coordinates);
        if (d < best) {
          best = d;
          bestIndex = i;
        }
      });
    }
    const next = candidates[bestIndex];
    const walk = here ? walkMinutes(here, next.coordinates, slow) : 0;
    const cost = walk + next.visitMinutes;
    if (total + cost > prefs.durationMinutes && stopIds.length > 0) break;
    stopIds.push(next.id);
    total += cost;
    here = next.coordinates;
    candidates.splice(bestIndex, 1);
  }

  return { stopIds, totalMinutes: total, skippedForAccessibility };
}
