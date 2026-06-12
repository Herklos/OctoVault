import { useCallback, useMemo } from 'react';

import { useObjectContent } from './use-object-content';
import * as board from './board-content';
import type { Board, Task, TaskStatus } from './board-content';

export type { Board, Column, Task, TaskStatus } from './board-content';
export { orderBetween } from './board-content';

const EMPTY_BOARD: Board = { columns: [], tasksByColumn: {}, done: 0, total: 0 };

export interface BoardHook {
  board: Board;
  ready: boolean;
  opening: boolean;
  openError: string | null;
  offline: boolean;
  reload: () => void;
  /** Returns the new column id (or undefined before the doc is open). */
  addColumn: (title: string) => string | undefined;
  renameColumn: (id: string, title: string) => void;
  /** Reorder a column to `toIndex` within the strip. */
  moveColumn: (id: string, toIndex: number) => void;
  /** Flag/unflag a column as the board's "Done" group (cards in it count done). */
  setColumnDone: (id: string, done: boolean) => void;
  /** Delete a column; its cards re-home to `moveTasksTo` or are deleted with it. */
  deleteColumn: (id: string, opts?: { moveTasksTo?: string | null }) => void;
  /** Seed the canonical To do / In progress / Done starter columns. */
  seedColumns: () => void;
  /** Returns the new task id (or undefined before the doc is open). `order`
   *  defaults to appending after the column's last card. */
  addTask: (columnId: string, title: string, order?: number) => string | undefined;
  /** Copy a card into `order` within its column; returns the new id. */
  duplicateTask: (source: Task, order: number) => string | undefined;
  moveTask: (id: string, columnId: string, order: number) => void;
  changeStatus: (id: string, status: TaskStatus) => void;
  updateTask: (id: string, patch: { title?: string; notes?: string }) => void;
  deleteTask: (id: string) => void;
  /** Undo a delete from the pre-delete snapshot (drives the toast's "Undo"). */
  restoreTask: (task: Task) => void;
}

/**
 * One `board` Object's kanban content, backed by a {@link WalDocument} (CRDT op-log).
 * Thin wrapper over {@link useObjectContent} + {@link board-content} ops.
 */
export function useBoard(spaceId: string, boardId: string, opts: { enabled?: boolean } = {}): BoardHook {
  const { walDoc: doc, ready, version, touch, opening, openError, offline, reload } = useObjectContent(
    spaceId,
    boardId,
    'append',
    opts,
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const folded = useMemo<Board>(() => (doc ? board.readBoard(doc) : EMPTY_BOARD), [doc, version]);

  const mut = useCallback(
    <T,>(fn: (d: NonNullable<typeof doc>) => T): T | undefined => {
      if (!doc) return undefined;
      const r = fn(doc);
      touch();
      return r;
    },
    [doc, touch],
  );

  return {
    board: folded,
    ready,
    opening,
    openError,
    offline,
    reload,
    addColumn: (title) => mut((d) => board.addColumn(d, title)),
    renameColumn: (id, title) => mut((d) => board.renameColumn(d, id, title)),
    moveColumn: (id, toIndex) => mut((d) => board.moveColumn(d, id, toIndex)),
    setColumnDone: (id, done) => mut((d) => board.setColumnDone(d, id, done)),
    deleteColumn: (id, opts) => mut((d) => board.deleteColumn(d, id, opts)),
    seedColumns: () => mut((d) => board.seedDefaultColumns(d)),
    addTask: (columnId, title, order) => mut((d) => board.addTask(d, columnId, title, order)),
    duplicateTask: (source, order) => mut((d) => board.duplicateTask(d, source, order)),
    moveTask: (id, columnId, order) => mut((d) => board.moveTask(d, id, columnId, order)),
    changeStatus: (id, status) => mut((d) => board.changeStatus(d, id, status)),
    updateTask: (id, patch) => mut((d) => board.updateTask(d, id, patch)),
    deleteTask: (id) => mut((d) => board.deleteTask(d, id)),
    restoreTask: (task) => mut((d) => board.restoreTask(d, task)),
  };
}
