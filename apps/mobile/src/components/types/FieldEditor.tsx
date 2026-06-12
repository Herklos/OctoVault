import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radii, spacing } from '@/theme';
import type { FieldDef, PropKind } from '@drakkar.software/octovault-sdk';
import { useTheme } from '@/lib/use-theme';
import { AutosaveField } from '@/components/ui/AutosaveField';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';

const PROP_KINDS: PropKind[] = ['text', 'number', 'select', 'date', 'checkbox', 'url', 'relation'];

interface FieldEditorProps {
  field: FieldDef;
  onPatch: (patch: Partial<FieldDef>) => void;
  onRemove: () => void;
}

export function FieldEditor({ field, onPatch, onRemove }: FieldEditorProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.wrap, { borderColor: colors.lineSoft, backgroundColor: colors.paper }]}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.header} accessibilityRole="button" accessibilityLabel={`Edit field ${field.label}`}>
        <Txt variant="subhead" weight="medium" style={styles.flex}>{field.label || field.key || 'Unnamed field'}</Txt>
        <Txt variant="caption" mono tone="inkMuted" style={styles.kind}>{field.kind}</Txt>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.inkMuted} />
      </Pressable>
      {expanded ? (
        <View style={styles.body}>
          <Txt variant="caption" mono uppercase tone="inkMuted">Label</Txt>
          <AutosaveField
            initialText={field.label}
            onCommit={(t) => onPatch({ label: t.trim() || field.key })}
            placeholder="Field label…"
            accessibilityLabel="Field label"
          />
          <Txt variant="caption" mono uppercase tone="inkMuted">Type</Txt>
          <View style={styles.kinds}>
            {PROP_KINDS.map((k) => (
              <Pressable
                key={k}
                onPress={() => onPatch({ kind: k })}
                style={[styles.kindPill, { backgroundColor: field.kind === k ? colors.accent : colors.hover }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: field.kind === k }}
              >
                <Txt variant="caption" mono weight={field.kind === k ? 'bold' : undefined} style={{ color: field.kind === k ? colors.onAccent : colors.ink }}>
                  {k}
                </Txt>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onRemove} style={styles.remove} accessibilityRole="button" accessibilityLabel="Remove field">
            <Icon name="trash" size={14} color={colors.danger} />
            <Txt variant="caption" style={{ color: colors.danger }}>Remove field</Txt>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: radii.md, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  flex: { flex: 1 },
  kind: { marginRight: spacing.xs },
  body: { gap: spacing.sm, padding: spacing.md, paddingTop: 0 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  kindPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.md },
  remove: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
});
