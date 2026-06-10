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
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
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

  // Workspace scope: pages + boards only. Nesting is via sub-pages (Notion/Anytype
  // style), not folders — any legacy folder node is filtered out and buildTree
  // reparents its children to the forest root.
  const tree = useMemo(
    () => buildTree(nodes.filter((n) => n.type === 'page' || n.type === 'board')),
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
  // Per-row "add child": creates a sub-page nested under the row (Notion/Anytype
  // style), so hierarchy is buildable from the tree itself, not only at the root.
  const addChild = (node: ObjectTreeNode) => newPage(node.id);

  if (hero && loaded && tree.length === 0) {
    return <WorkEmpty onNewPage={() => newPage()} onNewBoard={() => newBoard()} disabled={!ready} />;
  }

  const list =
    tree.length > 0 ? (
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
    );

  // Main-pane "home": lead with prominent create actions, then the labelled list.
  if (hero) {
    return (
      <View style={styles.home}>
        <View style={styles.homeActions}>
          <Button label="New page" variant="primary" size="md" iconName="plus" disabled={!ready} onPress={() => newPage()} />
          <Button label="New board" variant="secondary" size="md" iconName="plus" disabled={!ready} onPress={() => newBoard()} />
        </View>
        <Txt variant="caption" weight="semibold" tone="inkMuted" style={styles.sectionLabel}>
          Pages &amp; boards
        </Txt>
        {list}
      </View>
    );
  }

  // Sidebar: the tree, then quiet create links beneath it.
  return (
    <View style={styles.panel}>
      {list}
      <View style={styles.creates}>
        <CreateControl label="New page" iconName="file" onPress={() => newPage()} disabled={!ready} />
        <CreateControl label="New board" iconName="layers" onPress={() => newBoard()} disabled={!ready} />
      </View>
    </View>
  );
}

function CreateControl({ label, iconName, onPress, disabled }: { label: string; iconName: IconName; onPress: () => void; disabled?: boolean }) {
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
      <Icon name={iconName} size={15} color={hovered ? colors.accent : colors.inkMuted} />
      <Txt variant="footnote" weight="medium" tone="inkSoft">{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 2 },
  home: { gap: spacing.xs },
  homeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  sectionLabel: { paddingHorizontal: spacing.sm, marginBottom: spacing.xs },
  empty: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  creates: { marginTop: spacing.sm, gap: 1 },
  create: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7, paddingHorizontal: spacing.sm, borderRadius: radii.md },
});
