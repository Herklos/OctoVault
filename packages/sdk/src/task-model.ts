/**
 * Pure projection of task {@link ObjectNode}s into the kanban view.
 *
 * A task is an ObjectNode with `type === 'task'` and `parentId === boardId`.
 * Its positional state lives in `props`: `columnId`, `order` (fractional number),
 * and the legacy `status` register (kept for boards without a Done column).
 */
import type { ObjectNode } from './domain/types';
import type { Column } from './board-content';

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id: string;
  columnId: string;
  title: string;
  status: TaskStatus;
  order: number;
  /** Derived completion — column membership when the board has a Done column,
   *  else the legacy `status` prop. Render from THIS, never from `status`. */
  done: boolean;
}

/**
 * Project task ObjectNodes into the board's view model.
 *
 * Orphaned tasks (unknown columnId) are re-homed to the first column.
 */
export function tasksForBoard(
  nodes: ObjectNode[],
  boardId: string,
  columns: Column[],
): { tasksByColumn: Record<string, Task[]>; done: number; total: number } {
  const colSet = new Set(columns.map((c) => c.id));
  const hasDoneCol = columns.some((c) => c.done);
  const doneColIds = new Set(columns.filter((c) => c.done).map((c) => c.id));
  const firstCol = columns[0]?.id ?? '';

  const tasks: Task[] = [];
  for (const node of nodes) {
    if (node.archived || node.type !== 'task' || node.parentId !== boardId) continue;
    const props = node.props ?? {};
    let columnId = (props.columnId as string | undefined) ?? '';
    if (!colSet.has(columnId)) columnId = firstCol;
    const statusRaw = props.status as string | undefined;
    const status: TaskStatus =
      statusRaw === 'doing' || statusRaw === 'done' ? statusRaw : 'todo';
    const order = typeof props.order === 'number' ? props.order : 0;
    const done = hasDoneCol ? doneColIds.has(columnId) : status === 'done';
    tasks.push({ id: node.id, columnId, title: node.title ?? '', status, order, done });
  }

  const tasksByColumn: Record<string, Task[]> = {};
  for (const col of columns) {
    tasksByColumn[col.id] = tasks
      .filter((t) => t.columnId === col.id)
      .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
  }
  const visible = tasks.filter((t) => !!t.columnId);
  const doneCount = visible.filter((t) => t.done).length;
  return { tasksByColumn, done: doneCount, total: visible.length };
}
