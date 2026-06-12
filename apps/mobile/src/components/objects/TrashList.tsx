import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { radii, spacing } from '@/theme';
import { plural } from '@drakkar.software/octovault-sdk';
import { useTypeRegistry } from '@/lib/type-registry-context';
import { relativeTime } from '@drakkar.software/octovault-sdk';
import { useSpaceObjects } from '@/lib/space-objects-context';
import { subtreeIds } from '@drakkar.software/octovault-sdk';
import type { ObjectNode } from '@drakkar.software/octovault-sdk';
import { useConfirm } from '@/lib/use-confirm';
import { useRowHover } from '@/lib/use-hover';
import { useTheme } from '@/lib/use-theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { Txt } from '@/components/ui/Txt';

/**
 * The archived view ("Trash"): every archived page/board subtree ROOT in the
 * active space, with Restore and Delete-forever. Archive is the app's soft
 * delete (the subtree stays in the encrypted index, just hidden), so Restore is
 * a pure un-flag — cheap and always offered. Delete-forever is the only truly
 * destructive verb in the workspace, so it alone goes through `useConfirm`.
 *
 * Only subtree ROOTS list here (an archived node whose parent is live or gone):
 * restoring a root revives its whole cascade, so listing every descendant would
 * just be noise with confusing partial-restore semantics.
 */
export function TrashList() {
  const registry = useTypeRegistry();
  const { spaceId, objects } = useSpaceObjects();
  const { allNodes, restore, purge, loaded } = objects;
  const confirm = useConfirm();
  const toast = useToast();

  const roots = useMemo(() => {
    const byId = new Map(allNodes.map((n) => [n.id, n]));
    return allNodes
      .filter(
        (n) =>
          n.archived &&
          registry.showsInWorkTree(n) &&
          (n.parentId == null || !byId.get(n.parentId)?.archived),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [allNodes, registry]);

  // Children counts give weight to a row before committing to delete-forever.
  // Archived members only — that's exactly the set restore/purge act on.
  const insideCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of roots) {
      const ids = subtreeIds(allNodes, n.id);
      let c = 0;
      for (const m of allNodes) if (m.archived && m.id !== n.id && ids.has(m.id)) c++;
      counts.set(n.id, c);
    }
    return counts;
  }, [roots, allNodes]);

  if (!spaceId || (loaded && roots.length === 0)) {
    return (
      <EmptyState
        iconName="trash"
        title="Nothing archived"
        subtitle="Pages and boards you archive land here. Restore them anytime — nothing is gone until you delete it forever."
      />
    );
  }

  if (!loaded) {
    return (
      <View style={styles.skeletons}>
        <Skeleton height={18} width="64%" />
        <Skeleton height={18} width="48%" />
        <Skeleton height={18} width="56%" />
      </View>
    );
  }

  const onRestore = (node: ObjectNode) => {
    restore(node.id);
    toast.show({ message: `${registry.descriptor(node.type).label} restored` });
  };

  const onPurge = async (node: ObjectNode) => {
    const count = insideCount.get(node.id) ?? 0;
    const title = node.title || 'Untitled';
    const ok = await confirm({
      title: 'Delete forever?',
      message:
        `“${title}”${count > 0 ? ` and the ${plural(count, 'item')} inside it` : ''} will be removed from the vault for every member. This cannot be undone.`,
      confirmLabel: 'Delete forever',
      danger: true,
    });
    if (ok) purge(node.id);
  };

  return (
    <View style={styles.list}>
      {roots.map((node) => (
        <TrashRow
          key={node.id}
          node={node}
          inside={insideCount.get(node.id) ?? 0}
          onRestore={() => onRestore(node)}
          onPurge={() => void onPurge(node)}
        />
      ))}
    </View>
  );
}

interface TrashRowProps {
  node: ObjectNode;
  /** Archived descendants riding under this root. */
  inside: number;
  onRestore: () => void;
  onPurge: () => void;
}

function TrashRow({ node, inside, onRestore, onPurge }: TrashRowProps) {
  const { colors } = useTheme();
  const registry = useTypeRegistry();
  const { hovered, hoverProps } = useRowHover();
  const caption = [`Archived ${relativeTime(node.updatedAt)}`, inside > 0 ? `${plural(inside, 'item')} inside` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View {...hoverProps} style={[styles.row, { backgroundColor: hovered ? colors.hover : 'transparent' }]}>
      {node.emoji ? (
        <Txt variant="heading" style={styles.emoji}>
          {node.emoji}
        </Txt>
      ) : (
        <View style={styles.iconWrap}>
          <Icon name={registry.iconForNode(node)} size={16} color={colors.inkMuted} />
        </View>
      )}
      <View style={styles.text}>
        <Txt variant="subhead" weight="medium" tone={node.title ? undefined : 'inkMuted'} numberOfLines={1}>
          {node.title || 'Untitled'}
        </Txt>
        <Txt variant="caption" tone="inkMuted" numberOfLines={1}>
          {caption}
        </Txt>
      </View>
      {/* Both verbs are always visible (no hover gating): on a destructive surface,
          discoverability beats minimalism — and touch has no hover anyway. */}
      <IconButton name="restore" size={16} color={colors.inkSoft} onPress={onRestore} tooltip="Restore" accessibilityLabel={`Restore ${node.title || 'Untitled'}`} />
      <IconButton name="trash" size={16} color={colors.danger} onPress={onPurge} tooltip="Delete forever" accessibilityLabel={`Delete ${node.title || 'Untitled'} forever`} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  skeletons: { gap: spacing.md, paddingVertical: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: spacing.controlMinHeight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
  },
  emoji: { width: 24, textAlign: 'center' },
  iconWrap: { width: 24, alignItems: 'center' },
  text: { flex: 1, minWidth: 0, gap: 1 },
});
