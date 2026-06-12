/**
 * Status strip for task objects — column (status group) selector + done toggle.
 * Rendered above the page editor when a task is opened as a first-class object.
 */
import { useRef, useState } from 'react';
import type { View as ViewType } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { paperBorder, radii, spacing } from '@/theme';
import { useBoard } from '@/lib/use-board';
import type { TaskStatus } from '@/lib/use-board';
import { tapFeedback } from '@/lib/haptics';
import { useHover } from '@/lib/use-hover';
import { useResponsive } from '@/lib/use-responsive';
import { propsOf } from '@drakkar.software/octovault-sdk';
import { useSpaceObjects } from '@/lib/space-objects-context';
import { useTheme } from '@/lib/use-theme';
import { Icon } from '@/components/ui/Icon';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/Menu';
import { Popover } from '@/components/ui/Popover';
import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';

interface TaskPropsStripProps {
  spaceId: string;
  taskId: string;
}

export function TaskPropsStrip({ spaceId, taskId }: TaskPropsStripProps) {
  const { colors } = useTheme();
  const { objects } = useSpaceObjects();
  const node = objects.get(taskId);
  const boardId = node?.parentId ?? '';
  const { board } = useBoard(spaceId, boardId, { enabled: !!boardId });
  const { isWide } = useResponsive();

  const props = node ? propsOf(node) : {};
  const columnId = (props.columnId as string | undefined) ?? '';
  const status = (props.status as TaskStatus | undefined) ?? 'todo';

  const doneCol = board.columns.find((c) => c.done);
  const currentCol = board.columns.find((c) => c.id === columnId);
  const done = doneCol ? !!currentCol?.done : status === 'done';

  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colAnchorRef = useRef<ViewType>(null);

  const toggleDone = () => {
    tapFeedback();
    if (doneCol) {
      if (done) {
        const firstOpen = board.columns.find((c) => !c.done);
        if (firstOpen) objects.setProps(taskId, { columnId: firstOpen.id, status: 'todo' });
      } else {
        objects.setProps(taskId, { columnId: doneCol.id, status: 'done' });
      }
    } else {
      objects.setProps(taskId, { status: done ? 'todo' : 'done' });
    }
  };

  const moveToColumn = (colId: string) => {
    setColMenuOpen(false);
    if (colId !== columnId) objects.setProps(taskId, { columnId: colId });
  };

  const colMenu = (
    <Menu>
      <MenuLabel>Move to column</MenuLabel>
      {board.columns.map((c) => (
        <MenuItem
          key={c.id}
          label={c.title || 'Untitled'}
          checked={c.id === columnId}
          onPress={c.id === columnId ? undefined : () => moveToColumn(c.id)}
        />
      ))}
    </Menu>
  );

  return (
    <View style={[styles.strip, paperBorder(colors), { backgroundColor: colors.fill }]}>
      <DoneToggle done={done} onToggle={toggleDone} />

      {board.columns.length > 0 ? (
        <>
          <View style={styles.divider} />
          <View ref={colAnchorRef} collapsable={false}>
            <ColPill
              label={currentCol?.title || 'No column'}
              onPress={() => setColMenuOpen(true)}
            />
          </View>
          {isWide ? (
            <Popover visible={colMenuOpen} onClose={() => setColMenuOpen(false)} anchorRef={colAnchorRef} placement="bottom-start">
              {colMenu}
            </Popover>
          ) : (
            <Sheet visible={colMenuOpen} onClose={() => setColMenuOpen(false)} title="Move to column">
              {colMenu}
            </Sheet>
          )}
        </>
      ) : null}
    </View>
  );
}

function DoneToggle({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={done ? 'Mark not done' : 'Mark done'}
      onPress={onToggle}
      hitSlop={8}
      {...hoverProps}
      style={({ pressed }) => [
        styles.doneBtn,
        { backgroundColor: pressed ? colors.pressed : hovered ? colors.hover : 'transparent' },
      ]}
    >
      <Icon
        name={done ? 'square-check' : 'square'}
        size={18}
        color={done ? colors.success : colors.inkFaint}
      />
      <Txt variant="micro" weight="bold" mono uppercase tone={done ? 'success' : 'inkMuted'}>
        {done ? 'Done' : 'Open'}
      </Txt>
    </Pressable>
  );
}

function ColPill({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Column: ${label}`}
      onPress={onPress}
      {...hoverProps}
      style={({ pressed }) => [
        styles.colPill,
        { backgroundColor: pressed ? colors.pressed : hovered ? colors.hover : 'transparent' },
      ]}
    >
      <Txt variant="caption" tone="inkMuted" numberOfLines={1}>{label}</Txt>
      <Icon name="chevron-down" size={11} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  divider: { width: 1, height: 16, backgroundColor: 'currentColor', opacity: 0.15 },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  colPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    maxWidth: 160,
  },
});
