/**
 * Single dispatch point for live-sync events from the global SSE connection.
 *
 * When an event arrives, the unread/notification layer calls dispatchDocChange(docId):
 *   - if a hook has registered a pull for that docId → call it (the user is
 *     actively viewing that doc) and return true — caller skips the unread bump.
 *   - otherwise return false → caller bumps unread.
 *
 * Hooks register/unregister via registerPull. SSE health is broadcast via
 * emitSseStatus so live-sync hooks can gate their fallback polling.
 */

type PullFn = () => void;
type StatusListener = (up: boolean) => void;

const pullRegistry = new Map<string, PullFn>();
const statusListeners = new Set<StatusListener>();
let sseUp = false;

/** Register a pull function for a docId/spaceId. Returns an unsubscribe fn. */
export function registerPull(docId: string, fn: PullFn): () => void {
  pullRegistry.set(docId, fn);
  return () => { if (pullRegistry.get(docId) === fn) pullRegistry.delete(docId); };
}

/**
 * Dispatch a doc-change event. If a pull is registered for docId, calls it
 * (the user is viewing that doc) and returns true. Returns false otherwise.
 */
export function dispatchDocChange(docId: string): boolean {
  const pull = pullRegistry.get(docId);
  if (!pull) return false;
  pull();
  return true;
}

export function emitSseStatus(up: boolean): void {
  sseUp = up;
  for (const l of statusListeners) l(up);
}

/**
 * Forget all registered doc pulls and reset SSE health (on account switch). The
 * old session's doc screens unmount and re-register under the new session;
 * `statusListeners` are React subscriptions that self-unsubscribe on unmount, so
 * they are intentionally left intact.
 */
export function clearLiveSyncBus(): void {
  pullRegistry.clear();
  sseUp = false;
}

/** Subscribe to SSE health changes. Fires immediately with the current state. */
export function onSseStatus(cb: StatusListener): () => void {
  statusListeners.add(cb);
  cb(sseUp);
  return () => statusListeners.delete(cb);
}
