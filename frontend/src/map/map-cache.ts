/**
 * Saves the parsed 3D map data on the phone, so after the first launch the
 * map opens instantly without downloading anything.
 * Bump CACHE_VERSION when the data format or the map area changes.
 */
import { File, Paths } from 'expo-file-system';
import { InteractionManager, Platform } from 'react-native';

import type { MapData } from './osm';

const CACHE_VERSION = 'v4';
/** Re-download after this many days so new buildings/edits show up. */
const MAX_AGE_DAYS = 30;

function cacheFile() {
  return new File(Paths.document, `krakow-map-${CACHE_VERSION}.json`);
}

export async function readMapCache(): Promise<MapData | null> {
  if (Platform.OS === 'web') return null;
  try {
    const file = cacheFile();
    if (!file.exists) return null;
    const saved = JSON.parse(await file.text()) as { savedAt: number; data: MapData };
    if (Date.now() - saved.savedAt > MAX_AGE_DAYS * 86_400_000) return null;
    return saved.data?.buildings?.length ? saved.data : null;
  } catch {
    return null;
  }
}

export function writeMapCache(data: MapData) {
  if (Platform.OS === 'web') return;
  // Save after animations/touches are done, so the app doesn't stutter.
  InteractionManager.runAfterInteractions(() => saveNow(data));
}

function saveNow(data: MapData) {
  try {
    // (coordinates are already rounded to 10 cm when parsed)
    const json = JSON.stringify({ savedAt: Date.now(), data });
    const file = cacheFile();
    if (file.exists) file.delete();
    file.create();
    file.write(json);
    // Remove the files of older versions.
    for (const old of ['v1', 'v2', 'v3']) {
      const f = new File(Paths.document, `krakow-map-${old}.json`);
      if (f.exists) f.delete();
    }
  } catch (e) {
    console.warn('[map] could not save map cache', e);
  }
}
