/**
 * Geographic helpers. The 3D map uses a flat local coordinate system in
 * metres centred on the Main Square:
 *   x → east,  z → south (so north is −z),  y → up.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Centre of the Main Square (Rynek Główny). */
export const MAP_ORIGIN: LatLng = { latitude: 50.0617, longitude: 19.9373 };

/** Area loaded for the 3D map: Old Town, Wawel, Kazimierz and the river. */
export const MAP_BOUNDS = { south: 50.0455, west: 19.926, north: 50.0675, east: 19.9525 };

const M_PER_DEG_LAT = 110_574;
const M_PER_DEG_LON = 111_320 * Math.cos((MAP_ORIGIN.latitude * Math.PI) / 180);

export function toLocal(p: LatLng): { x: number; z: number } {
  return {
    x: (p.longitude - MAP_ORIGIN.longitude) * M_PER_DEG_LON,
    z: -(p.latitude - MAP_ORIGIN.latitude) * M_PER_DEG_LAT,
  };
}

export function toLatLng(x: number, z: number): LatLng {
  return {
    latitude: MAP_ORIGIN.latitude - z / M_PER_DEG_LAT,
    longitude: MAP_ORIGIN.longitude + x / M_PER_DEG_LON,
  };
}

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Total length of a polyline in metres. */
export function pathLength(path: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < path.length; i++) d += distanceMeters(path[i - 1], path[i]);
  return d;
}

/** Compass bearing from a to b in degrees (0 = north, 90 = east). */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function compassWord(bearing: number): string {
  const words = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return words[Math.round(bearing / 45) % 8];
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** Is the point inside the loaded map area (with a margin in degrees)? */
export function isInMapArea(p: LatLng, margin = 0.01): boolean {
  return (
    p.latitude > MAP_BOUNDS.south - margin &&
    p.latitude < MAP_BOUNDS.north + margin &&
    p.longitude > MAP_BOUNDS.west - margin &&
    p.longitude < MAP_BOUNDS.east + margin
  );
}
