/**
 * Real photos of the landmarks (Wikimedia Commons), from poi-photos.json.
 * Matched to places by name (any language, aliases) near the same spot,
 * or by position alone when the names differ.
 */
import data from './poi-photos.json';

interface PhotoEntry {
  id: string;
  names: string[];
  category: string;
  lat: number;
  lon: number;
  photos: { url: string; credit: string }[];
}

export interface PlacePhotos {
  photos: string[];
  /** Author and licence of each photo (CC licences require showing it). */
  credits: string[];
}

const ENTRIES = data as PhotoEntry[];

/** Lower case, no Polish accents, only letters and digits. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const byName = new Map<string, PhotoEntry[]>();
for (const e of ENTRIES) {
  for (const n of e.names) {
    const k = norm(n);
    if (!k) continue;
    byName.set(k, [...(byName.get(k) ?? []), e]);
  }
}
const byId = new Map(ENTRIES.map((e) => [e.id, e]));

const meters = (lat1: number, lon1: number, lat2: number, lon2: number) =>
  Math.hypot((lat1 - lat2) * 111_000, (lon1 - lon2) * 71_500);

/**
 * Wikimedia's standard image server. The file's links point at
 * thumb.wikimedia.org with tracking parameters; the same path works here.
 */
export function photoUrl(url: string): string {
  return url.replace('://thumb.wikimedia.org/', '://upload.wikimedia.org/').replace(/\?utm_[^#]*$/, '');
}

/** The other Wikimedia host, tried when a photo doesn't load. */
export function alternatePhotoUrl(url: string): string | null {
  if (url.includes('://upload.wikimedia.org/')) return url.replace('://upload.wikimedia.org/', '://thumb.wikimedia.org/');
  return null;
}

const toPlacePhotos = (e: PhotoEntry): PlacePhotos => ({
  photos: e.photos.map((p) => photoUrl(p.url)),
  credits: e.photos.map((p) => p.credit),
});

/**
 * Photos for a place: the same name within 400 m, else the same kind of place
 * within 25 m (a plaque on a church wall must not get the church's photos).
 */
export function findPhotos(
  names: (string | undefined)[],
  at: { latitude: number; longitude: number },
  category?: string,
): PlacePhotos | null {
  let best: { e: PhotoEntry; d: number } | null = null;
  for (const n of names) {
    if (!n) continue;
    for (const e of byName.get(norm(n)) ?? []) {
      const d = meters(e.lat, e.lon, at.latitude, at.longitude);
      if (d < 400 && (!best || d < best.d)) best = { e, d };
    }
  }
  if (!best && category) {
    for (const e of ENTRIES) {
      if (e.category !== category) continue;
      const d = meters(e.lat, e.lon, at.latitude, at.longitude);
      if (d < 25 && (!best || d < best.d)) best = { e, d };
    }
  }
  return best ? toPlacePhotos(best.e) : null;
}

/** Photos by the file's id (used for the built-in places). */
export function photosById(id: string): PlacePhotos | null {
  const e = byId.get(id);
  return e ? toPlacePhotos(e) : null;
}

/** The closest well-known landmarks (from the photo list) to a point, nearest first. */
export function nearbyLandmarks(
  lat: number,
  lon: number,
  excludeName: string,
  count: number,
): { name: string; meters: number }[] {
  const skip = norm(excludeName);
  return ENTRIES.map((e) => ({ name: e.names[0], meters: meters(e.lat, e.lon, lat, lon) }))
    .filter((e) => e.meters > 20 && e.meters < 900 && norm(e.name) !== skip)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, count);
}
