/**
 * Kanban-board model on a {@link WalDocument} (the `board` object type).
 *
 * One board = one WAL document holding:
 *  - an RGA list **`columns`** of column ids and a register **`coltitle:{id}`** each;
 *  - an RGA list **`tasks`** of task ids, with per-task LWW registers
 *    **`task:{id}:col|order|status|title|notes`**.
 *
 * Every mutation is an idempotent CRDT op, so concurrent edits from two devices
 * converge after a `pull()` — no append-fold replay, no lost moves. Pure over a
 * WalDocument (no React/network); the `use-board` hook owns commit/pull.
 */
import type { Json, WalDocument } from '@drakkar.software/starfish-wal';

import { randomId } from './ids';

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Column {
  id: string;
  title: string;
}

export interface Task {
  id: string;
  columnId: string;
  title: string;
  notes: string;
  status: TaskStatus;
  order: number;
}

export interface Board {
  columns: Column[];
  tasksByColumn: Record<string, Task[]>;
  done: number;
  total: number;
}

const COLS = 'columns';
const TASKS = 'tasks';
const colTitle = (id: string) => `coltitle:${id}`;
const taskCol = (id: string) => `task:${id}:col`;
const taskOrder = (id: string) => `task:${id}:order`;
const taskStatus = (id: string) => `task:${id}:status`;
const taskTitle = (id: string) => `task:${id}:title`;
const taskNotes = (id: string) => `task:${id}:notes`;

function ids(doc: WalDocument, list: string): string[] {
  const v = doc.materialize()[list];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

const str = (v: Json | undefined): string => (typeof v === 'string' ? v : '');
const num = (v: Json | undefined): number => (typeof v === 'number' ? v : 0);

/** Project the WAL document into a folded {@link Board}. */
export function readBoard(doc: WalDocument): Board {
  const state = doc.materialize();
  const colIds = Array.isArray(state[COLS]) ? (state[COLS] as Json[]) : [];
  const taskIds = Array.isArray(state[TASKS]) ? (state[TASKS] as Json[]) : [];

  const seenCol = new Set<string>();
  const columns: Column[] = [];
  for (const raw of colIds) {
    if (typeof raw !== 'string' || seenCol.has(raw)) continue;
    seenCol.add(raw);
    columns.push({ id: raw, title: str(state[colTitle(raw)]) });
  }

  const seenTask = new Set<string>();
  const tasks: Task[] = [];
  for (const raw of taskIds) {
    if (typeof raw !== 'string' || seenTask.has(raw)) continue;
    seenTask.add(raw);
    const status = str(state[taskStatus(raw)]);
    tasks.push({
      id: raw,
      columnId: str(state[taskCol(raw)]),
      title: str(state[taskTitle(raw)]),
      notes: str(state[taskNotes(raw)]),
      status: (status === 'doing' || status === 'done' ? status : 'todo') as TaskStatus,
      order: num(state[taskOrder(raw)]),
    });
  }

  const tasksByColumn: Record<string, Task[]> = {};
  for (const col of columns) {
    tasksByColumn[col.id] = tasks
      .filter((t) => t.columnId === col.id)
      .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
  }
  const done = tasks.filter((t) => t.status === 'done').length;
  return { columns, tasksByColumn, done, total: tasks.length };
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

export function addTask(doc: WalDocument, columnId: string, title: string): string {
  const id = randomId();
  const siblings = readBoard(doc).tasksByColumn[columnId] ?? [];
  const order = (siblings.at(-1)?.order ?? 0) + 1;
  doc.setField(taskCol(id), columnId);
  doc.setField(taskTitle(id), title);
  doc.setField(taskStatus(id), 'todo');
  doc.setField(taskOrder(id), order);
  doc.push(TASKS, id);
  return id;
}

export function moveTask(doc: WalDocument, id: string, columnId: string, order: number): void {
  doc.setField(taskCol(id), columnId);
  doc.setField(taskOrder(id), order);
}

export function changeStatus(doc: WalDocument, id: string, status: TaskStatus): void {
  doc.setField(taskStatus(id), status);
}

export function updateTask(
  doc: WalDocument,
  id: string,
  patch: { title?: string; notes?: string },
): void {
  if (patch.title !== undefined) doc.setField(taskTitle(id), patch.title);
  if (patch.notes !== undefined) doc.setField(taskNotes(id), patch.notes);
}

export function deleteTask(doc: WalDocument, id: string): void {
  doc.setList(TASKS, ids(doc, TASKS).filter((x) => x !== id));
  doc.deleteField(taskCol(id));
  doc.deleteField(taskOrder(id));
  doc.deleteField(taskStatus(id));
  doc.deleteField(taskTitle(id));
  doc.deleteField(taskNotes(id));
}
