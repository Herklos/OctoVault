import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/theme';
import { relativeTime } from '@/lib/relative-time';
import { useRecordVisit } from '@/lib/use-recents';
import { useSpaces } from '@/lib/use-spaces';
import { useSpaceObjects } from '@/lib/space-objects-context';
import { useTheme } from '@/lib/use-theme';
import { useTypeRegistry } from '@/lib/type-registry-context';
import { AppBar } from '@/components/ui/AppBar';
import { Stage } from '@/components/ui/Stage';
import { StackScreen } from '@/components/ui/StackScreen';
import { Breadcrumbs } from '@/components/objects/Breadcrumbs';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ObjectActions } from '@/components/objects/ObjectActions';
import { PageView } from '@/components/work/PageView';
import { BoardView } from '@/components/work/BoardView';
import { FileObjectView } from '@/components/work/FileObjectView';
import { RecordView } from '@/components/work/RecordView';
import { TaskPropsStrip } from '@/components/work/TaskPropsStrip';

/** Generic object viewer — resolves the editor from the object's type descriptor.
 *  Single route for all object types (page, board, task, file, custom). */
export default function WorkObjectScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeId, setActiveId } = useSpaces();
  const { id, spaceId: spaceParam, emoji, label, task, seed, focusTitle } = useLocalSearchParams<{
    id: string;
    spaceId?: string;
    emoji?: string;
    label?: string;
    task?: string;
    seed?: string;
    focusTitle?: string;
  }>();
  const spaceId = spaceParam || activeId || '';
  useEffect(() => {
    if (spaceId && spaceId !== activeId) setActiveId(spaceId);
  }, [spaceId, activeId, setActiveId]);
  useRecordVisit(spaceId, id);

  const registry = useTypeRegistry();
  const { objects } = useSpaceObjects();
  const { ancestors, get, rename, archive } = objects;
  const trail = ancestors(id);
  const node = get(id);
  const parent = trail.at(-1);
  const editor = node ? registry.descriptor(node.type).editor : 'page';
  const [toolbar, setToolbar] = useState<ReactNode>(null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/work'));
  const openCrumb = (nid: string) =>
    router.push({ pathname: '/work/object/[id]', params: { id: nid, spaceId } });

  const actions = (
    <ObjectActions node={node} onRename={(patch) => rename(id, patch)} onArchive={() => { archive(id); goBack(); }} />
  );

  const content =
    editor === 'record' ? (
      <Stage maxWidth={layout.editorMaxWidth} style={styles.stage}>
        <ErrorBoundary label="Record">
          <RecordView spaceId={spaceId} objectId={id} />
        </ErrorBoundary>
      </Stage>
    ) : editor === 'file' ? (
      <Stage maxWidth={layout.editorMaxWidth} style={styles.stage}>
        <ErrorBoundary label="File">
          <FileObjectView
            spaceId={spaceId}
            objectId={id}
            onRenameTitle={(t) => rename(id, { title: t.trim() || 'Untitled' })}
          />
        </ErrorBoundary>
      </Stage>
    ) : editor === 'board' ? (
      <ErrorBoundary label="Board">
        <BoardView
          spaceId={spaceId}
          objectId={id}
          emoji={node?.emoji || emoji}
          title={node?.title || label}
          onRenameTitle={(t) => rename(id, { title: t.trim() || 'Untitled Board' })}
          onChangeEmoji={(glyph) => rename(id, { emoji: glyph ?? '' })}
          seedDefaults={seed === '1'}
          focusTitle={focusTitle === '1'}
        />
      </ErrorBoundary>
    ) : (
      <Stage maxWidth={layout.editorMaxWidth} style={styles.stage}>
        {node?.type === 'task' ? (
          <TaskPropsStrip spaceId={spaceId} taskId={id} />
        ) : null}
        <ErrorBoundary label="Page">
          <PageView
            spaceId={spaceId}
            objectId={id}
            emoji={node?.emoji || emoji}
            title={node?.title || label}
            subtitle={node ? `Edited ${relativeTime(node.updatedAt)}` : undefined}
            onRenameTitle={(t) => rename(id, { title: t.trim() || 'Untitled' })}
            onChangeEmoji={(glyph) => rename(id, { emoji: glyph ?? '' })}
            focusTitle={focusTitle === '1'}
            onToolbar={setToolbar}
          />
        </ErrorBoundary>
      </Stage>
    );

  return (
    <StackScreen
      scroll={editor !== 'board'}
      contentStyle={editor !== 'board' ? styles.content : undefined}
      footer={editor !== 'board' ? toolbar : undefined}
      header={
        <AppBar
          title={node?.title || label || 'Object'}
          subtitle={parent ? parent.title || 'Untitled' : undefined}
          onBack={goBack}
          right={actions}
        />
      }
      desktopHeader={
        <View style={[styles.topbar, { backgroundColor: colors.paper, borderBottomColor: colors.lineSoft }]}>
          <View style={styles.topbarCrumbs}>
            <Breadcrumbs trail={trail} current={node} onNavigate={(n) => openCrumb(n.id)} />
          </View>
          {actions}
        </View>
      }
    >
      {content}
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  stage: { gap: spacing.sm },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.desktopTopbarHeight,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  topbarCrumbs: { flex: 1, minWidth: 0 },
});
