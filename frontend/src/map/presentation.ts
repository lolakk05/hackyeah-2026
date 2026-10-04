import * as THREE from 'three';

import { MAP_EXTENT, MAP_ORIGIN, toLocal, type LatLng } from './geo';
import type { P } from './osm';

/** One camera pose at a moment of the show. */
export interface ShowKey {
  /** Seconds from the start. */
  t: number;
  target: P;
  /** Metres from the camera to the target. */
  distance: number;
  /** Radians, unwrapped (may grow past 2π for spins). */
  azimuth: number;
  /** Radians above the ground. */
  tilt: number;
}

/** Length of the presentation (seconds). */
export const PRESENTATION_SECONDS = 40;

const deg = THREE.MathUtils.degToRad;

const WAWEL = toLocal({ latitude: 50.054, longitude: 19.9354 });
const BARBICAN = toLocal({ latitude: 50.0655, longitude: 19.9418 });
const KAZIMIERZ = toLocal({ latitude: 50.0515, longitude: 19.9487 });
const MAIN_SQUARE = toLocal(MAP_ORIGIN);

/** Azimuth that makes the camera look from `a` towards `b`, closest to `near`. */
function facing(a: P, b: P, near: number): number {
  const az = Math.atan2(-(b.x - a.x), -(b.z - a.z));
  return near + Math.atan2(Math.sin(az - near), Math.cos(az - near));
}

/**
 * A 40-second camera show over Kraków: a dive from above onto the Main Square,
 * an orbit, a street-level swoop, a flight along the route stops, a big
 * zoom-out with a spin, a low pass around Wawel and a final pull-up.
 * @param route stop coordinates in route order (the flight follows them)
 * @param startAzimuth current camera azimuth, so the show starts smoothly
 */
export function buildPresentation(route: LatLng[], startAzimuth: number): ShowKey[] {
  const keys: ShowKey[] = [];
  let az = startAzimuth;
  const add = (t: number, target: P, distance: number, azimuth: number, tiltDeg: number) => {
    az = azimuth;
    keys.push({ t, target: { ...target }, distance, azimuth, tilt: deg(tiltDeg) });
  };

  // 1 · Overview from high above, then dive onto the Main Square while turning.
  add(0, MAP_EXTENT.center, 2700, az, 78);
  add(3, MAIN_SQUARE, 1300, az + 0.6, 60);
  add(6, MAIN_SQUARE, 520, az + 1.4, 42);
  // 2 · Orbit the square and drop to street level.
  add(9, MAIN_SQUARE, 360, az + 1.3, 32);
  add(12, MAIN_SQUARE, 150, az + 1.1, 20);

  // 3 · Fly along the route, looking where we're going.
  const points = route.map(toLocal).slice(0, 6);
  const path = points.length >= 2 ? points : [BARBICAN, MAIN_SQUARE, WAWEL];
  const t0 = 14.5;
  const t1 = 23.5;
  path.forEach((p, i) => {
    const next = path[Math.min(i + 1, path.length - 1)];
    const prev = path[Math.max(i - 1, 0)];
    const look = i < path.length - 1 ? facing(p, next, az) : facing(prev, p, az);
    const t = path.length === 1 ? t0 : t0 + ((t1 - t0) * i) / (path.length - 1);
    add(t, p, i === 0 ? 230 : 260, look, i === 0 ? 24 : 30);
  });

  // 4 · Big zoom-out with a spin over the whole city.
  add(27, MAP_EXTENT.center, 2500, az + 1.6, 62);
  // 5 · Swoop down to Wawel and circle it low, with the river behind.
  add(30.5, WAWEL, 700, az + 1.2, 44);
  add(33, WAWEL, 240, az + 1.0, 24);
  add(35.5, KAZIMIERZ, 520, az + 0.9, 36);
  // 6 · Final pull-up to the whole Old Town.
  add(38, MAIN_SQUARE, 1500, az + 0.7, 55);
  add(PRESENTATION_SECONDS, MAIN_SQUARE, 1900, az + 0.3, 58);
  return keys;
}

/** Catmull-Rom between b and c (a, d are the neighbours), u in 0..1. */
function cr(a: number, b: number, c: number, d: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (3 * b - a - 3 * c + d) * u3);
}

/** Smooth camera pose at time t (seconds); null once the show is over. */
export function sampleShow(keys: ShowKey[], t: number): Omit<ShowKey, 't'> | null {
  if (keys.length === 0 || t >= keys[keys.length - 1].t) return null;
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
  const k0 = keys[Math.max(i - 1, 0)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(i + 2, keys.length - 1)];
  const span = Math.max(k2.t - k1.t, 1e-3);
  // ease in at the very start so the first move doesn't jerk
  let u = THREE.MathUtils.clamp((t - k1.t) / span, 0, 1);
  if (i === 0) u = u * u * (3 - 2 * u);
  const s = (f: (k: ShowKey) => number) => cr(f(k0), f(k1), f(k2), f(k3), u);
  return {
    target: { x: s((k) => k.target.x), z: s((k) => k.target.z) },
    // zoom in log space so it feels even at every height
    distance: Math.exp(s((k) => Math.log(k.distance))),
    azimuth: s((k) => k.azimuth),
    tilt: THREE.MathUtils.clamp(s((k) => k.tilt), deg(16), deg(85)),
  };
}
