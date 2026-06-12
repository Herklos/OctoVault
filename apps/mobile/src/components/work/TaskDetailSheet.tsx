import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import type { Column } from '@/lib/board-content';
import type { Task } from '@/lib/task-model';
import { tapFeedback } from '@/lib/haptics';
import { useHover } from '@/lib/use-hover';
import { useResponsive } from '@/lib/use-responsive';
import { useTheme } from '@/lib/use-theme';
import { AutosaveField } from '@/components/ui/AutosaveField';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/Menu';
import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';

interface TaskDetailSheetProps {
  /** The task being viewed, or null when closed (the `?task=` param cleared). */
  task: Task | null;
  /** All board columns, for the move-to-column rows. */
  columns: Column[];
  onRename: (taskId: string, title: string) => void;
  /** Move to another column (the caller no-ops on the current one). */
  onMove: (taskId: string, columnId: string) => void;
  /** Unified done toggle — the caller derives column-vs-status semantics. */
  onToggleDone: (task: Task) => void;
  /** Delete with the caller's undo-toast flow (full Task for the snapshot). */
  onDelete: (task: Task) => void;
  onClose: () => void;
}

/**
 * Detail surface for one kanban card, on the shared {@link Sheet} primitive:
 * a right-docked side PEEK on wide screens (the board stays visible and
 * interactable-adjacent, Notion's idiom — not a centered modal hiding the very
 * board you're triaging) and a bottom sheet on phones. Driven by the route's
 * `?task=` param, so it deep-links and Esc/back/backdrop all close it.
 *
 * Title/notes autosave through {@link AutosaveField}, keyed by task id so
 * switching cards reseeds. The title autofocuses only when the card is brand
 * new (empty title) — opening an existing card is for reading first.
 */
export function TaskDetailSheet({ task, columns, onRename, onMove, onToggleDone, onDelete, onClose }: TaskDetailSheetProps) {
  const { isWide } = useResponsive();

  // Retain the last task through the Sheet's exit animation — `task` nulls the
  // instant the param clears, and an empty card mid-slide reads as a glitch
  // (the ConfirmSheet idiom).
  const lastTask = useRef<Task | null>(null);
  useEffect(() => {
    if (task) lastTask.current = task;
  }, [task]);
  const shown = task ?? lastTask.current;

  return (
    <Sheet
      visible={!!task}
      onClose={onClose}
      presentation={isWide ? 'panel' : 'sheet'}
      width={layout.peekPaneWidth}
    >
      {shown ? (
        <View style={styles.body}>
          <View style={styles.head}>
            <DoneToggle task={shown} onToggle={() => onToggleDone(shown)} />
            <IconButton name="x" size={16} onPress={onClose} accessibilityLabel="Close" tooltip="Close" shortcut="Esc" />
          </View>

          <AutosaveField
            key={`title-${shown.id}`}
            initialText={shown.title}
            onCommit={(t) => onRename(shown.id, t.trim())}
            autoFocus={!shown.title}
            plain
            textVariant="title"
            placeholder="Untitled"
            accessibilityLabel="Card title"
          />

          {columns.length > 1 ? (
            <>
              <Txt variant="micro" weight="bold" mono uppercase tone="inkFaint" style={styles.label}>Column</Txt>
              <Menu>
                <MenuLabel>Move to</MenuLabel>
                {columns.map((c) => {
                  const here = c.id === shown.columnId;
                  return (
                    <MenuItem
                      key={c.id}
                      label={c.title || 'Untitled'}
                      checked={here}
                      // The current column is information, not an action — a
                      // press must NOT silently reorder the card to its end.
                      onPress={here ? undefined : () => onMove(shown.id, c.id)}
                    />
                  );
                })}
              </Menu>
            </>
          ) : null}

          <Menu>
            <MenuItem icon="trash" label="Delete card" danger onPress={() => onDelete(shown)} />
          </Menu>
        </View>
      ) : null}
    </Sheet>
  );
}

/** The peek's done control — a real square checkbox + state word, mirroring
 *  the card face so the two never disagree. */
function DoneToggle({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={task.done ? 'Mark not done' : 'Mark done'}
      onPress={() => {
        tapFeedback();
        onToggle();
      }}
      hitSlop={8}
      {...hoverProps}
      style={({ pressed }) => [
        styles.doneBtn,
        { backgroundColor: pressed ? colors.pressed : hovered ? colors.hover : 'transparent' },
      ]}
    >
      <Icon
        name={task.done ? 'square-check' : 'square'}
        size={layout.checkboxSize}
        color={task.done ? colors.success : colors.inkFaint}
      />
      <Txt variant="micro" weight="bold" mono uppercase tone={task.done ? 'success' : 'inkMuted'}>
        {task.done ? 'Done' : 'Open'}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    minHeight: 32,
  },
  label: { marginTop: spacing.sm },
});
