import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import { useRowHover } from '@/lib/use-hover';
import { useTheme } from '@/lib/use-theme';
import { iconForNode } from '@/lib/object-types';
import type { ObjectTreeNode } from '@/lib/starfish/objects';
import type { ID } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';

interface ObjectTreeProps {
  nodes: ObjectTreeNode[];
  onOpen: (node: ObjectTreeNode) => void;
  /** Ids collapsed on this device (local state lives in the parent so it survives
   *  re-render; the tree itself is stateless about persistence). */
  collapsed: Set<ID>;
  onToggle: (id: ID) => void;
  /** When set, each row reveals a "+" on hover that creates a child under it (the
   *  caller decides what kind — e.g. a page inside a folder). Web-hover affordance. */
  onAddChild?: (node: ObjectTreeNode) => void;
  /** Types that are pure containers (folders): pressing toggles instead of opening a
   *  content route. `category` is always treated as a container header. */
  isContainer?: (type: string) => boolean;
}

type RowProps = { node: ObjectTreeNode } & Omit<ObjectTreeProps, 'nodes'>;

/**
 * Recursive, collapsible object tree — the sidebar + Work surface for the unified
 * {@link ObjectTreeNode} model. Rows indent by depth; a node with children shows a
 * disclosure chevron that toggles its subtree. Folders/categories are containers
 * (toggle-only); pages/boards open. Collapse state is per-device (held by the
 * caller, not synced). Pure composition over `Icon`/`Txt` + theme tokens.
 */
export function ObjectTree({ nodes, onOpen, collapsed, onToggle, onAddChild, isContainer }: ObjectTreeProps) {
  return (
    <View>
      {nodes.map((node) => (
        <ObjectTreeRow
          key={node.id}
          node={node}
          onOpen={onOpen}
          collapsed={collapsed}
          onToggle={onToggle}
          onAddChild={onAddChild}
          isContainer={isContainer}
        />
      ))}
    </View>
  );
}

function ObjectTreeRow({ node, onOpen, collapsed, onToggle, onAddChild, isContainer }: RowProps) {
  const { colors } = useTheme();
  // Rows are plain Views (not Pressables, to keep text selection), so hover must use
  // onMouseEnter/onMouseLeave (useRowHover) — RN-web does NOT forward Pressable-style
  // onHoverIn on a View, which previously left rows un-hoverable and hid the add-child "+".
  const { hovered, hoverProps } = useRowHover();
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const isCategory = node.type === 'category';
  const container = isCategory || (isContainer?.(node.type) ?? false);

  const open = useCallback(() => {
    if (container) onToggle(node.id);
    else onOpen(node);
  }, [container, node, onOpen, onToggle]);

  return (
    <>
      <View
        {...hoverProps}
        style={[
          styles.row,
          { paddingLeft: spacing.xs + node.depth * layout.objectTreeIndent, backgroundColor: hovered ? colors.hover : 'transparent' },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isCollapsed ? 'Expand' : 'Collapse'}
          hitSlop={6}
          onPress={hasChildren || container ? () => onToggle(node.id) : undefined}
          style={styles.disclosure}
        >
          {hasChildren ? (
            <View style={isCollapsed ? undefined : styles.chevOpen}>
              <Icon name="chev" size={12} color={colors.inkFaint} />
            </View>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={node.title}
          onPress={open}
          style={styles.content}
        >
          {node.emoji ? (
            <Txt variant="subhead" style={styles.emoji}>
              {node.emoji}
            </Txt>
          ) : (
            <View style={styles.leafIcon}>
              <Icon name={iconForNode(node)} size={13} color={colors.inkMuted} />
            </View>
          )}
          <Txt
            variant={isCategory ? 'caption' : 'subhead'}
            weight={isCategory ? 'bold' : undefined}
            tone={isCategory ? 'inkMuted' : undefined}
            numberOfLines={1}
            style={styles.label}
          >
            {isCategory ? node.title.toUpperCase() : node.title}
          </Txt>
        </Pressable>
        {onAddChild && hovered && !isCategory ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add a page inside ${node.title}`}
            hitSlop={6}
            onPress={() => onAddChild(node)}
            style={styles.add}
          >
            <Icon name="plus" size={13} color={colors.inkMuted} />
          </Pressable>
        ) : null}
      </View>
      {hasChildren && !isCollapsed ? (
        <ObjectTree nodes={node.children} onOpen={onOpen} collapsed={collapsed} onToggle={onToggle} onAddChild={onAddChild} isContainer={isContainer} />
      ) : null}
    </>
  );
}

/** Caller-side hook for the per-device collapse set (keep tree rendering pure). */
export function useTreeCollapse(): { collapsed: Set<ID>; toggle: (id: ID) => void } {
  const [collapsed, setCollapsed] = useState<Set<ID>>(() => new Set());
  const toggle = useCallback((id: ID) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, height: layout.objectTreeRowHeight, paddingRight: spacing.sm, borderRadius: radii.md },
  content: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  disclosure: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  chevOpen: { transform: [{ rotate: '90deg' }] },
  emoji: { width: 18, textAlign: 'center' },
  leafIcon: { width: 18, alignItems: 'center' },
  label: { flex: 1, minWidth: 0, letterSpacing: 0 },
  add: { width: layout.rowAddButton, height: layout.rowAddButton, alignItems: 'center', justifyContent: 'center' },
});
