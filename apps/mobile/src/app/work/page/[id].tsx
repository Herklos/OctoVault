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
import { AppBar } from '@/components/ui/AppBar';
import { Stage } from '@/components/ui/Stage';
import { StackScreen } from '@/components/ui/StackScreen';
import { Breadcrumbs } from '@/components/objects/Breadcrumbs';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ObjectActions } from '@/components/objects/ObjectActions';
import { PageView } from '@/components/work/PageView';

/** Page viewer — live block content for one `page` Object. Reads node metadata +
 *  rename from the ONE shared index store (see {@link useSpaceObjects}) so a
 *  rename here refreshes the sidebar/tree instantly.
 *
 *  Route params beyond `id`/`spaceId`:
 *   - `focusTitle` — set by create flows so the hero mounts with the (empty)
 *     title editor focused and the first keystroke names the page. */
export default function WorkPageScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeId, setActiveId } = useSpaces();
  const { id, spaceId: spaceParam, emoji, label, focusTitle } = useLocalSearchParams<{
    id: string;
    spaceId?: string;
    emoji?: string;
    label?: string;
    focusTitle?: string;
  }>();
  const spaceId = spaceParam || activeId || '';
  // The shared store is bound to the active space; align it with this route's space
  // (a no-op in normal navigation, only acts on a cross-space deep link).
  useEffect(() => {
    if (spaceId && spaceId !== activeId) setActiveId(spaceId);
  }, [spaceId, activeId, setActiveId]);
  useRecordVisit(spaceId, id);

  const { objects } = useSpaceObjects();
  const { ancestors, get, rename, archive } = objects;
  const trail = ancestors(id);
  const node = get(id);
  const parent = trail.at(-1);
  // Native editing accessory rendered by PageView while a block is being edited —
  // pinned here because StackScreen's footer slot is the keyboard-avoiding one.
  const [toolbar, setToolbar] = useState<ReactNode>(null);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/work'));
  const openCrumb = (nid: string, type: string) =>
    router.push({ pathname: type === 'board' ? '/work/board/[id]' : '/work/page/[id]', params: { id: nid, spaceId } });

  const actions = (
    <ObjectActions node={node} onRename={(patch) => rename(id, patch)} onArchive={() => { archive(id); goBack(); }} />
  );

  return (
    <StackScreen
      scroll
      contentStyle={styles.content}
      footer={toolbar}
      header={
        <AppBar
          title={node?.title || label || 'Page'}
          // The parent's name says WHERE this page lives — the old static
          // "Workspace" said nothing.
          subtitle={parent ? parent.title || 'Untitled' : undefined}
          onBack={goBack}
          right={actions}
        />
      }
      desktopHeader={
        <View style={[styles.topbar, { backgroundColor: colors.paper, borderBottomColor: colors.lineSoft }]}>
          <View style={styles.topbarCrumbs}>
            <Breadcrumbs trail={trail} current={node} onNavigate={(n) => openCrumb(n.id, n.type)} />
          </View>
          {actions}
        </View>
      }
    >
      <Stage maxWidth={layout.editorMaxWidth} style={styles.stage}>
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
