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
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setPermissionDenied(true);
          return;
        }
        subs.push(
          await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
            (loc) => setGps({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }),
          ),
        );
        try {
          subs.push(await Location.watchHeadingAsync((h) => setHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading)));
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
