import { useEffect, useMemo } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import { iconForNode } from '@drakkar.software/octovault-sdk';
import {
  QUICK_FIND_SCOPE,
  closeQuickFind,
  quickFindKeyHandlers,
  toggleQuickFind,
  useQuickFind,
  useQuickFindVisible,
  type QuickFind,
  type QuickFindItem,
} from '@/lib/use-quick-find';
import { useShortcut, useShortcutScope } from '@/lib/use-shortcuts';
import type { MatchRange } from '@drakkar.software/octovault-sdk';
import { useTheme } from '@/lib/use-theme';

import { Icon } from './Icon';
import { MenuLabel } from './Menu';
import { Sheet } from './Sheet';
import { TextField } from './TextField';
import { Txt } from './Txt';

/**
 * Quick Find — the mod+K jump-anywhere overlay (THE signature Notion
 * interaction) plus {@link QuickFindResults}, the result list it shares with
 * the mobile Search tab so both surfaces are one feature with two shells.
 *
 * Mounted ONCE in `AppFrame`; renders nothing while closed. All state and
 * navigation live in `lib/use-quick-find` — this file is purely presentation:
 * a Sheet dialog (bottom sheet on narrow viewports) holding an autofocused
 * input and the dense result rows.
 */

/** Title with the matched spans bolded in accent ink — the eye lands on WHY a
 *  row matched without the row shouting (no background highlight). */
function HighlightedTitle({ title, ranges }: { title: string; ranges: MatchRange[] }) {
  const display = title || 'Untitled';
  // Recents / untitled rows carry no ranges — render the plain title.
  if (!title || !ranges.length) {
    return (
      <Txt variant="callout" weight="medium" tone={title ? 'ink' : 'inkMuted'} numberOfLines={1}>
        {display}
      </Txt>
    );
  }
  const parts: { text: string; hit: boolean }[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) parts.push({ text: title.slice(pos, r.start), hit: false });
    parts.push({ text: title.slice(r.start, r.end), hit: true });
    pos = r.end;
  }
  if (pos < title.length) parts.push({ text: title.slice(pos), hit: false });
  return (
    <Txt variant="callout" weight="medium" numberOfLines={1}>
      {parts.map((p, i) =>
        p.hit ? (
          <Txt key={i} variant="callout" weight="bold" tone="accentInk">
            {p.text}
          </Txt>
        ) : (
          p.text
        ),
      )}
    </Txt>
  );
}

/** One selectable result/command row. Pointer hover MOVES the shared selection
 *  (instead of painting its own wash) so keyboard and mouse always agree on
 *  which row Enter will open — the Notion behavior. */
function QuickFindRow({ item, active, onPress, onHover }: { item: QuickFindItem; active: boolean; onPress: () => void; onHover: () => void }) {
  const { colors } = useTheme();
  const leading =
    item.kind === 'node' ? (
      item.node.emoji ? (
        <Txt variant="callout">{item.node.emoji}</Txt>
      ) : (
        <Icon name={iconForNode(item.node)} size={16} color={colors.inkMuted} />
      )
    ) : (
      <Icon name={item.icon} size={16} color={colors.inkMuted} />
    );
  const caption = item.kind === 'node' ? item.path : undefined;
  const trailing = item.kind === 'node' ? item.when : item.hint;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.kind === 'node' ? item.node.title || 'Untitled' : item.label}
      onPress={onPress}
      onHoverIn={onHover}
      style={({ pressed }) => [
        styles.row,
        active && { backgroundColor: colors.selected },
        pressed && { backgroundColor: colors.pressed },
      ]}
    >
      <View style={styles.leading}>{leading}</View>
      <View style={styles.rowText}>
        {item.kind === 'node' ? (
          <HighlightedTitle title={item.node.title} ranges={item.ranges} />
        ) : (
          <Txt variant="callout" weight="medium" numberOfLines={1}>
            {item.label}
          </Txt>
        )}
        {caption ? (
          <Txt variant="caption" tone="inkMuted" numberOfLines={1}>
            {caption}
          </Txt>
        ) : null}
      </View>
      {trailing ? (
        <Txt variant="caption" mono tone="inkFaint">
          {trailing}
        </Txt>
      ) : null}
    </Pressable>
  );
}

/** A flattened render plan: items interleaved with their section labels and
 *  the contextual notices, so FlatList and the plain map share one shape. */
type RenderRow =
  | { type: 'label'; key: string; text: string }
  | { type: 'notice'; key: string; text: string }
  | { type: 'item'; key: string; item: QuickFindItem; index: number };

function buildRows(find: QuickFind): RenderRow[] {
  const rows: RenderRow[] = [];
  if (find.noMatches) {
    rows.push({ type: 'notice', key: 'notice:none', text: `No matches for “${find.query.trim()}”.` });
  } else if (!find.query.trim() && !find.items.some((i) => i.kind === 'node')) {
    rows.push({ type: 'notice', key: 'notice:fresh', text: 'Pages and boards you open appear here.' });
  }
  find.items.forEach((item, index) => {
    if (item.section) rows.push({ type: 'label', key: `label:${item.section}:${index}`, text: item.section });
    rows.push({ type: 'item', key: item.key, item, index });
  });
  return rows;
}

interface QuickFindResultsProps {
  find: QuickFind;
  /** Own the scroll (FlatList) — the full-screen Search tab. Off inside the
   *  palette, whose Sheet already scrolls and whose result cap fits the card. */
  scroll?: boolean;
}

/** The shared result list — palette body on desktop, Search-tab body on phones. */
export function QuickFindResults({ find, scroll = false }: QuickFindResultsProps) {
  const rows = useMemo(() => buildRows(find), [find]);

  const renderRow = (row: RenderRow) => {
    switch (row.type) {
      case 'label':
        return <MenuLabel>{row.text}</MenuLabel>;
      case 'notice':
        return (
          <Txt variant="caption" tone="inkMuted" style={styles.notice}>
            {row.text}
          </Txt>
        );
      case 'item':
        return (
          <QuickFindRow
            item={row.item}
            active={row.index === find.selected}
            onPress={() => find.activate(row.index)}
            onHover={() => find.setSelected(row.index)}
          />
        );
    }
  };

  if (!scroll) return <View>{rows.map((row) => <View key={row.key}>{renderRow(row)}</View>)}</View>;
  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={({ item }) => renderRow(item)}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.list}
      contentContainerStyle={styles.listContent}
    />
  );
}

/** Result cap inside the palette card — everything stays visible without the
 *  card scrolling, so arrow-key selection never leaves the viewport. */
const PALETTE_LIMIT = 8;

/**
 * The mod+K overlay itself. Self-binds its shortcut (toggle globally, close
 * within its own scope) and pushes {@link QUICK_FIND_SCOPE} while open so the
 * shell's global bindings (mod+N…) go quiet underneath. Keyboard navigation
 * rides the INPUT's key events (the field keeps focus for the palette's whole
 * life), not extra window bindings — one channel, no double-fires.
 */
export function CommandPalette() {
  const visible = useQuickFindVisible();
  const find = useQuickFind({ limit: PALETTE_LIMIT, onNavigate: closeQuickFind });

  useShortcut('mod+k', toggleQuickFind, { allowInInput: true });
  useShortcut('mod+k', closeQuickFind, { scope: QUICK_FIND_SCOPE, allowInInput: true });
  useShortcutScope(QUICK_FIND_SCOPE, visible);

  // Fresh query + selection every open (Notion resets too) — stale state makes
  // the palette feel like a page, not a launcher.
  const { setQuery, setSelected } = find;
  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelected(0);
    }
  }, [visible, setQuery, setSelected]);

  if (!visible) return null;

  // `align="top"` pins the card high (Notion-style) so the result list grows
  // downward instead of re-centering the card on every keystroke.
  return (
    <Sheet visible onClose={closeQuickFind} width={layout.quickFindWidth} align="top">
      <TextField
        leadingIcon="search"
        value={find.query}
        onChangeText={find.setQuery}
        placeholder={find.spaceName ? `Search ${find.spaceName}…` : 'Search…'}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="go"
        blurOnSubmit={false}
        {...quickFindKeyHandlers(find)}
      />
      <QuickFindResults find={find} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    // Web stays dense (Notion-tight rows); touch keeps the tap-target floor.
    minHeight: Platform.OS === 'web' ? undefined : spacing.controlMinHeight,
  },
  // Fixed leading column so titles align whether the glyph is an emoji or an icon.
  leading: { width: spacing.xl, alignItems: 'center' },
  rowText: { flex: 1, gap: 2 },
  notice: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.xxl },
});
