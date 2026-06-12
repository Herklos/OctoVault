import { useCallback, useEffect, useRef, useState } from 'react';

import { kvGet, kvSet } from '@drakkar.software/octovault-sdk';
import type { ObjectTreeNode } from '@drakkar.software/octovault-sdk';
import type { ID } from '@drakkar.software/octovault-sdk';

/** Device-local persistence key for one space's collapsed-row set. Per space so
 *  switching spaces never bleeds one tree's disclosure state into another's. */
const keyFor = (spaceId: string) => `octovault:treecollapse:${spaceId}`;

/** How many tree levels a never-touched device shows expanded: roots + their
 *  direct children. Anything deeper cold-starts collapsed so a grown workspace
 *  opens as an outline, not a wall of rows (the Notion default). */
const DEFAULT_VISIBLE_DEPTH = 2;

export interface TreeCollapse {
  /** Ids whose subtree is hidden on THIS device (collapse is never synced —
   *  it's a viewing preference, not document state). */
  collapsed: Set<ID>;
  toggle: (id: ID) => void;
  /** Force-expand (remove from the set) — used to reveal a new child created
   *  under a collapsed parent and to unfold the ancestors of the selected row. */
  expand: (ids: ID[]) => void;
}

/**
 * Per-space, per-device collapse state for {@link ObjectTree}, persisted via the
 * kv layer (localStorage / AsyncStorage) so the sidebar survives a reload and the
 * phone Vault tab survives a remount — previously an in-memory Set lost on both.
 *
 * Persistence is COLLAPSED ids (absent = expanded) so newly-created nodes appear
 * expanded without any bookkeeping. The one wrinkle that inverts: a device that
 * has never stored anything should NOT start fully expanded — on first contact
 * with a non-empty tree (no kv entry) we seed the set with every parent at depth
 * ≥ {@link DEFAULT_VISIBLE_DEPTH} − 1, i.e. show two levels. The seed runs once
 * and is itself persisted, so it never re-collapses what the user later opens.
 */
export function useTreeCollapse(spaceId: string | null, tree: ObjectTreeNode[]): TreeCollapse {
  const [collapsed, setCollapsed] = useState<Set<ID>>(() => new Set());
  // Which space the current state was hydrated for — writes are gated on this so
  // a toggle racing the async kvGet can't persist a stale (empty) set under the
  // new space's key.
  const hydratedFor = useRef<string | null>(null);
  // True when kv held nothing for this space → the depth-default seed is pending.
  const needsSeed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    hydratedFor.current = null;
    needsSeed.current = false;
    setCollapsed(new Set());
    if (!spaceId) return;
    void kvGet(keyFor(spaceId)).then((raw) => {
      if (cancelled) return;
      if (raw) {
        try {
          const ids = JSON.parse(raw) as ID[];
          setCollapsed(new Set(Array.isArray(ids) ? ids : []));
        } catch {
          needsSeed.current = true; // corrupt entry — fall back to the default
        }
      } else {
        needsSeed.current = true;
      }
      hydratedFor.current = spaceId;
    });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  // First-contact seed: wait for the tree to actually hold nodes (the index
  // paints async), then collapse everything past the default visible depth.
  useEffect(() => {
    if (!spaceId || hydratedFor.current !== spaceId || !needsSeed.current || tree.length === 0) return;
    needsSeed.current = false;
    const seed = new Set<ID>();
    const walk = (nodes: ObjectTreeNode[]) => {
      for (const n of nodes) {
        if (n.depth >= DEFAULT_VISIBLE_DEPTH - 1 && n.children.length > 0) seed.add(n.id);
        walk(n.children);
      }
    };
    walk(tree);
    if (seed.size > 0) {
      setCollapsed(seed);
      void kvSet(keyFor(spaceId), JSON.stringify([...seed]));
    }
  }, [spaceId, tree]);

  const persist = useCallback(
    (next: Set<ID>) => {
      if (spaceId && hydratedFor.current === spaceId) void kvSet(keyFor(spaceId), JSON.stringify([...next]));
    },
    [spaceId],
  );

  const toggle = useCallback(
    (id: ID) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const expand = useCallback(
    (ids: ID[]) => {
      setCollapsed((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of ids) if (next.delete(id)) changed = true;
        if (!changed) return prev; // skip the re-render + write when already open
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return { collapsed, toggle, expand };
}
