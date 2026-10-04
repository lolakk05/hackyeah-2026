/**
 * Small JSON files in the app's private documents folder
 * (sign-in session, XP waiting to be sent, the sample backend's data).
 * TODO: for production, keep the token in the keychain (expo-secure-store).
 */
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/** Web has no app documents folder: keep the data in memory there. */
const memory = new Map<string, string>();

export async function readJson<T>(name: string): Promise<T | null> {
  try {
    if (Platform.OS === 'web') {
      const text = memory.get(name);
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
      memory.set(name, text);
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
      memory.delete(name);
      return;
    }
    const file = new File(Paths.document, name);
    if (file.exists) file.delete();
  } catch {
    // nothing to remove
  }
}
