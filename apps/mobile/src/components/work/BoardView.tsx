import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { layout, opacity, paperBorder, radii, shadows, spacing } from '@/theme';
import { useBoard } from '@/lib/use-board';
import { isPublicSpaceId } from '@/lib/starfish/pubspace';
import { useTheme } from '@/lib/use-theme';
import { AutosaveField } from '@/components/ui/AutosaveField';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';
import { ObjectHero } from '@/components/work/ObjectHero';
import { TaskDetailSheet } from '@/components/work/TaskDetailSheet';

/**
 * Live kanban board for one `board` Object — columns + cards over a {@link useBoard}
 * WAL/CRDT document. Add column/card, toggle done, edit a card (title + notes), move
 * it between columns, and delete — each is an idempotent CRDT op, so two devices
 * converge after a pull (no append-fold). Title/emoji live on the index node.
 */
export function BoardView({ spaceId, objectId, emoji, title }: { spaceId: string; objectId: string; emoji?: string; title?: string }) {
  const { colors } = useTheme();
  const board = useBoard(spaceId, objectId);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);

  if (isPublicSpaceId(spaceId)) {
    return (
      <View style={styles.wrap}>
        <ObjectHero emoji={emoji} title={title} />
        <Callout tone="info" iconName="info">Boards live in private, end-to-end-encrypted spaces in this version.</Callout>
      </View>
    );
  }

  const { columns, tasksByColumn, done, total } = board.board;
  const openTask = openTaskId
    ? columns.map((c) => tasksByColumn[c.id]?.find((t) => t.id === openTaskId)).find(Boolean) ?? null
    : null;

  /** Move a task to the end of a target column (append after its last card). */
  const moveToEnd = (taskId: string, columnId: string) => {
    const tasks = tasksByColumn[columnId] ?? [];
    board.moveTask(taskId, columnId, (tasks.at(-1)?.order ?? 0) + 1);
  };

  return (
    <View style={styles.wrap}>
      <ObjectHero
        emoji={emoji}
        title={title}
        subtitle={`${done}/${total} done`}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add column"
            disabled={!board.ready}
            onPress={() => board.addColumn('New column')}
            style={[styles.add, { borderColor: colors.lineFaint, opacity: board.ready ? 1 : opacity.disabled }]}
          >
            <Icon name="plus" size={12} color={colors.inkMuted} />
            <Txt variant="caption" tone="inkMuted">Column</Txt>
          </Pressable>
        }
      />

      {board.offline ? <Callout tone="info" iconName="info">Offline — showing the last synced board.</Callout> : null}
      {board.openError ? <Callout tone="danger" iconName="alert">{board.openError}</Callout> : null}

      {columns.length === 0 ? (
        <Callout tone="info" iconName="info">No columns yet. Add one to start the board.</Callout>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columns}>
          {columns.map((col) => (
            <View key={col.id} style={[styles.column, paperBorder(colors), shadows.sm]}>
              <View style={styles.colHead}>
                {editingColId === col.id ? (
                  <View style={styles.colTitle}>
                    <AutosaveField
                      initialText={col.title}
                      autoFocus
                      onCommit={(t) => board.renameColumn(col.id, t.trim())}
                      onClose={() => setEditingColId((cur) => (cur === col.id ? null : cur))}
                      accessibilityLabel={`Rename column ${col.title}`}
                    />
                  </View>
                ) : (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Rename column ${col.title}`} onPress={() => setEditingColId(col.id)} style={styles.colTitle}>
                    <Txt variant="caption" weight="bold" tone="inkMuted" numberOfLines={1}>{col.title.toUpperCase()}</Txt>
                  </Pressable>
                )}
                <Txt variant="micro" mono tone="inkFaint">{(tasksByColumn[col.id] ?? []).length}</Txt>
              </View>

              {(tasksByColumn[col.id] ?? []).map((task) => {
                const taskDone = task.status === 'done';
                return (
                  <View key={task.id} style={[styles.card, { backgroundColor: colors.fill, borderColor: colors.lineFaint }]}>
                    <Pressable accessibilityRole="button" accessibilityLabel={taskDone ? 'Mark not done' : 'Mark done'} onPress={() => board.changeStatus(task.id, taskDone ? 'todo' : 'done')} hitSlop={6}>
                      <Icon name={taskDone ? 'check' : 'target'} size={13} color={taskDone ? colors.success : colors.inkFaint} />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={() => setOpenTaskId(task.id)} style={styles.cardText}>
                      <Txt variant="subhead" numberOfLines={2} style={taskDone ? styles.cardDone : undefined}>{task.title}</Txt>
                      {task.notes.trim() ? <Icon name="file" size={11} color={colors.inkFaint} /> : null}
                    </Pressable>
                  </View>
                );
              })}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add card"
                disabled={!board.ready}
                onPress={() => {
                  const id = board.addTask(col.id, 'New task');
                  if (id) setOpenTaskId(id);
                }}
                style={[styles.addCard, { borderColor: colors.lineFaint, opacity: board.ready ? 1 : opacity.disabled }]}
              >
                <Icon name="plus" size={12} color={colors.inkFaint} />
                <Txt variant="caption" tone="inkFaint">Add card</Txt>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      <TaskDetailSheet
        task={openTask}
        columns={columns}
        onRename={(id, t) => board.updateTask(id, { title: t })}
        onSetNotes={(id, n) => board.updateTask(id, { notes: n })}
        onMove={(id, col) => moveToEnd(id, col)}
        onToggleStatus={(t) => board.changeStatus(t.id, t.status === 'done' ? 'todo' : 'done')}
        onDelete={board.deleteTask}
        onClose={() => setOpenTaskId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  add: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.xs, borderWidth: 1 },
  columns: { gap: spacing.sm, paddingBottom: spacing.sm },
  column: { width: layout.boardColumnWidth, borderRadius: radii.card, borderWidth: 1, padding: spacing.sm, gap: spacing.xs },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: 2, paddingBottom: spacing.xs },
  colTitle: { flex: 1 },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, padding: spacing.sm, borderRadius: radii.md, borderWidth: 1 },
  cardText: { flex: 1, gap: spacing.xs },
  cardDone: { textDecorationLine: 'line-through', opacity: opacity.muted },
  addCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed' },
});
