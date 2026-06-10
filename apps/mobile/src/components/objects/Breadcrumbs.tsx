import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import { useHover } from '@/lib/use-hover';
import { useTheme } from '@/lib/use-theme';
import type { ObjectNode } from '@/lib/types';
import { Icon } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';

interface BreadcrumbsProps {
  /** Root→parent ancestor trail (EXCLUSIVE of the current node), e.g. from
   *  `useObjects().ancestors(id)`. The current node is titled on its own screen, so
   *  it is NOT a crumb — every crumb here is an ancestor and stays navigable. */
  trail: ObjectNode[];
  /** Navigate to the tapped ancestor. */
  onNavigate?: (node: ObjectNode) => void;
}

/** Ancestor path for a doc/board detail screen — walks the `parentId` chain from
 *  the root down to the parent so a deeply-nested sub-page shows where it lives. Empty
 *  (renders nothing) for a root-level node. Pure composition over `Txt`/`Icon`. */
export function Breadcrumbs({ trail, onNavigate }: BreadcrumbsProps) {
  const { colors } = useTheme();
  if (trail.length === 0) return null;
  return (
    <View style={styles.row}>
      {trail.map((node, i) => (
        <Fragment key={node.id}>
          {i > 0 ? (
            <View style={styles.sep}>
              <Icon name="chev" size={12} color={colors.inkFaint} />
            </View>
          ) : null}
          <Crumb node={node} onNavigate={onNavigate} />
        </Fragment>
      ))}
    </View>
  );
}

/** One navigable ancestor crumb with a web hover wash, so the trail reads as
 *  clickable without being loud. */
function Crumb({ node, onNavigate }: { node: ObjectNode; onNavigate?: (node: ObjectNode) => void }) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={node.title}
      disabled={!onNavigate}
      onPress={() => onNavigate?.(node)}
      {...hoverProps}
      style={[styles.crumb, { backgroundColor: hovered ? colors.hover : 'transparent' }]}
    >
      {node.emoji ? <Txt variant="footnote" style={styles.emoji}>{node.emoji}</Txt> : null}
      <Txt variant="footnote" weight="medium" tone={hovered ? 'inkSoft' : 'inkMuted'} numberOfLines={1}>
        {node.title || 'Untitled'}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 1, paddingBottom: spacing.xs },
  sep: { marginHorizontal: 1 },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: layout.breadcrumbCrumbMaxWidth, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radii.sm },
  emoji: { fontSize: 13 },
});
