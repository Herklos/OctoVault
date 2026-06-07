import { StyleSheet } from 'react-native';

import { spacing } from '@/theme';
import { useSpaces } from '@/lib/use-spaces';
import { AppBar } from '@/components/ui/AppBar';
import { StackScreen } from '@/components/ui/StackScreen';
import { WorkObjects } from '@/components/work/WorkObjects';

/** Vault tab — the active space's live pages + boards tree from the unified object
 *  index (see {@link WorkObjects}). Space context comes from {@link useSpaces}. */
export default function WorkScreen() {
  const { spaces, activeId } = useSpaces();
  const space = spaces.find((s) => s.id === activeId) ?? spaces[0];
  return (
    <StackScreen inTabs scroll header={<AppBar title={space?.name ?? 'Vault'} subtitle="Workspace" />} contentStyle={styles.content}>
      <WorkObjects spaceId={space?.id ?? null} hero live />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: 96 },
});
