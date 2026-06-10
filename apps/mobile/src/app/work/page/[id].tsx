import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { layout, spacing } from '@/theme';
import { useSpaces } from '@/lib/use-spaces';
import { useSpaceObjects } from '@/lib/space-objects-context';
import { AppBar } from '@/components/ui/AppBar';
import { Stage } from '@/components/ui/Stage';
import { StackScreen } from '@/components/ui/StackScreen';
import { Breadcrumbs } from '@/components/objects/Breadcrumbs';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ObjectActions } from '@/components/objects/ObjectActions';
import { PageView } from '@/components/work/PageView';

/** Page viewer — live block content + ancestor breadcrumbs for one `page` Object.
 *  Reads node metadata + rename from the ONE shared index store (see
 *  {@link useSpaceObjects}) so a rename here refreshes the sidebar/tree instantly. */
export default function WorkPageScreen() {
  const router = useRouter();
  const { activeId, setActiveId } = useSpaces();
  const { id, spaceId: spaceParam, emoji, label } = useLocalSearchParams<{ id: string; spaceId?: string; emoji?: string; label?: string }>();
  const spaceId = spaceParam || activeId || '';
  // The shared store is bound to the active space; align it with this route's space
  // (a no-op in normal navigation, only acts on a cross-space deep link).
  useEffect(() => {
    if (spaceId && spaceId !== activeId) setActiveId(spaceId);
  }, [spaceId, activeId, setActiveId]);

  const { objects } = useSpaceObjects();
  const { ancestors, get, rename, archive } = objects;
  const trail = ancestors(id);
  const node = get(id);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/work'));
  const openCrumb = (nid: string, type: string) =>
    router.push({ pathname: type === 'board' ? '/work/board/[id]' : '/work/page/[id]', params: { id: nid, spaceId } });

  return (
    <StackScreen
      scroll
      contentStyle={styles.content}
      header={
        <AppBar
          title={node?.title || label || 'Page'}
          subtitle="Workspace"
          onBack={goBack}
          right={<ObjectActions node={node} onRename={(patch) => rename(id, patch)} onArchive={() => { archive(id); goBack(); }} />}
        />
      }
    >
      <Stage maxWidth={layout.editorMaxWidth} style={styles.stage}>
        <Breadcrumbs trail={trail} onNavigate={(n) => openCrumb(n.id, n.type)} />
        <ErrorBoundary label="Page">
          <PageView
            spaceId={spaceId}
            objectId={id}
            emoji={node?.emoji || emoji}
            title={node?.title || label}
            onRenameTitle={(t) => rename(id, { title: t.trim() || 'Untitled' })}
          />
        </ErrorBoundary>
      </Stage>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  stage: { gap: spacing.sm },
});
