/**
 * Database view helpers — pure filter/sort/group logic for the "database" object type.
 *
 * A database node carries its column schema in `node.meta.schema: PropField[]`.
 * Its children (objects with `parentId === database.id`) are the rows/records.
 * Each record's `meta.props` holds the column values, just like any Record object.
 *
 * `applyView()` is a pure function: no React, no I/O.  It is shared between
 * the React hook and any server-side query path.
 */

import type { ObjectNode, PropValue } from '../domain/types';
import type { PropField } from '../domain/object-types';
import { propsOf } from './objects-ext';

// ── View spec ────────────────────────────────────────────────────────────────

export type FilterOp =
  | { $eq: PropValue }
  | { $ne: PropValue }
  | { $gt: number }
  | { $gte: number }
  | { $lt: number }
  | { $lte: number }
  | { $in: PropValue[] }
  | { $contains: string }
  | { $isEmpty: true }
  | { $isNotEmpty: true };

export type FieldFilter = { field: string; op: FilterOp };

export type SortDir = 'asc' | 'desc';
export interface SortSpec { field: string; dir: SortDir }

export type DatabaseViewKind = 'table' | 'gallery' | 'board';

export interface DatabaseView {
  kind: DatabaseViewKind;
  /** Column filters (all must match — implicit AND). */
  filters?: FieldFilter[];
  sort?: SortSpec;
  /** For board view: group rows by this select field. */
  groupBy?: string;
  /** Columns to show in table view (ordered).  Undefined = show all schema columns. */
  columns?: string[];
  limit?: number;
}

// ── Per-record result ─────────────────────────────────────────────────────────

export interface DatabaseRecord {
  node: ObjectNode;
  props: Record<string, PropValue>;
}

// ── Grouped result (for board view) ──────────────────────────────────────────

export interface DatabaseGroup {
  key: string | null;   // null = "No group value"
  label: string;
  records: DatabaseRecord[];
}

export interface DatabaseViewResult {
  records: DatabaseRecord[];
  /** Only populated when `view.groupBy` is set. */
  groups: DatabaseGroup[];
  hasMore: boolean;
}

// ── Filter evaluation ─────────────────────────────────────────────────────────

function evalOp(actual: PropValue, op: FilterOp): boolean {
  if ('$eq' in op)         return actual === op.$eq;
  if ('$ne' in op)         return actual !== op.$ne;
  if ('$gt' in op)         return typeof actual === 'number' && actual > op.$gt;
  if ('$gte' in op)        return typeof actual === 'number' && actual >= op.$gte;
  if ('$lt' in op)         return typeof actual === 'number' && actual < op.$lt;
  if ('$lte' in op)        return typeof actual === 'number' && actual <= op.$lte;
  if ('$in' in op)         return op.$in.includes(actual);
  if ('$contains' in op)   return typeof actual === 'string' && actual.toLowerCase().includes(op.$contains.toLowerCase());
  if ('$isEmpty' in op)    return actual == null || actual === '';
  if ('$isNotEmpty' in op) return actual != null && actual !== '';
  return true;
}

function matchesFilters(props: Record<string, PropValue>, filters: FieldFilter[]): boolean {
  return filters.every(f => evalOp(props[f.field] ?? null, f.op));
}

// ── Sort comparison ───────────────────────────────────────────────────────────

function cmpValues(a: PropValue, b: PropValue): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Read the column schema from a database node's `meta.schema` field. */
export function schemaOf(dbNode: ObjectNode): PropField[] {
  const schema = dbNode.meta?.schema;
  if (!Array.isArray(schema)) return [];
  return schema as PropField[];
}

/**
 * Apply a {@link DatabaseView} spec to a flat list of child nodes (the database's
 * records).  Returns filtered, sorted, and optionally grouped results.
 *
 * Pure function — safe to call on any thread/render cycle.
 */
export function applyView(
  records: ObjectNode[],
  view: DatabaseView,
  schema?: PropField[],
): DatabaseViewResult {
  // 1. Map to DatabaseRecord (eagerly read props once).
  let items: DatabaseRecord[] = records.map(node => ({
    node,
    props: propsOf(node),
  }));

  // 2. Filter.
  if (view.filters && view.filters.length > 0) {
    items = items.filter(r => matchesFilters(r.props, view.filters!));
  }

  // 3. Sort.
  if (view.sort) {
    const { field, dir } = view.sort;
    const sign = dir === 'asc' ? 1 : -1;
    items = [...items].sort((a, b) => {
      const av = field === '_title' ? a.node.title : (a.props[field] ?? null);
      const bv = field === '_title' ? b.node.title : (b.props[field] ?? null);
      return sign * cmpValues(av as PropValue, bv as PropValue);
    });
  }

  const total = items.length;

  // 4. Limit.
  if (view.limit && view.limit > 0) {
    items = items.slice(0, view.limit);
  }

  const hasMore = items.length < total;

  // 5. Group (for board view).
  let groups: DatabaseGroup[] = [];
  if (view.groupBy) {
    const groupField = schema?.find(f => f.key === view.groupBy);
    const buckets = new Map<string | null, DatabaseRecord[]>();

    for (const r of items) {
      const key = (r.props[view.groupBy] ?? null) as string | null;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(r);
    }

    const keyOrder: Array<string | null> = groupField?.options?.map(o => o.id) ?? [];
    if (!keyOrder.includes(null)) keyOrder.push(null);

    for (const key of keyOrder) {
      if (buckets.has(key)) {
        const label = key == null
          ? 'No group'
          : (groupField?.options?.find(o => o.id === key)?.label ?? key);
        groups.push({ key, label, records: buckets.get(key)! });
      }
    }
    // Any remaining keys not in keyOrder
    for (const [key, recs] of buckets) {
      if (!keyOrder.includes(key)) {
        groups.push({ key, label: key ?? 'No group', records: recs });
      }
    }
  }

  return { records: items, groups, hasMore };
}

export type { PropField };
