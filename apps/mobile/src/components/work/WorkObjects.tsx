import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { opacity, radii, spacing } from '@/theme';
import { useObjects } from '@/lib/use-objects';
import { buildTree, type ObjectTreeNode } from '@/lib/starfish/objects';
import { useTheme } from '@/lib/use-theme';
import { useHover } from '@/lib/use-hover';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';
import { ObjectTree, useTreeCollapse } from '@/components/objects/ObjectTree';

import { WorkEmpty } from './WorkEmpty';

/**
 * The OctoVault workspace surface: the space's pages + boards from the unified
 * object index, rendered as the same collapsible {@link ObjectTree} used elsewhere
 * (a page with sub-pages is a collapsible folder). Create controls sit in a footer.
 */
export function WorkObjects({ spaceId, hero, live }: { spaceId: string | null; hero?: boolean; live?: boolean }) {
  const router = useRouter();
  const enabled = !!spaceId;
  const { nodes, create, ready, loaded } = useObjects(spaceId ?? '', { enabled, liveSync: live });
  const { collapsed, toggle } = useTreeCollapse();

  // Workspace scope: pages + boards (+ folders for nesting). buildTree reparents any
  // node whose parent was filtered out to the forest root.
  const tree = useMemo(
    () => buildTree(nodes.filter((n) => n.type === 'page' || n.type === 'board' || n.type === 'folder')),
    [nodes],
  );

  const routeFor = (type: string) => (type === 'board' ? '/work/board/[id]' : '/work/page/[id]');
  const openNode = (node: ObjectTreeNode) =>
    router.push({
      pathname: routeFor(node.type),
      params: { id: node.id, spaceId: spaceId ?? '', emoji: node.emoji ?? '', label: node.title },
    });

  const newPage = () => {
    const id = create({ type: 'page', title: 'Untitled', emoji: '📄' });
    if (id) router.push({ pathname: '/work/page/[id]', params: { id, spaceId: spaceId ?? '', emoji: '📄', label: 'Untitled' } });
  };
  const newBoard = () => {
    const id = create({ type: 'board', title: 'Untitled', emoji: '🗂️' });
    if (id) router.push({ pathname: '/work/board/[id]', params: { id, spaceId: spaceId ?? '', emoji: '🗂️', label: 'Untitled' } });
  };

  if (hero && loaded && tree.length === 0) {
    return <WorkEmpty onNewPage={newPage} onNewBoard={newBoard} disabled={!ready} />;
  }

  return (
    <View style={styles.panel}>
      {tree.length > 0 ? (
        <ObjectTree nodes={tree} onOpen={openNode} collapsed={collapsed} onToggle={toggle} />
      ) : (
        <Txt variant="caption" tone="inkFaint" style={styles.empty}>
          {loaded ? 'No pages or boards yet.' : 'Opening workspace…'}
        </Txt>
      )}
      <View style={styles.creates}>
        <CreateControl label="New page" onPress={newPage} disabled={!ready} />
        <CreateControl label="New board" onPress={newBoard} disabled={!ready} />
      </View>
    </View>
  );
}

function CreateControl({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      {...hoverProps}
      style={[styles.create, { backgroundColor: hovered && !disabled ? colors.hover : 'transparent', opacity: disabled ? opacity.disabled : 1 }]}
    >
      <Icon name="plus" size={12} color={colors.inkMuted} />
      <Txt variant="micro" weight="bold" mono uppercase tone="inkMuted">{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 2 },
  empty: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  creates: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  create: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radii.md },
});
