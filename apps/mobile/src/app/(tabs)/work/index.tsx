import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { spacing } from '@/theme';
import { useSpaces } from '@/lib/use-spaces';
import { AppBar } from '@/components/ui/AppBar';
import { IconButton } from '@/components/ui/IconButton';
import { StackScreen } from '@/components/ui/StackScreen';
import { WorkObjects } from '@/components/work/WorkObjects';

/** Vault tab — the active space's live pages + boards tree from the unified object
 *  index (see {@link WorkObjects}). Space context comes from {@link useSpaces}. A gear
 *  in the header opens the active space's details (see `app/space/[id]`). */
export default function WorkScreen() {
  const router = useRouter();
  const { spaces, activeId } = useSpaces();
  const space = spaces.find((s) => s.id === activeId) ?? spaces[0];
  return (
    <StackScreen
      inTabs
      scroll
      header={
        <AppBar
          title={space?.name ?? 'Vault'}
          subtitle="Workspace"
          right={
            space ? (
              <IconButton
                name="gear"
                onPress={() => router.push({ pathname: '/space/[id]', params: { id: space.id } })}
                accessibilityLabel="Space details"
              />
            ) : null
          }
        />
      }
      contentStyle={styles.content}
    >
      <WorkObjects spaceId={space?.id ?? null} hero />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: 96 },
});
