import { Pressable, StyleSheet, View } from 'react-native';

import { radii, spacing, swatch, SWATCH_NAMES, type SwatchName } from '@/theme';
import { useTheme } from '@/lib/use-theme';

interface ColorPickerProps {
  value: string | undefined;
  onChange: (name: SwatchName | undefined) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { scheme } = useTheme();
  return (
    <View style={styles.row}>
      {SWATCH_NAMES.map((name) => {
        const s = swatch(scheme, name);
        const selected = value === name;
        return (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityLabel={name}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(selected ? undefined : name)}
            style={[styles.dot, { backgroundColor: s.solid, borderWidth: selected ? 2 : 0, borderColor: s.text }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dot: { width: 26, height: 26, borderRadius: radii.pill },
});
