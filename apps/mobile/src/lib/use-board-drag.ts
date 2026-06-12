/**
 * Web pointer drag-and-drop for the kanban board — the one interaction that
 * makes a board a board. Deliberately NOT a gesture library: column widths are
 * fixed (`layout.boardColumnWidth`) and card stacks are vertical, so hit
 * testing is plain arithmetic over rects measured ONCE at drag start
 * (`measureInWindow` + per-card `onLayout`), and the drop itself is a single
 * fractional-order `moveTask` write (see `orderBetween` in board-model) — no
 * sibling renumbering, fully CRDT-safe.
 *
 * Interaction contract (mirrors Notion):
 *  - mousedown arms a candidate; the drag only STARTS past a small movement
 *    threshold, so a plain click still opens the card peek;
 *  - while dragging, the source card dims and the live target renders as a
 *    column wash (`colors.dropTarget`) + an accent insertion line — the card
 *    itself never floats (restraint over a chasing ghost);
 *  - mouseup commits via `onDrop`; Escape cancels; a just-ended drag swallows
 *    the click that mouseup would otherwise fire (`consumeClick`).
 *
 * Native has no pointer: everything here collapses to inert no-ops (the card
 * context menu's Move up/down/to rows are the touch path).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { View, ViewProps } from 'react-native';
import { Platform } from 'react-native';

import type { Task } from './board-content';

/** Pointer travel (px) before a pressed card becomes a drag, not a click. */
const DRAG_THRESHOLD = 5;

export interface DropTarget {
  columnId: string;
  /** Insertion index within the target column's CURRENT card list (the dragged
   *  card included when it lives there — `dropOrder` compensates). */
  index: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A card's vertical band inside its column's card stack (from `onLayout`). */
interface CardBand {
  y: number;
  h: number;
}

export interface BoardDrag {
  /** Id of the card being dragged, or null when idle. */
  draggingId: string | null;
  /** Live drop target while dragging (null until the rects are measured). */
  target: DropTarget | null;
  /** Spread onto a card's wrapper to arm dragging (web-only mousedown). */
  dragProps: (taskId: string, columnId: string) => Partial<ViewProps>;
  /** Attach to each column's CARD-STACK container so it can be hit-tested. */
  registerColumn: (columnId: string, ref: View | null) => void;
  /** Feed each card's `onLayout` band (relative to the card stack). */
  registerCard: (columnId: string, taskId: string, band: CardBand | null) => void;
  /** True exactly once right after a drag ended — card `onPress` handlers call
   *  this first and bail, so the drop's mouseup doesn't also open the peek. */
  consumeClick: () => boolean;
}

interface UseBoardDragOptions {
  /** Column order — drives which stacks get measured at drag start. */
  columnIds: string[];
  /** Current card lists per column (for index → neighbor resolution). */
  tasksByColumn: Record<string, Task[]>;
  /** Commit the drop. `index` counts within the FULL current list of the
   *  target column (including the dragged card when same-column). */
  onDrop: (taskId: string, columnId: string, index: number) => void;
  enabled?: boolean;
}

const isWeb = Platform.OS === 'web';

export function useBoardDrag({ columnIds, tasksByColumn, onDrop, enabled = true }: UseBoardDragOptions): BoardDrag {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);

  // Everything the move handler needs lives in refs: mousemove fires far too
  // often to round-trip through React state.
  const columnViews = useRef(new Map<string, View>());
  const columnRects = useRef(new Map<string, Rect>());
  const cardBands = useRef(new Map<string, Map<string, CardBand>>());
  const session = useRef<{
    taskId: string;
    fromColumnId: string;
    startX: number;
    startY: number;
    started: boolean;
  } | null>(null);
  const targetRef = useRef<DropTarget | null>(null);
  const clickSwallow = useRef(false);

  // Live mirrors so the (once-registered) window listeners see fresh data.
  const tasksRef = useRef(tasksByColumn);
  tasksRef.current = tasksByColumn;
  const columnIdsRef = useRef(columnIds);
  columnIdsRef.current = columnIds;
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const registerColumn = useCallback((columnId: string, ref: View | null) => {
    if (ref) columnViews.current.set(columnId, ref);
    else columnViews.current.delete(columnId);
  }, []);

  const registerCard = useCallback((columnId: string, taskId: string, band: CardBand | null) => {
    let perCol = cardBands.current.get(columnId);
    if (!perCol) {
      perCol = new Map();
      cardBands.current.set(columnId, perCol);
    }
    if (band) perCol.set(taskId, band);
    else perCol.delete(taskId);
  }, []);

  /** Snapshot every column stack's window rect — once, at drag start. The
   *  rects go stale if the page scrolls mid-drag; acceptable for v1 (the strip
   *  is the dominant scroller and a drag rarely outlives a wheel gesture). */
  const measureColumns = useCallback(() => {
    columnRects.current.clear();
    for (const [id, view] of columnViews.current) {
      view.measureInWindow((x, y, w, h) => {
        columnRects.current.set(id, { x, y, w, h });
      });
    }
  }, []);

  const resolveTarget = useCallback((px: number, py: number): DropTarget | null => {
    // Pick the column whose horizontal band contains the pointer; fall back to
    // the nearest band so dragging past the strip edge still targets the end
    // columns instead of dropping the gesture.
    let best: { id: string; rect: Rect } | null = null;
    let bestDist = Infinity;
    for (const id of columnIdsRef.current) {
      const rect = columnRects.current.get(id);
      if (!rect) continue;
      const dist = px < rect.x ? rect.x - px : px > rect.x + rect.w ? px - (rect.x + rect.w) : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = { id, rect };
      }
    }
    if (!best) return null;
    const tasks = tasksRef.current[best.id] ?? [];
    const bands = cardBands.current.get(best.id);
    const relY = py - best.rect.y;
    let index = tasks.length;
    for (let i = 0; i < tasks.length; i++) {
      const band = bands?.get(tasks[i]!.id);
      if (!band) continue;
      if (relY < band.y + band.h / 2) {
        index = i;
        break;
      }
    }
    return { columnId: best.id, index };
  }, []);

  const endDrag = useCallback((commit: boolean) => {
    const s = session.current;
    const t = targetRef.current;
    session.current = null;
    targetRef.current = null;
    if (s?.started) {
      // Swallow the click this mouseup will synthesize on the card.
      clickSwallow.current = true;
      setTimeout(() => {
        clickSwallow.current = false;
      }, 0);
      if (commit && t) onDropRef.current(s.taskId, t.columnId, t.index);
    }
    setDraggingId(null);
    setTarget(null);
    if (isWeb && typeof document !== 'undefined') {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, []);

  // One listener set for the whole board, alive only while a press is armed
  // or a drag runs — registered on mousedown, removed on mouseup/Escape.
  const listeners = useRef<{ move: (e: MouseEvent) => void; up: (e: MouseEvent) => void; key: (e: KeyboardEvent) => void } | null>(null);
  const detach = useCallback(() => {
    const l = listeners.current;
    if (!l || typeof window === 'undefined') return;
    window.removeEventListener('mousemove', l.move, true);
    window.removeEventListener('mouseup', l.up, true);
    window.removeEventListener('keydown', l.key, true);
    listeners.current = null;
  }, []);

  const attach = useCallback(() => {
    if (typeof window === 'undefined' || listeners.current) return;
    const move = (e: MouseEvent) => {
      const s = session.current;
      if (!s) return;
      if (!s.started) {
        if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < DRAG_THRESHOLD) return;
        s.started = true;
        measureColumns();
        setDraggingId(s.taskId);
        document.body.style.cursor = 'grabbing';
        // Without this, dragging across card titles smears a text selection.
        document.body.style.userSelect = 'none';
      }
      const next = resolveTarget(e.clientX, e.clientY);
      targetRef.current = next;
      setTarget((prev) => (prev?.columnId === next?.columnId && prev?.index === next?.index ? prev : next));
    };
    const up = () => {
      endDrag(true);
      detach();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        endDrag(false);
        detach();
      }
    };
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mouseup', up, true);
    window.addEventListener('keydown', key, true);
    listeners.current = { move, up, key };
  }, [measureColumns, resolveTarget, endDrag, detach]);

  // Never leave window listeners (or a grabbing cursor) behind on unmount.
  useEffect(
    () => () => {
      detach();
      if (isWeb && typeof document !== 'undefined') {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    },
    [detach],
  );

  const dragProps = useCallback(
    (taskId: string, columnId: string): Partial<ViewProps> => {
      if (!isWeb || !enabled) return {};
      // `onMouseDown` is a web-only DOM prop RNW forwards on a View — absent
      // from RN's types (the useRowHover idiom).
      return {
        onMouseDown: (e: { button?: number; clientX: number; clientY: number }) => {
          if (e.button !== undefined && e.button !== 0) return;
          session.current = { taskId, fromColumnId: columnId, startX: e.clientX, startY: e.clientY, started: false };
          attach();
        },
      } as unknown as Partial<ViewProps>;
    },
    [enabled, attach],
  );

  const consumeClick = useCallback(() => {
    if (!clickSwallow.current) return false;
    clickSwallow.current = false;
    return true;
  }, []);

  return useMemo(
    () => ({ draggingId, target, dragProps, registerColumn, registerCard, consumeClick }),
    [draggingId, target, dragProps, registerColumn, registerCard, consumeClick],
  );
}
