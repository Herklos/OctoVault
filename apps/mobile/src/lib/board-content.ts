/**
 * Kanban-board model on a {@link WalDocument} (the `board` object type).
 *
 * One board = one WAL document holding:
 *  - an RGA list **`columns`** of column ids, with per-column LWW registers
 *    **`coltitle:{id}`** (title) and **`coldone:{id}`** (this column IS the
 *    board's "Done" group — see below);
 *  - an RGA list **`tasks`** of task ids, with per-task LWW registers
 *    **`task:{id}:col|order|status|title|notes`**.
 *
 * Done-ness follows the Notion model: the column is the grouping property, so a
 * board with a `coldone`-flagged column derives a task's `done` purely from
 * which column it sits in. Boards that predate the flag keep deriving from `status`.
 *
 * NOTE (Phase F): Tasks will eventually be promoted to first-class ObjectNodes
 * (children with parentId===boardId, type==='task'). At that point the `tasks`
 * RGA and per-task registers will be removed from this doc. For now they remain
 * so the existing `BoardHook` surface is unchanged.
 *
 * Every mutation is an idempotent CRDT op. Pure over a WalDocument (no React/network).
 */
import type { Json, WalDocument } from '@drakkar.software/starfish-wal';

import { randomId } from './ids';

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Column {
  id: string;
  title: string;
  /** This column is the board's "Done" group (`coldone:{id}`): cards in it
   *  count as completed and render checked/struck. */
  done: boolean;
}

export interface Task {
  id: string;
  columnId: string;
  title: string;
  notes: string;
  status: TaskStatus;
  order: number;
  /** Derived completion — column membership when the board has a done column,
   *  else the legacy `status` register. Render from THIS, never from `status`. */
  done: boolean;
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
const colDone = (id: string) => `coldone:${id}`;
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
    columns.push({ id: raw, title: str(state[colTitle(raw)]), done: state[colDone(raw)] === true });
  }
  const hasDoneColumn = columns.some((c) => c.done);
  const doneColIds = new Set(columns.filter((c) => c.done).map((c) => c.id));

  const seenTask = new Set<string>();
  const tasks: Task[] = [];
  for (const raw of taskIds) {
    if (typeof raw !== 'string' || seenTask.has(raw)) continue;
    seenTask.add(raw);
    const status = str(state[taskStatus(raw)]);
    let columnId = str(state[taskCol(raw)]);
    if (!seenCol.has(columnId)) columnId = columns[0]?.id ?? '';
    const normalized = (status === 'doing' || status === 'done' ? status : 'todo') as TaskStatus;
    tasks.push({
      id: raw,
      columnId,
      title: str(state[taskTitle(raw)]),
      notes: str(state[taskNotes(raw)]),
      status: normalized,
      order: num(state[taskOrder(raw)]),
      done: hasDoneColumn ? doneColIds.has(columnId) : normalized === 'done',
    });
  }

  const tasksByColumn: Record<string, Task[]> = {};
  for (const col of columns) {
    tasksByColumn[col.id] = tasks
      .filter((t) => t.columnId === col.id)
      .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
  }
  const visible = tasks.filter((t) => t.columnId);
  const done = visible.filter((t) => t.done).length;
  return { columns, tasksByColumn, done, total: visible.length };
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
  const cur = ids(doc, COLS).filter((x, i, a) => a.indexOf(x) === i);
  const from = cur.indexOf(id);
  if (from === -1) return;
  const next = cur.filter((x) => x !== id);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, id);
  doc.setList(COLS, next);
}

export function deleteColumn(doc: WalDocument, id: string, opts: { moveTasksTo?: string | null } = {}): void {
  const tasks = readBoard(doc).tasksByColumn[id] ?? [];
  if (opts.moveTasksTo && opts.moveTasksTo !== id) {
    const target = opts.moveTasksTo;
    let order = (readBoard(doc).tasksByColumn[target]?.at(-1)?.order ?? 0) + 1;
    for (const t of tasks) {
      moveTask(doc, t.id, target, order);
      order += 1;
    }
  } else {
    for (const t of tasks) deleteTask(doc, t.id);
  }
  doc.setList(COLS, ids(doc, COLS).filter((x) => x !== id));
  doc.deleteField(colTitle(id));
  doc.deleteField(colDone(id));
}

export function seedDefaultColumns(doc: WalDocument): void {
  addColumn(doc, 'To do');
  addColumn(doc, 'In progress');
  setColumnDone(doc, addColumn(doc, 'Done'), true);
}

export function addTask(doc: WalDocument, columnId: string, title: string, order?: number): string {
  const id = randomId();
  const siblings = readBoard(doc).tasksByColumn[columnId] ?? [];
  const resolved = order ?? (siblings.at(-1)?.order ?? 0) + 1;
  doc.setField(taskCol(id), columnId);
  doc.setField(taskTitle(id), title);
  doc.setField(taskStatus(id), 'todo');
  doc.setField(taskOrder(id), resolved);
  doc.push(TASKS, id);
  return id;
}

export function duplicateTask(doc: WalDocument, source: Task, order: number): string {
  const id = randomId();
  doc.setField(taskCol(id), source.columnId);
  doc.setField(taskTitle(id), source.title);
  doc.setField(taskStatus(id), source.status);
  if (source.notes) doc.setField(taskNotes(id), source.notes);
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

export function updateTask(doc: WalDocument, id: string, patch: { title?: string; notes?: string }): void {
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

/**
 * Undo a {@link deleteTask}: re-insert the id and rewrite every register from
 * the pre-delete snapshot. Each `setField` is a fresh LWW write stamped after
 * the delete's tombstones, so it wins the merge.
 */
export function restoreTask(doc: WalDocument, task: Task): void {
  doc.setField(taskCol(task.id), task.columnId);
  doc.setField(taskTitle(task.id), task.title);
  doc.setField(taskStatus(task.id), task.status);
  doc.setField(taskNotes(task.id), task.notes);
  doc.setField(taskOrder(task.id), task.order);
  if (!ids(doc, TASKS).includes(task.id)) doc.push(TASKS, task.id);
}
