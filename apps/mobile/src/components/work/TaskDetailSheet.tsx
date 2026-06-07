import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import type { Column, Task } from '@/lib/use-board';
import { useTheme } from '@/lib/use-theme';
import { AutosaveField } from '@/components/ui/AutosaveField';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';

interface TaskDetailSheetProps {
  /** The task being viewed, or null when the sheet is closed. */
  task: Task | null;
  /** All board columns, for the move-to-column picker. */
  columns: Column[];
  onRename: (taskId: string, title: string) => void;
  onSetNotes: (taskId: string, notes: string) => void;
  onMove: (taskId: string, columnId: string) => void;
  onToggleStatus: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet detail panel for one kanban task — title + Markdown notes, a done
 * toggle, a move-to-column picker, and delete. Both text fields autosave through
 * {@link AutosaveField}. Keyed by task id by the caller so switching tasks reseeds.
 */
export function TaskDetailSheet({ task, columns, onRename, onSetNotes, onMove, onToggleStatus, onDelete, onClose }: TaskDetailSheetProps) {
  const { colors } = useTheme();
  const done = task?.status === 'done';

  return (
    <Modal visible={!!task} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityLabel="Dismiss">
        <Pressable style={[styles.sheet, { backgroundColor: colors.paper }]} onPress={() => undefined}>
          {task ? (
            <>
              <View style={styles.head}>
                <Pressable accessibilityRole="button" accessibilityLabel={done ? 'Mark not done' : 'Mark done'} onPress={() => onToggleStatus(task)} hitSlop={8} style={styles.statusBtn}>
                  <Icon name={done ? 'check' : 'target'} size={16} color={done ? colors.success : colors.inkFaint} />
                  <Txt variant="micro" weight="bold" mono uppercase tone={done ? 'success' : 'inkMuted'}>{done ? 'Done' : 'Open'}</Txt>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}>
                  <Icon name="x" size={16} color={colors.inkMuted} />
                </Pressable>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                <AutosaveField key={`title-${task.id}`} initialText={task.title} onCommit={(t) => onRename(task.id, t.trim())} autoFocus={false} placeholder="Task title" accessibilityLabel="Task title" />

                <Txt variant="micro" weight="bold" mono uppercase tone="inkFaint" style={styles.label}>Notes</Txt>
                <AutosaveField key={`notes-${task.id}`} initialText={task.notes ?? ''} onCommit={(t) => onSetNotes(task.id, t)} autoFocus={false} commitEmpty multiline minHeight={layout.taskContentMinHeight} placeholder="Add details, in Markdown…" accessibilityLabel="Task notes" />

                {columns.length > 1 ? (
                  <>
                    <Txt variant="micro" weight="bold" mono uppercase tone="inkFaint" style={styles.label}>Column</Txt>
                    <View style={styles.cols}>
                      {columns.map((c) => {
                        const here = c.id === task.columnId;
                        return (
                          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Move to ${c.title}`} onPress={() => onMove(task.id, c.id)}
                            style={[styles.colChip, { borderColor: here ? colors.accent : colors.lineFaint, backgroundColor: here ? colors.accentBg : 'transparent' }]}>
                            <Txt variant="caption" tone={here ? 'accent' : 'inkMuted'}>{c.title}</Txt>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                <Pressable accessibilityRole="button" accessibilityLabel="Delete task" onPress={() => { onDelete(task.id); onClose(); }}
                  style={({ pressed }) => [styles.delete, { borderColor: colors.lineFaint }, pressed ? { backgroundColor: colors.hover } : null]}>
                  <Icon name="trash" size={14} color={colors.danger} />
                  <Txt variant="subhead" weight="semibold" tone="danger">Delete task</Txt>
                </Pressable>
              </ScrollView>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%', paddingBottom: spacing.lg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  body: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  label: { marginTop: spacing.sm },
  cols: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  colChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.pill, borderWidth: 1 },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1 },
});
