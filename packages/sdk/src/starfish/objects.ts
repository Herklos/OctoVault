/**
 * Unified Object model — pure logic over the space object index.
 *
 * A space's contents (rooms, categories, automations, docs, projects) are
 * {@link ObjectNode}s in one union-merged index doc at `spaces/{spaceId}/objects/_index`.
 * Encrypted I/O lives in the hook layer (`use-objects.ts` drives `useSyncInit` with the
 * space encryptor, exactly like `use-room.ts`); THIS module is the pure, testable core:
 * the tree builder + its merge-artifact guards, breadcrumbs, ordering, and the node
 * reducers a `store.set` applies. Keeping it side-effect-free is the twin of how
 * `reactions.ts` builds append-only events for the merge-doc room store.
 *
 * Because the index is union-merged (per-node last-write-wins keyed on `updatedAt`),
 * the tree is only eventually consistent — two devices can concurrently produce a
 * cycle (A→under B while B→under A) or an orphan (parent archived). The builder below
 * is the single place those are repaired so every consumer renders a well-formed tree.
 */
import type { AutomationMeta, ID, ObjectNode, ObjectType, PropValue } from '../domain/types';
import { randomId } from '../domain/ids';

/** A node plus its resolved children — the shape the sidebar/Work tree renders. */
export interface ObjectTreeNode extends ObjectNode {
  depth: number;
  children: ObjectTreeNode[];
}

/** Deterministic sibling comparison: by `order`, ties broken by `id`, so every device
 *  renders an identical tree regardless of merge arrival order. */
function compareSiblings(a: ObjectNode, b: ObjectNode): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The order value for a new node appended after `siblings` (max + 1, gap-free enough
 *  for drag-reorder which rewrites the moved node's order between neighbours). */
export function nextOrder(siblings: ObjectNode[]): number {
  let max = 0;
  for (const s of siblings) if (s.order > max) max = s.order;
  return max + 1;
}

/**
 * Build the render tree from a flat node list, repairing merge artifacts:
 *  - **archived** nodes (and, transitively, their subtrees) are dropped.
 *  - **orphans** — a `parentId` that is missing or archived — reparent to root.
 *  - **cycles** — a node reachable from itself via `parentId` — the offending node
 *    reparents to root (its later edit is the one broken; root is always safe).
 *  - **siblings** sort by {@link compareSiblings} for cross-device determinism.
 *
 * Pass `includeArchived` to keep archived nodes (e.g. an "archived" view).
 */
export function buildTree(nodes: ObjectNode[], includeArchived = false): ObjectTreeNode[] {
  const live = includeArchived ? nodes : nodes.filter((n) => !n.archived);
  const byId = new Map<ID, ObjectNode>(live.map((n) => [n.id, n]));

  // Resolve each node's EFFECTIVE parent: null if the parent is gone, or if following
  // the chain loops back to this node (cycle) — both fall to root.
  const effectiveParent = (n: ObjectNode): ID | null => {
    if (n.parentId == null) return null;
    if (!byId.has(n.parentId)) return null; // orphan → root
    const seen = new Set<ID>([n.id]);
    let cur: ID | null = n.parentId;
    while (cur != null) {
      if (seen.has(cur)) return null; // cycle → root
      seen.add(cur);
      const parent = byId.get(cur);
      if (!parent) return null;
      cur = parent.parentId;
    }
    return n.parentId;
  };

  const childrenOf = new Map<ID | null, ObjectNode[]>();
  for (const n of live) {
    const p = effectiveParent(n);
    const bucket = childrenOf.get(p) ?? [];
    bucket.push(n);
    childrenOf.set(p, bucket);
  }

  const attach = (parent: ID | null, depth: number): ObjectTreeNode[] =>
    (childrenOf.get(parent) ?? [])
      .slice()
      .sort(compareSiblings)
      .map((n) => ({ ...n, depth, children: attach(n.id, depth + 1) }));

  return attach(null, 0);
}

/** The root→node trail (inclusive) for breadcrumbs, following effective parents and
 *  short-circuiting any cycle. Returns `[]` if the node is unknown. */
export function breadcrumbs(nodes: ObjectNode[], id: ID): ObjectNode[] {
  const byId = new Map<ID, ObjectNode>(nodes.map((n) => [n.id, n]));
  const trail: ObjectNode[] = [];
  const seen = new Set<ID>();
  let cur: ID | null = id;
  while (cur != null && byId.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    const node: ObjectNode = byId.get(cur)!;
    trail.unshift(node);
    cur = node.parentId;
  }
  return trail;
}

/** The root→parent trail (EXCLUSIVE of the node itself) — the ancestor path a
 *  breadcrumb shows, since the current node is already titled on its own screen.
 *  Empty for a root-level node. */
export function ancestors(nodes: ObjectNode[], id: ID): ObjectNode[] {
  return breadcrumbs(nodes, id).slice(0, -1);
}

/** The ids of a node and its whole subtree (for cascade-archive). */
export function subtreeIds(nodes: ObjectNode[], rootId: ID): Set<ID> {
  const childrenOf = new Map<ID | null, ID[]>();
  for (const n of nodes) {
    const bucket = childrenOf.get(n.parentId) ?? [];
    bucket.push(n.id);
    childrenOf.set(n.parentId, bucket);
  }
  const out = new Set<ID>();
  const walk = (id: ID) => {
    if (out.has(id)) return; // guard against a cyclic parentId
    out.add(id);
    for (const child of childrenOf.get(id) ?? []) walk(child);
  };
  walk(rootId);
  return out;
}

// ── Node reducers (pure: ObjectNode[] → ObjectNode[]) ─────────────────────────
// A `store.set` applies one of these to the index doc's `objects` array. `now` is
// threaded in (never `Date.now()` inline) so callers stamp a single consistent
// timestamp and the reducers stay pure/testable.

export interface NewObjectInput {
  type: ObjectType;
  parentId?: ID | null;
  title: string;
  emoji?: string;
  automation?: AutomationMeta;
  /** Structured property values applied at creation time (e.g. blobId, status). */
  props?: Record<string, PropValue>;
  /** Provide to reuse an id (e.g. a room id derived elsewhere); else minted. */
  id?: ID;
}

/** Append a new node under `parentId` at the end of its sibling order. */
export function addObject(nodes: ObjectNode[], input: NewObjectInput, now: number): { nodes: ObjectNode[]; node: ObjectNode } {
  const parentId = input.parentId ?? null;
  const siblings = nodes.filter((n) => n.parentId === parentId);
  const node: ObjectNode = {
    id: input.id ?? `obj-${randomId()}`,
    type: input.type,
    parentId,
    order: nextOrder(siblings),
    title: input.title,
    ...(input.emoji ? { emoji: input.emoji } : {}),
    updatedAt: now,
    ...(input.automation ? { automation: input.automation } : {}),
    ...(input.props ? { props: input.props } : {}),
  };
  return { nodes: [...nodes, node], node };
}

/** Merge a props patch into a node's `props` map (node-level LWW write; bumps `updatedAt`).
 *  Concurrent writes of DIFFERENT keys on the SAME node lose one side — acceptable for
 *  low-frequency metadata; the freeform body stays in the per-object content doc. */
export function setProps(nodes: ObjectNode[], id: ID, patch: Record<string, PropValue>, now: number): ObjectNode[] {
  return nodes.map((n) => (n.id === id ? { ...n, props: { ...n.props, ...patch }, updatedAt: now } : n));
}

/** Remove a single key from a node's `props` map (LWW write; bumps `updatedAt`). */
export function clearProp(nodes: ObjectNode[], id: ID, key: string, now: number): ObjectNode[] {
  return nodes.map((n) => {
    if (n.id !== id) return n;
    const next = { ...n.props };
    delete next[key];
    return { ...n, props: next, updatedAt: now };
  });
}

/** Patch a node's mutable metadata (title/emoji/automation), bumping `updatedAt`. */
export function patchObject(nodes: ObjectNode[], id: ID, patch: Partial<Pick<ObjectNode, 'title' | 'emoji' | 'automation'>>, now: number): ObjectNode[] {
  return nodes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now } : n));
}

/** Reparent a node (move in the tree). Rejects making a node its own descendant —
 *  the caller's drop target is ignored in that case and the list returned unchanged. */
export function reparentObject(nodes: ObjectNode[], id: ID, parentId: ID | null, now: number): ObjectNode[] {
  if (id === parentId) return nodes;
  if (parentId != null && subtreeIds(nodes, id).has(parentId)) return nodes; // would create a cycle
  const siblings = nodes.filter((n) => n.parentId === parentId && n.id !== id);
  return nodes.map((n) => (n.id === id ? { ...n, parentId, order: nextOrder(siblings), updatedAt: now } : n));
}

/** Set explicit sibling order (drag-reorder); ids not present are left untouched. */
export function reorderObjects(nodes: ObjectNode[], orderById: Record<ID, number>, now: number): ObjectNode[] {
  return nodes.map((n) => (n.id in orderById ? { ...n, order: orderById[n.id]!, updatedAt: now } : n));
}

/** Cascade-archive a node and its whole subtree (soft delete). */
export function archiveObject(nodes: ObjectNode[], id: ID, now: number): ObjectNode[] {
  const ids = subtreeIds(nodes, id);
  return nodes.map((n) => (ids.has(n.id) ? { ...n, archived: true, updatedAt: now } : n));
}

