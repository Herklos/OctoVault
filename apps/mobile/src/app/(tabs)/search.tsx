import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { spacing } from '@/theme';
import { iconForNode } from '@/lib/object-types';
import { useObjects } from '@/lib/use-objects';
import { useSpaces } from '@/lib/use-spaces';
import type { ObjectNode } from '@/lib/types';
import { AppBar } from '@/components/ui/AppBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Row } from '@/components/ui/Row';
import { StackScreen } from '@/components/ui/StackScreen';
import { TextField } from '@/components/ui/TextField';

/** Workspace search — filter the active space's pages + boards by title. (Full-text
 *  block search over the WAL documents is a future addition.) */
export default function SearchScreen() {
  const { spaces, activeId } = useSpaces();
  const space = spaces.find((s) => s.id === activeId) ?? spaces[0];
  const { nodes } = useObjects(space?.id ?? '', { enabled: !!space });
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const results = useMemo(
    () =>
      q.length < 1
        ? []
        : nodes
            .filter((n) => (n.type === 'page' || n.type === 'board') && n.title.toLowerCase().includes(q))
            .slice(0, 50),
    [nodes, q],
  );

  const open = (n: ObjectNode) =>
    router.push({
      pathname: n.type === 'board' ? '/work/board/[id]' : '/work/page/[id]',
      params: { id: n.id, spaceId: space?.id ?? '', emoji: n.emoji ?? '', label: n.title },
    });

  return (
    <StackScreen header={<AppBar title="Search" />} contentStyle={styles.content}>
      <TextField
        leadingIcon="search"
        value={query}
        onChangeText={setQuery}
        placeholder="Search pages & boards…"
        autoCorrect={false}
        autoCapitalize="none"
      />
      {q.length < 1 ? (
        <EmptyState iconName="search" title="Search your workspace" subtitle="Find pages and boards by title." />
      ) : results.length === 0 ? (
        <EmptyState iconName="search" title="No matches" subtitle={`Nothing for “${query.trim()}”.`} />
      ) : (
        results.map((n) => (
          <Row key={n.id} iconName={iconForNode(n)} title={n.title || 'Untitled'} onPress={() => open(n)} />
        ))
      )}
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.screenX, paddingTop: spacing.md, gap: spacing.md, maxWidth: 680, width: '100%', alignSelf: 'center' },
});
