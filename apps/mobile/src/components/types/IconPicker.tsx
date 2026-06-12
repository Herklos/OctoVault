import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { radii, spacing } from '@/theme';
import { useTheme } from '@/lib/use-theme';
import { Icon, ICON_NAMES, type IconName } from '@/components/ui/Icon';

interface IconPickerProps {
  value: IconName | undefined;
  onChange: (name: IconName) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const { colors } = useTheme();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
      {ICON_NAMES.map((name) => {
        const selected = value === name;
        return (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityLabel={name}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(name)}
            style={[styles.cell, { backgroundColor: selected ? colors.accent : colors.hover, borderColor: selected ? colors.accent : 'transparent' }]}
          >
            <Icon name={name} size={20} color={selected ? colors.onAccent : colors.inkSoft} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 200 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, padding: spacing.xs },
  cell: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
