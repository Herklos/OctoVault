import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { useTypeRegistry } from '@/lib/type-registry-context';
import { useSpaceObjects } from '@/lib/space-objects-context';
import { useTheme } from '@/lib/use-theme';
import { propsOf } from '@drakkar.software/octovault-sdk';
import { EmptyState } from '@/components/ui/EmptyState';
import { Txt } from '@/components/ui/Txt';
import { PropertyPanel } from './PropertyPanel';

interface RecordViewProps {
  spaceId: string;
  objectId: string;
}

/** Generic structured-data view for objects with editor:'record'.
 *  Renders the type's declared property fields as editable inputs. */
export function RecordView({ spaceId, objectId }: RecordViewProps) {
  const { objects } = useSpaceObjects();
  const registry = useTypeRegistry();
  const node = objects.get(objectId);

  if (!node) {
    return <EmptyState iconName="layers" title="Object not found" />;
  }

  const descriptor = registry.descriptor(node.type);

  return (
    <View style={styles.wrap}>
      <Txt variant="micro" weight="bold" mono uppercase tone="inkMuted" style={styles.sectionLabel}>
        {descriptor.label}
      </Txt>
      <PropertyPanel
        spaceId={spaceId}
        objectId={objectId}
        fields={descriptor.props}
        props={propsOf(node)}
        onSetProp={(key, value) => objects.setProps(objectId, { [key]: value })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, padding: spacing.lg },
  sectionLabel: { marginBottom: spacing.xs },
});
