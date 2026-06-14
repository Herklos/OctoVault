/**
 * Async key/value persistence — native (AsyncStorage). Mirrors `kv.ts`. Holds
 * account-scoped state (joined-space member caps, per-space nav preferences). The
 * recovery seed uses Keychain via `storage.native.ts`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function kvGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export async function kvRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
