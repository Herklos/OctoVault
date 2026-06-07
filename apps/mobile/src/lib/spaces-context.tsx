/**
 * App-wide space registry, mounted once near the root. Holds ONE copy of the
 * identity's spaces; `useSpaces` is a thin consumer over it.
 *
 * It deliberately does NOT depend on unread state: `UnreadProvider` (chat-era,
 * removed) used to read the space-id set from here, so the provider sits high in
 * the tree regardless.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';

import type { Space } from '@/lib/types';

import { createSpace as createSpaceDoc, onSpaceMeta, readSpaces, reorderSpaces as reorderSpacesDoc } from './starfish/registry';
import { createPublicSpace } from './starfish/pubspace';
import { consumePrimedSpaces } from './spaces-prime';
import { hydrateMutes } from './mutes';
import { flushReadsNow, hydrateReads } from './reads';
import { useSession } from './session-context';

interface SpacesContextValue {
  /** The identity's spaces, WITHOUT the unread overlay (added in `useSpaces`). */
  spaces: Space[];
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  loading: boolean;
  refresh: () => Promise<void>;
  createSpace: (name: string, type?: 'private' | 'public') => Promise<Space | null>;
  /** Persist a new rail order (an explicit list of space ids). Reorders the local
   *  list optimistically, then writes it to the synced doc so it follows the user across
   *  devices; re-reads to recover if the write fails. */
  reorderSpaces: (orderedRailIds: string[]) => Promise<void>;
}

const Ctx = createContext<SpacesContextValue | null>(null);

export function SpacesProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const pathname = usePathname();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) return;
    const { spaces: list, mutes, reads } = await readSpaces(session.accountClient, session.userId);
    setSpaces(list);
    setActiveId((prev) => prev ?? list[0]?.id ?? null);
    // This `_spaces` re-pull runs on every navigation (effect below) and on app
    // foreground. Re-hydrate the read marks and mute prefs from it too (they share the
    // doc) so a room read or a space muted on another device propagates here without an
    // app restart. Max-merged / server-authoritative in their own modules, so a stale
    // read can't roll local state back.
    await hydrateReads(session.userId, reads);
    await hydrateMutes(session.userId, mutes);
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show loading while (re)reading spaces on session change
    setLoading(true);
    if (!session) {
      setSpaces([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    // Adopt the `_spaces` doc already read during session setup (member-cap
    // hydration) instead of pulling the identical doc again on first paint. Falls
    // back to a read when no fresh stash exists (e.g. a later in-app refresh).
    const primed = consumePrimedSpaces(session.userId);
    // An EMPTY prime (`[]`) is truthy in JS — if we adopted it we'd short-circuit
    // the refresh and show a blank rail. Offline that empty came from a failed
    // `readSpaces`; the SDK pull cache now serves the last-synced `_spaces` doc on
    // the refresh below, so fall through to it instead of locking in empty.
    if (primed && primed.length > 0) {
      setSpaces(primed);
      setActiveId((prev) => prev ?? primed[0]?.id ?? null);
      setLoading(false);
      // Kick a background refresh to pick up the latest spaces + read/mute marks now.
      void refresh().catch(() => {});
      return;
    }
    (async () => {
      try {
        await refresh();
      } catch {
        /* leave empty on error */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, refresh]);

  // Re-read on navigation (no loading flicker) so a space created on another
  // device shows up in the persistent desktop shell, which never remounts. Skips the
  // mount run (the effect above already loads then) so first paint is a single fetch.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!session) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    void refresh().catch(() => {});
  }, [pathname, session, refresh]);

  // Re-pull on app foreground too, so the read-mark / mute reconcile happens even when
  // the user returns to the app WITHOUT navigating. On web a tab refocus dispatches the
  // same 'active' change. Idempotent: an unchanged doc no-ops in the hydrate functions.
  useEffect(() => {
    if (!session) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh().catch(() => {});
      } else {
        // Backgrounding is the most common "done reading" action on mobile — push any
        // read marks still inside the debounce window NOW, before RN freezes timers.
        void flushReadsNow();
      }
    });
    return () => sub.remove();
  }, [session, refresh]);

  // Adopt a freshly-saved/reconciled space name + image (from the settings screen
  // or a post-sync reconcile) live, without waiting for the next navigation refresh.
  useEffect(
    () =>
      onSpaceMeta((id, meta) => {
        setSpaces((prev) =>
          prev.map((s) => (s.id === id ? { ...s, name: meta.name, short: meta.short, image: meta.image } : s)),
        );
      }),
    [],
  );

  const createSpace = useCallback(
    async (name: string, type: 'private' | 'public' = 'private'): Promise<Space | null> => {
      if (!session) return null;
      const space =
        type === 'public'
          ? await createPublicSpace(session, name)
          : await createSpaceDoc(session, name);
      await refresh();
      setActiveId(space.id);
      return space;
    },
    [session, refresh],
  );

  const reorderSpaces = useCallback(
    async (orderedRailIds: string[]) => {
      if (!session) return;
      // Optimistic: reorder the local rail to match the dropped order immediately. Tail
      // entries `orderedRailIds` didn't mention keep their place.
      const order = new Map(orderedRailIds.map((id, i) => [id, i]));
      const reordered = (list: Space[]) =>
        [...list].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
      setSpaces((prev) => reordered(prev));
      try {
        await reorderSpacesDoc(session.accountClient, session.userId, orderedRailIds);
      } catch {
        // Write failed — re-read the authoritative doc so the rail can't drift from the server.
        void refresh().catch(() => {});
      }
    },
    [session, refresh],
  );

  const value = useMemo<SpacesContextValue>(
    () => ({ spaces, activeId, setActiveId, loading, refresh, createSpace, reorderSpaces }),
    [spaces, activeId, loading, refresh, createSpace, reorderSpaces],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Raw spaces context. Most UI should use `useSpaces` instead. */
export function useSpacesContext(): SpacesContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSpacesContext must be used within SpacesProvider');
  return v;
}
