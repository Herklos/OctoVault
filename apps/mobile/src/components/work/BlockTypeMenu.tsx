import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import { BLOCK_TYPES } from '@/lib/blocks';
import { useHover } from '@/lib/use-hover';
import { useTheme } from '@/lib/use-theme';
import type { BlockType } from '@/lib/use-page';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';

interface BlockTypeMenuProps {
  /** Whether the menu is open. */
  visible: boolean;
  /** Optional currently-selected type (shown checked) — set when changing a block's type. */
  current?: BlockType;
  /** Sheet heading — "Add block" when inserting, "Turn into" when changing type. */
  title?: string;
  onSelect: (type: BlockType) => void;
  /** When set (changing an existing block), a "Delete block" action is shown — the
   *  Notion-style way to remove a block from its handle menu. */
  onDelete?: () => void;
  onClose: () => void;
}

/**
 * Block-type picker — the shared menu for both inserting a new block (gutter "+")
 * and changing an existing block's type (gutter grip). Lists every
 * {@link BLOCK_TYPES} entry with its icon + label. Cross-platform: a bottom-sheet
 * `Modal` (the {@link TaskDetailSheet} pattern) so it works identically on web and
 * native without an anchored-popover positioning layer.
 */
export function BlockTypeMenu({ visible, current, title = 'Add block', onSelect, onDelete, onClose }: BlockTypeMenuProps) {
  const { colors } = useTheme();
  const { hovered: delHovered, hoverProps: delHover } = useHover();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityLabel="Dismiss">
        <Pressable style={[styles.sheet, { backgroundColor: colors.paper }]} onPress={() => undefined}>
          <View style={styles.head}>
            <Txt variant="micro" weight="bold" mono uppercase tone="inkFaint">{title}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}>
              <Icon name="x" size={16} color={colors.inkMuted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {BLOCK_TYPES.map((def) => (
              <BlockTypeRow key={def.type} icon={def.icon} label={def.label} active={def.type === current} onPress={() => onSelect(def.type)} />
            ))}
          </ScrollView>
          {onDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete block"
              onPress={onDelete}
              {...delHover}
              style={[styles.delete, { borderTopColor: colors.lineSoft, backgroundColor: delHovered ? colors.dangerBg : 'transparent' }]}
            >
              <Icon name="trash" size={16} color={colors.danger} />
              <Txt variant="subhead" weight="medium" tone="danger" style={styles.rowLabel}>Delete block</Txt>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function BlockTypeRow({ icon, label, active, onPress }: { icon: IconName; label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  const bg = active ? colors.accentBg : hovered ? colors.hover : 'transparent';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Turn into ${label}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      {...hoverProps}
      style={[styles.row, { backgroundColor: bg }]}
    >
      <Icon name={icon} size={16} color={active ? colors.accent : colors.inkMuted} />
      <Txt variant="subhead" tone={active ? 'accent' : 'ink'} style={styles.rowLabel}>{label}</Txt>
      {active ? <Icon name="check" size={15} color={colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: layout.editorMaxWidth, maxHeight: '70%', paddingBottom: spacing.lg, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  list: { paddingHorizontal: spacing.sm, gap: spacing.none },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md },
  rowLabel: { flex: 1 },
  delete: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs, marginHorizontal: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderRadius: radii.md },
});
