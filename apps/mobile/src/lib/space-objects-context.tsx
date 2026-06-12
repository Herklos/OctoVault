import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { registerPull, onSseStatus } from '@drakkar.software/octovault-sdk';
import { useObjects, type ObjectsHook } from './use-objects';
import { useSpaces } from './use-spaces';

/**
 * ONE shared object-index store for the active space, consumed by every surface
 * that reads or mutates the tree — the desktop sidebar, the Vault tab, and the
 * page/board detail routes. Before this, each surface mounted its OWN
 * {@link useObjects} (the SDK gives every store its own in-memory state), so a
 * rename on a detail screen never refreshed the sidebar/breadcrumb until a focus
 * pull raced in. With one store, a mutation re-renders every consumer instantly —
 * that is the fix for "refresh names when updating them".
 *
 * Mounted once in `app/_layout.tsx` (inside the spaces/session providers, around
 * `AppFrame`). It cannot use {@link useRoomLiveSync} for convergence because that
 * relies on `useFocusEffect`, which needs a router SCREEN — the provider sits above
 * the navigator. Instead it registers an SSE pull + a 4 s poll-while-SSE-down here
 * directly (the object index has no per-room unread concern, so an always-on pull
 * is fine).
 */
interface SpaceObjectsValue {
  /** The space this store is bound to (the active space), or null when signed out. */
  spaceId: string | null;
  objects: ObjectsHook;
}

const SpaceObjectsContext = createContext<SpaceObjectsValue | null>(null);

export function SpaceObjectsProvider({ children }: { children: ReactNode }) {
  const { activeId } = useSpaces();
  const spaceId = activeId ?? null;
  const objects = useObjects(spaceId ?? '', { enabled: !!spaceId });

  // Pull through a ref so the SSE/poll effects don't re-register every render
  // (the underlying merge-doc `pull` identity isn't guaranteed stable).
  const pullRef = useRef(objects.pull);
  useEffect(() => {
    pullRef.current = objects.pull;
  });

  const ready = objects.ready;

  // Live SSE: a change event for this space re-pulls the shared store (the store
  // self-pulls on open, so no extra pull is needed on mount).
  useEffect(() => {
    if (!spaceId || !ready) return;
    return registerPull(spaceId, () => pullRef.current());
  }, [spaceId, ready]);

  // Fallback poll while the SSE stream is down (matches useRoomLiveSync's 4 s cadence).
  const [sseUp, setSseUp] = useState(false);
  useEffect(() => onSseStatus(setSseUp), []);
  useEffect(() => {
    if (!spaceId || !ready || sseUp) return;
    const iv = setInterval(() => pullRef.current(), 4000);
    return () => clearInterval(iv);
  }, [spaceId, ready, sseUp]);

  const value = useMemo<SpaceObjectsValue>(() => ({ spaceId, objects }), [spaceId, objects]);
  return <SpaceObjectsContext.Provider value={value}>{children}</SpaceObjectsContext.Provider>;
}

/**
 * Read the shared object-index store for the active space. Surfaces that operate
 * on a specific space (the detail routes) should first ensure that space is active
 * (see the routes' `setActiveId` sync) so the shared store matches their param.
 */
export function useSpaceObjects(): SpaceObjectsValue {
  const v = useContext(SpaceObjectsContext);
  if (!v) throw new Error('useSpaceObjects must be used within a SpaceObjectsProvider');
  return v;
}
