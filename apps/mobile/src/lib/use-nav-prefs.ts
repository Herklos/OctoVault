/**
 * Device-local navigation preferences — the memory that makes the shell feel
 * Notion-grade: which space was active, which document was open, and whether
 * the desktop sidebar is collapsed, all restored on the next cold start.
 *
 * DEVICE state, not synced: where *this* window was is per-device by nature
 * (your phone and your desktop are usually in different places), so it lives in
 * the platform kv (web localStorage / native AsyncStorage), keyed per identity
 * so switching accounts never leaks one user's last location into another's.
 *
 * Held as a module-level snapshot + listener set (the `reads.ts` idiom) so
 * non-React callers — `SpacesProvider` seeding the active space before first
 * paint — can read it synchronously after one `hydrateNavPrefs` await, while
 * React consumers subscribe via {@link useNavPrefs} (useSyncExternalStore).
 */
import { useEffect, useSyncExternalStore } from 'react';
import { useGlobalSearchParams, usePathname } from 'expo-router';

import { kvGet, kvSet } from '@drakkar.software/octovault-sdk';

export interface NavPrefs {
  /** Last active space id — restored over `spaces[0]` on cold start. */
  activeSpaceId: string | null;
  /** Last open detail route as a complete href (`/work/page/{id}?spaceId=…`),
   *  or null when the user last sat on the Vault home. */
  lastRoute: string | null;
  /** Desktop sidebar tucked away (mod+\ / the header toggle). */
  sidebarCollapsed: boolean;
  /** True once this identity's stored prefs have been read — `app/index` waits
   *  for it so the launch redirect can land on `lastRoute` without flashing
   *  the Vault home first. */
  hydrated: boolean;
}

const DEFAULTS: NavPrefs = { activeSpaceId: null, lastRoute: null, sidebarCollapsed: false, hydrated: false };

const keyFor = (userId: string) => `octovault.nav.${userId}`;

let snapshot: NavPrefs = DEFAULTS;
let activeKey: string | null = null;
const listeners = new Set<() => void>();

function emit(next: NavPrefs): void {
  snapshot = next;
  for (const l of listeners) l();
}

/** Fire-and-forget persist — nav prefs are a convenience, never worth blocking on. */
function persist(): void {
  if (!activeKey) return;
  const { hydrated: _hydrated, ...stored } = snapshot;
  void kvSet(activeKey, JSON.stringify(stored));
}

/** Synchronous read for non-React callers (SpacesProvider's active-space seed). */
export function getNavPrefs(): NavPrefs {
  return snapshot;
}

/** Subscribe to snapshot changes (drives `useSyncExternalStore`). */
export function subscribeNavPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Rewrite a legacy `/work/page/{id}` or `/work/board/{id}` href to the unified
 *  `/work/object/{id}` path so stored nav-prefs from before the route migration
 *  still land in the correct editor. Query params are preserved. */
function upgradeLegacyRoute(href: string): string {
  return href.replace(/^\/work\/(page|board)\//, '/work/object/');
}

/** Tolerant parse: a missing/garbage field falls back to its default so a pref
 *  blob from an older build can never wedge the launch redirect. */
function coerce(raw: unknown): Omit<NavPrefs, 'hydrated'> {
  const o = (raw ?? {}) as Record<string, unknown>;
  const rawRoute = typeof o.lastRoute === 'string' && o.lastRoute.startsWith('/') ? o.lastRoute : null;
  return {
    activeSpaceId: typeof o.activeSpaceId === 'string' && o.activeSpaceId ? o.activeSpaceId : null,
    lastRoute: rawRoute ? upgradeLegacyRoute(rawRoute) : null,
    sidebarCollapsed: o.sidebarCollapsed === true,
  };
}

/**
 * Load `userId`'s stored prefs into the live snapshot (one fast kv read).
 * Idempotent per identity; called by `SpacesProvider` when a session lands,
 * BEFORE it seeds the active space, so the persisted choice wins over
 * `spaces[0]`. A hydrate that loses a race with sign-out/switch (the active
 * key moved on) drops its result instead of resurrecting the old user's state.
 */
export async function hydrateNavPrefs(userId: string): Promise<void> {
  const key = keyFor(userId);
  if (activeKey === key && snapshot.hydrated) return;
  activeKey = key;
  let raw: string | null = null;
  try {
    raw = await kvGet(key);
  } catch {
    /* unreadable storage — fall through to defaults */
  }
  if (activeKey !== key) return;
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    /* corrupt blob — defaults */
  }
  emit({ ...coerce(parsed), hydrated: true });
}

/** Drop the live snapshot on sign-out so the next identity starts clean (its
 *  own stored prefs re-hydrate on the next session). */
export function resetNavPrefs(): void {
  activeKey = null;
  emit(DEFAULTS);
}

function update(patch: Partial<Omit<NavPrefs, 'hydrated'>>): void {
  emit({ ...snapshot, ...patch });
  persist();
}

/** Remember the active space (called on every explicit/route-driven switch). */
export function setActiveSpacePref(id: string | null): void {
  if (snapshot.activeSpaceId !== id) update({ activeSpaceId: id });
}

/** Remember the last open document href, or `null` when back on the Vault home
 *  (so a launch after browsing home lands home, not on a stale document). */
export function recordLastRoute(href: string | null): void {
  if (snapshot.lastRoute !== href) update({ lastRoute: href });
}

/** Collapse/expand the desktop sidebar (persisted across reloads). */
export function setSidebarCollapsedPref(collapsed: boolean): void {
  if (snapshot.sidebarCollapsed !== collapsed) update({ sidebarCollapsed: collapsed });
}

/** Flip the sidebar pref in place — the mod+\ binding's one-liner. */
export function toggleSidebarPref(): void {
  setSidebarCollapsedPref(!snapshot.sidebarCollapsed);
}

/** Live nav prefs for React consumers (AppFrame's collapse state, index's redirect). */
export function useNavPrefs(): NavPrefs {
  return useSyncExternalStore(subscribeNavPrefs, getNavPrefs, getNavPrefs);
}

/**
 * Track the open document for open-at-last-location. Mounted once in
 * `AppFrame` (the only chrome alive on every route): detail routes record
 * their full href, returning to the Vault home clears it, and every other
 * route (settings, search, join…) leaves the last reading position untouched —
 * those are detours, not destinations.
 */
export function useTrackLastRoute(): void {
  const pathname = usePathname();
  const { hydrated } = useNavPrefs();
  // Detail routes carry their space in params (the store-sync key); fold it
  // into the stored href so a cross-space restore binds the right index.
  const params = useGlobalSearchParams<{ spaceId?: string }>();
  const spaceId = typeof params.spaceId === 'string' ? params.spaceId : '';

  useEffect(() => {
    // Don't record (and especially don't CLEAR) until the stored prefs landed,
    // or a mount at the launch route would wipe the very value we restore from.
    if (!hydrated) return;
    if (pathname.startsWith('/work/object/')) {
      recordLastRoute(spaceId ? `${pathname}?spaceId=${encodeURIComponent(spaceId)}` : pathname);
    } else if (pathname === '/work') {
      recordLastRoute(null);
    }
  }, [pathname, spaceId, hydrated]);
}
