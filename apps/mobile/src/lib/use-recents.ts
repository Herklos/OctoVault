/**
 * Device-local MRU of visited pages/boards — what Quick Find / the Search tab
 * show before the user types (Notion's "Recents"). IDs ONLY ({spaceId, objectId,
 * ts}); titles/emoji resolve at render time against the live object index, so a
 * rename or archive reflects instantly and an entry another account can't
 * resolve simply doesn't render. That id-only shape is also why this can live in
 * plain device kv (`starfish/kv`) rather than a synced doc: nothing here is
 * content, and per-device recency is actually the desired semantic (your phone's
 * trail ≠ your desktop's).
 *
 * Module-level snapshot + subscribe (the `quick-reactions-settings.ts` pattern)
 * so the detail routes can record a visit without owning React state, while the
 * palette subscribes via `useSyncExternalStore`. Hydration from kv is lazy and
 * merge-safe: visits recorded before the disk read lands stay in front.
 */
import { useEffect, useSyncExternalStore } from 'react';

import { kvGet, kvSet } from './starfish/kv';

export interface RecentVisit {
  spaceId: string;
  objectId: string;
  /** Alias of {@link objectId} — some consumers address recents by plain `id`. */
  id: string;
  /** Epoch ms of the most recent visit. */
  ts: number;
}

/** Device-scoped (deliberately not per-identity — see module doc). */
const KV_KEY = 'octovault.recents.v1';
/** MRU depth — enough for a "Jump back in" row + the palette's empty state. */
const CAP = 20;

let snapshot: RecentVisit[] = [];
const listeners = new Set<() => void>();

function emit(next: RecentVisit[]): void {
  snapshot = next;
  for (const l of listeners) l();
}

function persist(): void {
  // Strip the render-side alias before writing; rebuild it on read.
  const slim = snapshot.map(({ spaceId, objectId, ts }) => ({ spaceId, objectId, ts }));
  void kvSet(KV_KEY, JSON.stringify(slim));
}

/** Tolerant parse of the persisted list — garbage entries are dropped, not fatal. */
function coerce(raw: unknown): RecentVisit[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentVisit[] = [];
  for (const v of raw) {
    const e = v as { spaceId?: unknown; objectId?: unknown; ts?: unknown };
    if (typeof e?.spaceId === 'string' && typeof e.objectId === 'string' && typeof e.ts === 'number') {
      out.push({ spaceId: e.spaceId, objectId: e.objectId, id: e.objectId, ts: e.ts });
    }
  }
  return out.slice(0, CAP);
}

// Lazy one-shot hydration, kicked by the first subscriber/record. Merge instead
// of replace: a visit recorded during the disk read (the route mounts before the
// kv promise lands) must stay in front of the stale persisted trail.
let hydrate: Promise<void> | null = null;
function ensureHydrated(): void {
  if (hydrate) return;
  hydrate = (async () => {
    try {
      const raw = await kvGet(KV_KEY);
      if (!raw) return;
      const disk = coerce(JSON.parse(raw));
      if (!disk.length) return;
      const seen = new Set(snapshot.map((e) => `${e.spaceId}:${e.objectId}`));
      const merged = [...snapshot, ...disk.filter((e) => !seen.has(`${e.spaceId}:${e.objectId}`))].slice(0, CAP);
      emit(merged);
    } catch {
      /* unreadable cache — start fresh */
    }
  })();
}

/** Record a visit: dedup on (space, object), move to front, cap, persist. */
export function recordVisit(spaceId: string, objectId: string): void {
  if (!spaceId || !objectId) return;
  ensureHydrated();
  const rest = snapshot.filter((e) => !(e.spaceId === spaceId && e.objectId === objectId));
  emit([{ spaceId, objectId, id: objectId, ts: Date.now() }, ...rest].slice(0, CAP));
  persist();
}

function subscribe(listener: () => void): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => snapshot;

/** The live MRU list, newest first. */
export function useRecents(): { recents: RecentVisit[] } {
  const recents = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { recents };
}

/**
 * Record a visit on mount and whenever the visited object changes — the one
 * line a detail route (page/board) adds: `useRecordVisit(spaceId, id)`.
 */
export function useRecordVisit(spaceId: string, objectId: string): void {
  useEffect(() => {
    recordVisit(spaceId, objectId);
  }, [spaceId, objectId]);
}
