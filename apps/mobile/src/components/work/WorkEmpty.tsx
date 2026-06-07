import { StyleSheet, View } from 'react-native';

import { paperBorder, radii, spacing } from '@/theme';
import { useTheme } from '@/lib/use-theme';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';

const FACETS: { iconName: IconName; label: string; meta: string }[] = [
  { iconName: 'file', label: 'Pages', meta: 'Nested blocks, merged per keystroke' },
  { iconName: 'work', label: 'Boards', meta: 'Kanban that converges across devices' },
];

/**
 * Empty state for the workspace — shown once the object index has loaded and holds
 * no pages/boards (gated on `loaded`). Built on the shared {@link EmptyState} with two
 * LIVE create CTAs wired to `useObjects.create` and a chip per content type.
 */
export function WorkEmpty({ onNewPage, onNewBoard, disabled }: { onNewPage: () => void; onNewBoard: () => void; disabled?: boolean }) {
  return (
    <View style={styles.floor}>
      <EmptyState
        iconName="book"
        title="Your encrypted workspace"
        subtitle="Pages of blocks and kanban boards — end-to-end-encrypted and CRDT-synced across your devices. Create your first one to begin."
      >
        <View style={styles.actions}>
          <Button label="New page" variant="primary" iconName="plus" size="sm" disabled={disabled} onPress={onNewPage} />
          <Button label="New board" variant="secondary" iconName="plus" size="sm" disabled={disabled} onPress={onNewBoard} />
        </View>
        <View style={styles.facets}>
          {FACETS.map((f) => (
            <FacetChip key={f.label} iconName={f.iconName} label={f.label} meta={f.meta} />
          ))}
        </View>
      </EmptyState>
    </View>
  );
}

function FacetChip({ iconName, label, meta }: { iconName: IconName; label: string; meta: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.chip, paperBorder(colors)]}>
      <Icon name={iconName} size={15} color={colors.accent} />
      <View style={styles.chipText}>
        <Txt variant="footnote" weight="semibold">{label}</Txt>
        <Txt variant="caption" tone="inkMuted" numberOfLines={1}>{meta}</Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floor: { minHeight: 320 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  facets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg, borderWidth: 1 },
  chipText: { minWidth: 0, gap: 1 },
});
