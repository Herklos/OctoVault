/**
 * Async key/value persistence — web (localStorage). Native uses `kv.native.ts`
 * (AsyncStorage). Holds account-scoped state: joined-space member caps and
 * per-space nav preferences. The recovery seed lives in `storage*.ts`
 * (Keychain/secure-store), never here.
 */
function ls(): Storage | undefined {
  return (globalThis as { localStorage?: Storage }).localStorage;
}

export async function kvGet(key: string): Promise<string | null> {
  try {
    return ls()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  // Do NOT swallow write failures — localStorage.setItem throws QuotaExceededError
  // when storage is full. Let it propagate so callers (attachment persist, member
  // caps) know the write was dropped rather than silently losing data.
  ls()?.setItem(key, value);
}

export async function kvRemove(key: string): Promise<void> {
  try {
    ls()?.removeItem(key);
  } catch {
    /* ignore */
  }
}
