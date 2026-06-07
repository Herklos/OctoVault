import { useCallback, useMemo } from 'react';

import { isPublicSpaceId } from './starfish/pubspace';
import { boardLogName } from './starfish/paths';
import { useSession } from './session-context';
import { useRoomOpen } from './use-room-open-flow';
import { useRoomLiveSync } from './use-room-live-sync';
import { useWalDoc } from './use-wal-doc';
import * as board from './board-model';
import type { Board, TaskStatus } from './board-model';

export type { Board, Column, Task, TaskStatus } from './board-model';

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
  /** Returns the new task id (or undefined before the doc is open). */
  addTask: (columnId: string, title: string) => string | undefined;
  moveTask: (id: string, columnId: string, order: number) => void;
  changeStatus: (id: string, status: TaskStatus) => void;
  updateTask: (id: string, patch: { title?: string; notes?: string }) => void;
  deleteTask: (id: string) => void;
}

/**
 * One `board` Object's kanban content, backed by a {@link WalDocument} (CRDT
 * op-log). Columns + per-task fields are CRDT registers/lists, so concurrent
 * task moves/edits from two devices converge after a pull — no append-fold replay.
 * v1 is private (E2EE) spaces only.
 */
export function useBoard(spaceId: string, boardId: string, opts: { enabled?: boolean } = {}): BoardHook {
  const { session } = useSession();
  const enabled = (opts.enabled ?? true) && !!spaceId && !!boardId && !isPublicSpaceId(spaceId);

  const { encryptor, client, opening, openError, offline, reload: reopenSpace } = useRoomOpen({
    roomId: boardId,
    spaceId,
    isPublic: false,
    enabled,
    initializeRoom: false,
  });

  const { doc, ready, version, touch, pull, reload: reloadDoc } = useWalDoc({
    client,
    encryptor,
    documentKey: boardLogName(spaceId, boardId),
    edPubHex: session?.keys.edPub,
    edPrivHex: session?.keys.edPriv,
    enabled: enabled && !!client && !!encryptor,
  });

  useRoomLiveSync({ roomId: boardId, ready, pull, skipFirstFocus: true, firstFocusKey: boardId });

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
    opening: enabled ? opening : false,
    openError,
    offline,
    reload: () => {
      reopenSpace();
      reloadDoc();
    },
    addColumn: (title) => mut((d) => board.addColumn(d, title)),
    renameColumn: (id, title) => mut((d) => board.renameColumn(d, id, title)),
    addTask: (columnId, title) => mut((d) => board.addTask(d, columnId, title)),
    moveTask: (id, columnId, order) => mut((d) => board.moveTask(d, id, columnId, order)),
    changeStatus: (id, status) => mut((d) => board.changeStatus(d, id, status)),
    updateTask: (id, patch) => mut((d) => board.updateTask(d, id, patch)),
    deleteTask: (id) => mut((d) => board.deleteTask(d, id)),
  };
}
