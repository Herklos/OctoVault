import { useCallback, useMemo, useRef } from 'react';

import { objIndexPull, objIndexPush, pubObjIndexPull, pubObjIndexPush } from './starfish/paths';
import {
  addObject,
  ancestors as ancestorsOf,
  archiveObject as archiveObjectNodes,
  breadcrumbs as breadcrumbsOf,
  buildTree,
  clearProp,
  patchObject,
  reorderObjects,
  reparentObject,
  setProps as setPropsReducer,
  subtreeIds,
  type NewObjectInput,
  type ObjectTreeNode,
} from './starfish/objects';
import type { ID, ObjectNode, PropValue } from './types';
import { useMergeDoc } from './use-merge-doc';
import { useRoomLiveSync } from './use-room-live-sync';

/** The unified object-index hook for one space — a union-merged merge-doc (see
 *  {@link useMergeDoc}) exposing the repaired render tree plus the create/rename/move/
 *  archive/reorder mutations every Work + sidebar surface consumes. Purely additive
 *  today: room CONTENT and the legacy `_rooms` registry are untouched; this index is
 *  the new home for docs/projects (and, once consumers migrate, rooms). */
export interface ObjectsHook {
  tree: ObjectTreeNode[];
  nodes: ObjectNode[];
  /** The RAW node list including archived entries — the Trash view's source.
   *  Everything else should keep reading `nodes`/`tree` (archived filtered out). */
  allNodes: ObjectNode[];
  breadcrumbs: (id: ID) => ObjectNode[];
  /** Root→parent trail (EXCLUSIVE of `id`) for a detail screen's breadcrumb. */
  ancestors: (id: ID) => ObjectNode[];
  get: (id: ID) => ObjectNode | undefined;
  opening: boolean;
  openError: string | null;
  offline: boolean;
  ready: boolean;
  /** True once the index has painted — use this (not `ready`) to tell an empty
   *  workspace apart from one still loading. */
  loaded: boolean;
  reload: () => void;
  /** Pull the latest index from the server into this store (used by the shared
   *  {@link SpaceObjectsProvider} for live convergence). */
  pull: () => void;
  create: (input: NewObjectInput) => ID | null;
  rename: (id: ID, patch: { title?: string; emoji?: string }) => void;
  move: (id: ID, parentId: ID | null) => void;
  reorder: (orderById: Record<ID, number>) => void;
  archive: (id: ID) => void;
  /** Un-archive a node and its whole subtree — the "Undo" of {@link archive} and
   *  the Trash view's Restore. Restores the SAME id set archive cascaded over. */
  restore: (id: ID) => void;
  /** Delete-forever: drop a node + subtree from the index. Best-effort under
   *  union-merge — a stale replica that re-pushes its copy resurrects the nodes,
   *  but they come back `archived: true` (the flag rides each node), so the
   *  failure mode is "reappears in Trash", never "reappears in the workspace". */
  purge: (id: ID) => void;
  /** Merge a props patch into a node's index entry (node-level LWW). */
  setProps: (id: ID, patch: Record<string, PropValue>) => void;
  /** Remove a single key from a node's props map (node-level LWW). */
  clearProp: (id: ID, key: string) => void;
  /** Apply an arbitrary stamped reducer to the node list (for composite ops like the
   *  room/category helpers in {@link useRooms}). Returns false when not writable yet. */
  mutate: (reducer: (nodes: ObjectNode[], now: number) => ObjectNode[]) => boolean;
}

export function useObjects(spaceId: string, opts: { enabled?: boolean; liveSync?: boolean } = {}): ObjectsHook {
  const enabled = (opts.enabled ?? true) && !!spaceId;

  const { doc, ready, loaded, opening, openError, offline, reload, apply, pull } = useMergeDoc({
    spaceId,
    openId: spaceId,
    enabled,
    storeKey: `objindex:${spaceId}`,
    privatePaths: () => ({ pull: objIndexPull(spaceId), push: objIndexPush(spaceId) }),
    publicPaths: (ownerId) => ({ pull: pubObjIndexPull(ownerId, spaceId), push: pubObjIndexPush(ownerId, spaceId) }),
  });

  // Refresh-on-focus parity with chat (see {@link useDoc} / {@link useRoom}): a screen
  // that edits a doc/project pushes to the server through its OWN index store, so a
  // separately-mounted Work surface only sees the change on its next pull. Reuse the
  // shared {@link useRoomLiveSync} to focus-pull (+ poll while SSE is down) the index.
  // Note: index change events carry only `spaceId` and are dropped by parseRoomChange,
  // so the SSE registerPull never fires for the index — focus-pull is what refreshes it.
  // OPT-IN (`liveSync`): this calls useFocusEffect, which needs a router screen. The
  // index is also mounted in the desktop sidebar (outside a focus screen), so we must
  // NOT call the hook there — gated by a flag that is static per mount, keeping hook
  // order stable.
  // eslint-disable-next-line react-hooks/rules-of-hooks -- `liveSync` is fixed per call site (never toggles for a mounted instance), so the hook order is stable
  if (opts.liveSync) useRoomLiveSync({ roomId: spaceId, ready, pull, skipFirstFocus: true, firstFocusKey: spaceId });

  const objects = useMemo<ObjectNode[]>(() => (Array.isArray(doc?.objects) ? (doc!.objects as ObjectNode[]) : []), [doc]);

  // Monotonic per-session stamp avoids same-ms collisions while staying a valid
  // union-merge ordering key (threaded into the pure reducers; never Date.now() inline).
  const nowRef = useRef(0);
  const stamp = useCallback(() => {
    const t = Date.now();
    nowRef.current = t > nowRef.current ? t : nowRef.current + 1;
    return nowRef.current;
  }, []);

  const applyNodes = useCallback(
    (reducer: (objects: ObjectNode[]) => ObjectNode[]) =>
      apply((d) => ({ ...d, objects: reducer((d.objects as ObjectNode[]) ?? []) })),
    [apply],
  );

  const create = useCallback(
    (input: NewObjectInput): ID | null => {
      const now = stamp();
      const built = addObject(objects, input, now);
      const ok = applyNodes((cur) => addObject(cur, { ...input, id: built.node.id }, now).nodes);
      return ok ? built.node.id : null;
    },
    [objects, stamp, applyNodes],
  );

  const rename = useCallback((id: ID, patch: { title?: string; emoji?: string }) => {
    const now = stamp();
    applyNodes((cur) => patchObject(cur, id, patch, now));
  }, [stamp, applyNodes]);

  const move = useCallback((id: ID, parentId: ID | null) => {
    const now = stamp();
    applyNodes((cur) => reparentObject(cur, id, parentId, now));
  }, [stamp, applyNodes]);

  const reorder = useCallback((orderById: Record<ID, number>) => {
    const now = stamp();
    applyNodes((cur) => reorderObjects(cur, orderById, now));
  }, [stamp, applyNodes]);

  const archive = useCallback((id: ID) => {
    const now = stamp();
    applyNodes((cur) => archiveObjectNodes(cur, id, now));
  }, [stamp, applyNodes]);

  const restore = useCallback((id: ID) => {
    const now = stamp();
    applyNodes((cur) => {
      const ids = subtreeIds(cur, id);
      return cur.map((n) => (ids.has(n.id) && n.archived ? { ...n, archived: false, updatedAt: now } : n));
    });
  }, [stamp, applyNodes]);

  const purge = useCallback((id: ID) => {
    applyNodes((cur) => {
      const ids = subtreeIds(cur, id);
      // Only drop ARCHIVED members: a live node can sit inside an archived subtree
      // (created concurrently on another device, merged in later) — buildTree
      // already renders it as a root orphan, and deleting it here would destroy
      // content the user never archived.
      return cur.filter((n) => !(ids.has(n.id) && n.archived));
    });
  }, [applyNodes]);

  const setProps = useCallback((id: ID, patch: Record<string, PropValue>) => {
    const now = stamp();
    applyNodes((cur) => setPropsReducer(cur, id, patch, now));
  }, [stamp, applyNodes]);

  const clearPropFn = useCallback((id: ID, key: string) => {
    const now = stamp();
    applyNodes((cur) => clearProp(cur, id, key, now));
  }, [stamp, applyNodes]);

  const mutate = useCallback((reducer: (nodes: ObjectNode[], now: number) => ObjectNode[]) => {
    const now = stamp();
    return applyNodes((cur) => reducer(cur, now));
  }, [stamp, applyNodes]);

  const tree = useMemo(() => buildTree(objects), [objects]);
  const nodes = useMemo(() => objects.filter((n) => !n.archived), [objects]);
  const breadcrumbs = useCallback((id: ID) => breadcrumbsOf(objects, id), [objects]);
  const ancestors = useCallback((id: ID) => ancestorsOf(objects, id), [objects]);
  const get = useCallback((id: ID) => objects.find((n) => n.id === id), [objects]);

  return { tree, nodes, allNodes: objects, breadcrumbs, ancestors, get, opening, openError, offline, ready, loaded, reload, pull, create, rename, move, reorder, archive, restore, purge, setProps, clearProp: clearPropFn, mutate };
}
