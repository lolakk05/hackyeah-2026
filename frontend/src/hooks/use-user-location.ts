import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { LatLng } from '@/api/types';
import { isInMapArea } from '@/map/geo';

export interface UserLocation {
  position: LatLng | null;
  /**
   * gps       → real position from the phone
   * simulated → you're not in Kraków (or location is off), so we pretend you
   *             stand at `fallback` (e.g. the previous stop) for the demo
   */
  source: 'gps' | 'simulated';
  /** Compass heading of the phone, if available (degrees). */
  heading: number | null;
  permissionDenied: boolean;
}

/** Live GPS position, with a demo fallback when the visitor isn't in Kraków. */
export function useUserLocation(fallback: LatLng | null): UserLocation {
  const [gps, setGps] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const subs: { remove: () => void }[] = [];
    // A watcher that starts after the screen closed must be stopped at once
    // (otherwise GPS keeps running in the background).
    const keep = (sub: { remove: () => void }) => {
      if (cancelled) sub.remove();
      else subs.push(sub);
    };
    let lastHeading = -999;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setPermissionDenied(true);
          return;
        }
        keep(
          await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
            (loc) => setGps({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }),
          ),
        );
        try {
          keep(
            await Location.watchHeadingAsync((h) => {
              const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
              // The compass reports many times a second: only re-render for a real turn.
              const diff = Math.abs(((value - lastHeading + 540) % 360) - 180);
              if (diff < 4) return;
              lastHeading = value;
              setHeading(value);
            }),
          );
        } catch {
          // compass not available (web, simulators)
        }
      } catch {
        if (!cancelled) setPermissionDenied(true);
      }
    })();
    return () => {
      cancelled = true;
      subs.forEach((s) => s.remove());
    };
  }, []);

  const inKrakow = gps && isInMapArea(gps);
  return {
    position: inKrakow ? gps : fallback,
    source: inKrakow ? 'gps' : 'simulated',
    heading,
    permissionDenied,
  };
}
