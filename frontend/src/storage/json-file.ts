/**
 * Small JSON files in the app's private documents folder
 * (sign-in session, XP waiting to be sent, the sample backend's data).
 * TODO: for production, keep the token in the keychain (expo-secure-store).
 */
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Web has no app documents folder: use the browser's localStorage (survives a
 * page reload), or memory when the browser blocks it (private mode).
 */
const memory = new Map<string, string>();
const PREFIX = 'spacerio:';
const webStore = {
  get(name: string): string | null {
    try {
      const v = globalThis.localStorage?.getItem(PREFIX + name);
      if (v != null) return v;
    } catch {
      // blocked: memory only
    }
    return memory.get(name) ?? null;
  },
  set(name: string, text: string) {
    memory.set(name, text);
    try {
      globalThis.localStorage?.setItem(PREFIX + name, text);
    } catch {
      // full or blocked: memory only
    }
  },
  remove(name: string) {
    memory.delete(name);
    try {
      globalThis.localStorage?.removeItem(PREFIX + name);
    } catch {
      // nothing to remove
    }
  },
};

export async function readJson<T>(name: string): Promise<T | null> {
  try {
    if (Platform.OS === 'web') {
      const text = webStore.get(name);
      return text ? (JSON.parse(text) as T) : null;
    }
    const file = new File(Paths.document, name);
    if (!file.exists) return null;
    return JSON.parse(await file.text()) as T;
  } catch {
    return null;
  }
}

export function writeJson(name: string, data: unknown) {
  const text = JSON.stringify(data);
  try {
    if (Platform.OS === 'web') {
      webStore.set(name, text);
      return;
    }
    const file = new File(Paths.document, name);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
  } catch (e) {
    console.warn(`[storage] could not save ${name}`, e);
  }
}

export function removeJson(name: string) {
  try {
    if (Platform.OS === 'web') {
      webStore.remove(name);
      return;
    }
    const file = new File(Paths.document, name);
    if (file.exists) file.delete();
  } catch {
    // nothing to remove
  }
}
