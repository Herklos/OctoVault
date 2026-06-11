import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { layout, spacing } from '@/theme';
import { AppBar } from '@/components/ui/AppBar';
import { Stage } from '@/components/ui/Stage';
import { StackScreen } from '@/components/ui/StackScreen';
import { TrashList } from '@/components/objects/TrashList';

/** Archived view for the active space — the soft-delete safety net behind every
 *  Archive verb in the tree/menus. Thin route: data + actions live in
 *  {@link TrashList} (shared index store); this only frames and navigates. */
export default function SpaceTrashScreen() {
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/work'));

  return (
    <StackScreen
      scroll
      contentStyle={styles.content}
      header={<AppBar title="Archived" onBack={goBack} />}
    >
      <Stage maxWidth={layout.listMaxWidth} style={styles.stage}>
        <TrashList />
      </Stage>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  stage: { gap: spacing.sm },
});
