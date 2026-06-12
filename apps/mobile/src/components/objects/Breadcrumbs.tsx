import { Fragment, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { View as ViewType } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import { useHover } from '@/lib/use-hover';
import { useResponsive } from '@/lib/use-responsive';
import { useTheme } from '@/lib/use-theme';
import type { ObjectNode } from '@drakkar.software/octovault-sdk';
import { Icon } from '@/components/ui/Icon';
import { Menu, MenuItem } from '@/components/ui/Menu';
import { Popover } from '@/components/ui/Popover';
import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';

/** Past this many crumbs (ancestors + current) the middle collapses into an "…"
 *  that opens the hidden ancestors as a menu — a 6-deep path stays one quiet line. */
const MAX_VISIBLE_CRUMBS = 4;

interface BreadcrumbsProps {
  /** Root→parent ancestor trail (EXCLUSIVE of the current node), e.g. from
   *  `useObjects().ancestors(id)`. Every crumb here is an ancestor and navigable. */
  trail: ObjectNode[];
  /** Navigate to the tapped ancestor. */
  onNavigate?: (node: ObjectNode) => void;
  /** The node being viewed, rendered as a NON-pressable terminal crumb — the
   *  desktop topbar shows the full path including "you are here" (Notion's one
   *  statement of identity), while in-content mobile trails omit it. */
  current?: { title: string; emoji?: string };
}

/** Ancestor path for a page/board detail screen — walks the `parentId` chain from
 *  the root down (plus, optionally, the current node as a terminal crumb) so a
 *  deeply-nested sub-page shows where it lives. Deep paths middle-truncate into an
 *  "…" crumb that reveals the hidden ancestors. Renders nothing when empty. */
export function Breadcrumbs({ trail, onNavigate, current }: BreadcrumbsProps) {
  const { colors } = useTheme();
  const total = trail.length + (current ? 1 : 0);
  if (total === 0) return null;

  // Middle truncation: keep the root and the last two entries (parent + current,
  // or the two nearest ancestors), fold the rest behind an ellipsis menu.
  let head: ObjectNode[] = trail;
  let hidden: ObjectNode[] = [];
  let tail: ObjectNode[] = [];
  if (total > MAX_VISIBLE_CRUMBS) {
    const keepTail = current ? 1 : 2;
    head = trail.slice(0, 1);
    tail = trail.slice(trail.length - keepTail);
    hidden = trail.slice(1, trail.length - keepTail);
  }

  const sep = (key: string) => (
    <View key={key} style={styles.sep}>
      <Icon name="chev" size={12} color={colors.inkFaint} />
    </View>
  );

  const parts: { key: string; node: ReactNode }[] = [];
  for (const node of head) parts.push({ key: node.id, node: <Crumb node={node} onNavigate={onNavigate} /> });
  if (hidden.length > 0) parts.push({ key: '…', node: <EllipsisCrumb nodes={hidden} onNavigate={onNavigate} /> });
  for (const node of tail) parts.push({ key: node.id, node: <Crumb node={node} onNavigate={onNavigate} /> });
  if (current) parts.push({ key: 'current', node: <CurrentCrumb title={current.title} emoji={current.emoji} /> });

  return (
    <View style={styles.row}>
      {parts.map((p, i) => (
        <Fragment key={p.key}>
          {i > 0 ? sep(`sep-${p.key}`) : null}
          {p.node}
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
      accessibilityLabel={node.title || 'Untitled'}
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

/** The terminal "you are here" crumb: full ink, never pressable — the document is
 *  already open, so making it a button would only promise a no-op. */
function CurrentCrumb({ title, emoji }: { title: string; emoji?: string }) {
  return (
    <View style={styles.crumb}>
      {emoji ? <Txt variant="footnote" style={styles.emoji}>{emoji}</Txt> : null}
      <Txt variant="footnote" weight="medium" numberOfLines={1}>
        {title || 'Untitled'}
      </Txt>
    </View>
  );
}

/** The folded middle of a deep path. Pressing reveals the hidden ancestors as a
 *  menu — anchored popover on wide screens, bottom sheet on narrow ones — so every
 *  level stays reachable even when the trail truncates. */
function EllipsisCrumb({ nodes, onNavigate }: { nodes: ObjectNode[]; onNavigate?: (node: ObjectNode) => void }) {
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const { hovered, hoverProps } = useHover();
  const [open, setOpen] = useState(false);
  const ref = useRef<ViewType>(null);

  const menu = (
    <Menu>
      {nodes.map((n) => (
        <MenuItem
          key={n.id}
          label={`${n.emoji ? `${n.emoji} ` : ''}${n.title || 'Untitled'}`}
          onPress={() => {
            setOpen(false);
            onNavigate?.(n);
          }}
        />
      ))}
    </Menu>
  );

  return (
    <>
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={`Show ${nodes.length} hidden levels`}
        hitSlop={6}
        onPress={() => setOpen(true)}
        {...hoverProps}
        style={[styles.crumb, { backgroundColor: hovered ? colors.hover : 'transparent' }]}
      >
        <Txt variant="footnote" weight="medium" tone={hovered ? 'inkSoft' : 'inkMuted'}>
          …
        </Txt>
      </Pressable>
      {isWide ? (
        <Popover visible={open} onClose={() => setOpen(false)} anchorRef={ref} placement="bottom-start">
          {menu}
        </Popover>
      ) : (
        <Sheet visible={open} onClose={() => setOpen(false)} title="Path">
          {menu}
        </Sheet>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 1, paddingBottom: spacing.xs },
  sep: { marginHorizontal: 1 },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: layout.breadcrumbCrumbMaxWidth, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radii.sm },
  emoji: { fontSize: 13 },
});
