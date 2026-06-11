import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/theme';
import { useRecordVisit } from '@/lib/use-recents';
import { useSpaces } from '@/lib/use-spaces';
import { useSpaceObjects } from '@/lib/space-objects-context';
import { useTheme } from '@/lib/use-theme';
import { AppBar } from '@/components/ui/AppBar';
import { StackScreen } from '@/components/ui/StackScreen';
import { Breadcrumbs } from '@/components/objects/Breadcrumbs';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ObjectActions } from '@/components/objects/ObjectActions';
import { BoardView } from '@/components/work/BoardView';

/** Board viewer — live kanban for one `board` Object. Reads node metadata +
 *  rename from the ONE shared index store (see {@link useSpaceObjects}) so a
 *  rename here refreshes the sidebar/tree instantly.
 *
 *  Route params beyond `id`/`spaceId`:
 *   - `task`       — the open card peek (deep-linkable; cleared = closed);
 *   - `focusTitle` — create flow: hero mounts editing AND (creating device
 *     only, so it's race-safe) the board seeds its To do / In progress / Done
 *     starter columns exactly once; `seed=1` forces seeding alone. */
export default function WorkBoardScreen() {
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

  const { objects } = useSpaceObjects();
  const { ancestors, get, rename, archive } = objects;
  const trail = ancestors(id);
  const node = get(id);
  const parent = trail.at(-1);
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
      header={
        <AppBar
          title={node?.title || label || 'Board'}
          // The parent's name says WHERE this board lives — the old static
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
      <ErrorBoundary label="Board">
        <BoardView
          spaceId={spaceId}
          objectId={id}
          emoji={node?.emoji || emoji}
          title={node?.title || label}
          onRenameTitle={(t) => rename(id, { title: t.trim() || 'Untitled' })}
          onChangeEmoji={(glyph) => rename(id, { emoji: glyph ?? '' })}
          openTaskId={typeof task === 'string' && task ? task : null}
          // setParams (not push) so the peek never remounts the board screen;
          // Esc / Android back / backdrop all clear it via Sheet's onClose.
          onOpenTask={(taskId) => router.setParams({ task: taskId ?? '' })}
          // `focusTitle=1` is only ever passed by the create flow on the
          // creating device, so it doubles as the race-safe seed signal
          // (`seed=1` stays supported for explicit callers).
          seedDefaults={seed === '1' || focusTitle === '1'}
          focusTitle={focusTitle === '1'}
        />
      </ErrorBoundary>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
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
