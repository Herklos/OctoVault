import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import type { PropField } from '@/lib/object-types';
import type { PropValue } from '@/lib/types';
import { Txt } from '@/components/ui/Txt';
import { PropertyField } from './PropertyField';

interface PropertyPanelProps {
  spaceId: string;
  objectId: string;
  fields: PropField[];
  props: Record<string, PropValue>;
  onSetProp: (key: string, value: PropValue) => void;
}

export function PropertyPanel({ fields, props, onSetProp }: PropertyPanelProps) {
  if (fields.length === 0) {
    return (
      <Txt variant="caption" tone="inkMuted" style={styles.empty}>
        No fields defined for this type yet.
      </Txt>
    );
  }

  return (
    <View style={styles.fields}>
      {fields.map((f) => (
        <PropertyField
          key={f.key}
          field={f}
          value={props[f.key] ?? null}
          onChange={(v) => onSetProp(f.key, v)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing.sm },
  empty: { fontStyle: 'italic' },
});
