import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { opacity, radii, spacing } from '@/theme';
import { useSpaceObjects } from '@/lib/space-objects-context';
import { buildTree, type ObjectTreeNode } from '@/lib/starfish/objects';
import { isContainerType } from '@/lib/object-types';
import type { ID } from '@/lib/types';
import { useTheme } from '@/lib/use-theme';
import { useHover } from '@/lib/use-hover';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';
import { ObjectTree, useTreeCollapse } from '@/components/objects/ObjectTree';

import { WorkEmpty } from './WorkEmpty';

/**
 * The OctoVault workspace surface: the space's pages, boards and folders from the
 * unified object index (the ONE shared store — see {@link useSpaceObjects}),
 * rendered as the collapsible {@link ObjectTree} used elsewhere. Folders are pure
 * containers (toggle-only); pages/boards open into the main pane. Create controls —
 * including per-folder "add child" — sit in a footer / on row hover.
 */
export function WorkObjects({ spaceId, hero }: { spaceId: string | null; hero?: boolean }) {
  const router = useRouter();
  const { objects } = useSpaceObjects();
  const { nodes, create, ready, loaded } = objects;
  const { collapsed, toggle } = useTreeCollapse();

  // Workspace scope: pages + boards + folders. buildTree reparents any node whose
  // parent was filtered out to the forest root.
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

  const newPage = (parentId?: ID) => {
    const id = create({ type: 'page', title: 'Untitled', emoji: '📄', parentId });
    if (id) router.push({ pathname: '/work/page/[id]', params: { id, spaceId: spaceId ?? '', emoji: '📄', label: 'Untitled' } });
  };
  const newBoard = (parentId?: ID) => {
    const id = create({ type: 'board', title: 'Untitled', emoji: '🗂️', parentId });
    if (id) router.push({ pathname: '/work/board/[id]', params: { id, spaceId: spaceId ?? '', emoji: '🗂️', label: 'Untitled' } });
  };
  // Folders are containers, not content — create and expand, never navigate.
  const newFolder = (parentId?: ID) => {
    const id = create({ type: 'folder', title: 'New folder', emoji: '📁', parentId });
    if (id && collapsed.has(id)) toggle(id);
  };

  // Per-row "add child": a page inside a folder, else a sub-page. Keeps hierarchy
  // buildable from the tree itself rather than only at the root.
  const addChild = (node: ObjectTreeNode) => newPage(node.id);

  if (hero && loaded && tree.length === 0) {
    return <WorkEmpty onNewPage={() => newPage()} onNewBoard={() => newBoard()} disabled={!ready} />;
  }

  return (
    <View style={styles.panel}>
      {tree.length > 0 ? (
        <ObjectTree
          nodes={tree}
          onOpen={openNode}
          collapsed={collapsed}
          onToggle={toggle}
          onAddChild={ready ? addChild : undefined}
          isContainer={isContainerType}
        />
      ) : (
        <Txt variant="caption" tone="inkFaint" style={styles.empty}>
          {loaded ? 'No pages or boards yet.' : 'Opening workspace…'}
        </Txt>
      )}
      <View style={styles.creates}>
        <CreateControl label="New page" onPress={() => newPage()} disabled={!ready} />
        <CreateControl label="New board" onPress={() => newBoard()} disabled={!ready} />
        <CreateControl label="New folder" onPress={() => newFolder()} disabled={!ready} />
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
