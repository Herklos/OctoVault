import { Pressable, StyleSheet, View } from 'react-native';

import { radii, spacing } from '@/theme';
import type { PropField } from '@drakkar.software/octovault-sdk';
import type { PropValue } from '@drakkar.software/octovault-sdk';
import { useTheme } from '@/lib/use-theme';
import { AutosaveField } from '@/components/ui/AutosaveField';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';

interface PropertyFieldProps {
  field: PropField;
  value: PropValue;
  onChange: (v: PropValue) => void;
}

/** Renders one typed property field for a Record object. */
export function PropertyField({ field, value, onChange }: PropertyFieldProps) {
  const { colors } = useTheme();

  const renderInput = () => {
    switch (field.kind) {
      case 'checkbox':
        return (
          <Pressable
            onPress={() => onChange(!value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!value }}
            style={[styles.checkbox, { borderColor: colors.lineSoft, backgroundColor: value ? colors.accent : 'transparent' }]}
          >
            {value ? <Icon name="check" size={12} color={colors.onAccent} /> : null}
          </Pressable>
        );

      case 'select':
        return (
          <View style={styles.selectWrap}>
            {field.options?.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => onChange(value === opt.id ? null : opt.id)}
                style={[styles.selectPill, { backgroundColor: value === opt.id ? colors.accent : colors.hover }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: value === opt.id }}
              >
                <Txt variant="caption" style={{ color: value === opt.id ? colors.onAccent : colors.ink }}>
                  {opt.label}
                </Txt>
              </Pressable>
            )) ?? <Txt variant="caption" tone="inkMuted">No options defined.</Txt>}
          </View>
        );

      case 'number':
        return (
          <AutosaveField
            initialText={value != null ? String(value) : ''}
            onCommit={(t) => {
              const n = parseFloat(t);
              onChange(isNaN(n) ? null : n);
            }}
            placeholder="0"
            accessibilityLabel={field.label}
          />
        );

      default:
        return (
          <AutosaveField
            initialText={value != null ? String(value) : ''}
            onCommit={(t) => onChange(t || null)}
            placeholder={`${field.label}…`}
            accessibilityLabel={field.label}
          />
        );
    }
  };

  return (
    <View style={styles.row}>
      <Txt variant="caption" mono tone="inkMuted" style={styles.label}>{field.label}</Txt>
      <View style={styles.input}>{renderInput()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: spacing.controlMinHeight },
  label: { width: 96, flexShrink: 0 },
  input: { flex: 1 },
  checkbox: { width: 22, height: 22, borderRadius: radii.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  selectWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  selectPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.md },
});
