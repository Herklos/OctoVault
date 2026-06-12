import { Pressable, StyleSheet, View } from 'react-native';

import { radii, spacing } from '@/theme';
import { useSpaceTypes } from '@/lib/space-types-context';
import { useTheme } from '@/lib/use-theme';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Txt } from '@/components/ui/Txt';

interface TypeListProps {
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function TypeList({ onSelect, onAdd }: TypeListProps) {
  const { types } = useSpaceTypes();
  const { colors } = useTheme();

  if (!types.ready) {
    return (
      <View style={styles.list}>
        <Skeleton height={44} radius={radii.md} />
        <Skeleton height={44} radius={radii.md} />
        <Skeleton height={44} radius={radii.md} />
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {types.types.map((def) => (
        <Pressable
          key={def.id}
          onPress={() => onSelect(def.id)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.pressed : colors.hover }]}
        >
          <Icon name={(def.icon as IconName) || 'layers'} size={18} color={colors.inkMuted} />
          <View style={styles.info}>
            <Txt variant="subhead" weight="medium">{def.label}</Txt>
            <Txt variant="caption" mono tone="inkMuted">{def.editorKind} · {def.fields.length} fields</Txt>
          </View>
          <Icon name="chev" size={14} color={colors.inkMuted} />
        </Pressable>
      ))}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        style={({ pressed }) => [styles.addRow, { backgroundColor: pressed ? colors.pressed : 'transparent', borderColor: colors.lineSoft }]}
      >
        <Icon name="plus" size={16} color={colors.accent} />
        <Txt variant="subhead" style={{ color: colors.accent }}>New type</Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minHeight: spacing.controlMinHeight,
  },
  info: { flex: 1, gap: 1 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    minHeight: spacing.controlMinHeight,
  },
});
