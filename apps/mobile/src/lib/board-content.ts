/**
 * Kanban-board view definition on a {@link WalDocument} (the `board` object type).
 *
 * One board WAL doc holds ONLY the **column list** (title + done-flag). Tasks are
 * now first-class {@link ObjectNode}s (`type === 'task'`, `parentId === boardId`);
 * see {@link task-model} for the projection from nodes → board view.
 *
 * Every mutation is an idempotent CRDT op. Pure over a WalDocument (no React/network).
 */
import type { Json, WalDocument } from '@drakkar.software/starfish-wal';

import { randomId } from './ids';

export interface Column {
  id: string;
  title: string;
  /** This column is the board's "Done" group: tasks in it render checked/struck. */
  done: boolean;
}

const COLS = 'columns';
const colTitle = (id: string) => `coltitle:${id}`;
const colDone = (id: string) => `coldone:${id}`;

const str = (v: Json | undefined): string => (typeof v === 'string' ? v : '');

function colIds(doc: WalDocument): string[] {
  const v = doc.materialize()[COLS];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Project the WAL document into the board's column list. */
export function readColumns(doc: WalDocument): Column[] {
  const state = doc.materialize();
  const ids = Array.isArray(state[COLS]) ? (state[COLS] as Json[]) : [];
  const seen = new Set<string>();
  const columns: Column[] = [];
  for (const raw of ids) {
    if (typeof raw !== 'string' || seen.has(raw)) continue;
    seen.add(raw);
    columns.push({ id: raw, title: str(state[colTitle(raw)]), done: state[colDone(raw)] === true });
  }
  return columns;
}

/**
 * Sort key for a card landing between two siblings — fractional indexing over
 * the plain-number `order` register, so ANY drop position is a single LWW write.
 */
export function orderBetween(above: number | undefined, below: number | undefined): number {
  if (above !== undefined && below !== undefined) return (above + below) / 2;
  if (below !== undefined) return below - 1;
  if (above !== undefined) return above + 1;
  return 1;
}

export function addColumn(doc: WalDocument, title: string): string {
  const id = randomId();
  doc.setField(colTitle(id), title);
  doc.push(COLS, id);
  return id;
}

export function renameColumn(doc: WalDocument, id: string, title: string): void {
  doc.setField(colTitle(id), title);
}

export function setColumnDone(doc: WalDocument, id: string, done: boolean): void {
  doc.setField(colDone(id), done);
}

export function moveColumn(doc: WalDocument, id: string, toIndex: number): void {
  const cur = colIds(doc).filter((x, i, a) => a.indexOf(x) === i);
  const from = cur.indexOf(id);
  if (from === -1) return;
  const next = cur.filter((x) => x !== id);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, id);
  doc.setList(COLS, next);
}

/** Remove a column from the board doc. Task cleanup is the caller's responsibility. */
export function deleteColumn(doc: WalDocument, id: string): void {
  doc.setList(COLS, colIds(doc).filter((x) => x !== id));
  doc.deleteField(colTitle(id));
  doc.deleteField(colDone(id));
}

export function seedDefaultColumns(doc: WalDocument): void {
  addColumn(doc, 'To do');
  addColumn(doc, 'In progress');
  setColumnDone(doc, addColumn(doc, 'Done'), true);
}
