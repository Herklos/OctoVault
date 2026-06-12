/**
 * OctoVault SDK — KV store dependency-injection seam.
 *
 * The SDK never imports a platform KV adapter directly. At boot, the app calls
 * {@link configureKv} with the real adapter (localStorage on web, AsyncStorage
 * on native); all SDK modules that need key-value persistence import the three
 * functions below instead of importing `./starfish/kv` directly.
 *
 * Mirror of OctoChat's `configureKv` / `kvGet` DI pattern.
 */

interface KvAdapter {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
}

let _kv: KvAdapter = {
  async get() { return null; },
  async set() { /* no-op until configured */ },
  async remove() { /* no-op until configured */ },
};

/**
 * Configure the KV store. Call at app boot before any SDK function that reads
 * or writes persisted state (member caps, mutes, reads, AI settings, etc.).
 */
export function configureKv(adapter: KvAdapter): void {
  _kv = adapter;
}

export async function kvGet(key: string): Promise<string | null> {
  return _kv.get(key);
}

export async function kvSet(key: string, value: string): Promise<void> {
  return _kv.set(key, value);
}

export async function kvRemove(key: string): Promise<void> {
  return _kv.remove(key);
}
