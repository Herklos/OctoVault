import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import { EMOJI_CATEGORIES, searchEmoji, type EmojiCategory, type EmojiMatch } from '@drakkar.software/octovault-sdk';
import { tapFeedback } from '@/lib/haptics';
import { useHover } from '@/lib/use-hover';
import { useResponsive } from '@/lib/use-responsive';
import { useTheme } from '@/lib/use-theme';

import { Icon } from './Icon';
import { Popover } from './Popover';
import { Sheet } from './Sheet';
import { TextField } from './TextField';
import { Txt } from './Txt';

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  /** Receives the chosen glyph, or `null` for "Remove icon". The picker closes itself. */
  onSelect: (emoji: string | null) => void;
  /** Trigger to anchor to — enables the popover presentation on wide screens. */
  anchorRef?: RefObject<View | null>;
  /** The object's current icon; when set, a "Remove icon" row appears. */
  current?: string | null;
}

/**
 * Searchable icon picker for pages, boards and spaces — the curated shortcode
 * table from `lib/emoji.ts` rendered as a category-sectioned glyph grid with a
 * filter field on top (matches any alias name: "thumbsup" and "+1" both find
 * 👍). Presents anchored in a {@link Popover} on wide screens (pass
 * `anchorRef`) and as a bottom {@link Sheet} on phones.
 */
export function EmojiPicker({ visible, onClose, onSelect, anchorRef, current }: EmojiPickerProps) {
  const { isWide, height } = useResponsive();
  const [query, setQuery] = useState('');

  // Fresh search each open; reset on the open edge so closing never flashes.
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const pick = (emoji: string | null) => {
    tapFeedback();
    onSelect(emoji);
    onClose();
  };

  // The grid scrolls inside the surface; cap it to half the viewport so the
  // popover stays anchored and the sheet leaves the page visible behind it.
  const gridMaxHeight = Math.round(height * 0.5);

  const body = (
    <View style={styles.body}>
      <TextField
        leadingIcon="search"
        placeholder="Filter…"
        accessibilityLabel="Search emoji"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        // Pop the caret straight into search on web; on touch, let the user
        // browse the grid first instead of springing the keyboard open.
        autoFocus={Platform.OS === 'web'}
      />
      {current ? <RemoveIconRow onPress={() => pick(null)} /> : null}
      <ScrollView
        style={{ maxHeight: gridMaxHeight }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {query.trim() ? (
          <SearchResults query={query} onPick={pick} />
        ) : (
          EMOJI_CATEGORIES.map((cat: EmojiCategory) => (
            <View key={cat.id}>
              <Txt variant="micro" weight="semibold" mono uppercase tone="inkMuted" style={styles.section}>
                {cat.label}
              </Txt>
              <EmojiGrid items={cat.emoji} onPick={pick} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  if (isWide && anchorRef) {
    return (
      <Popover
        visible={visible}
        onClose={onClose}
        anchorRef={anchorRef}
        placement="bottom-start"
        width={layout.popoverWidth}
      >
        {/* The popover card is padding-free chrome (menus pad themselves);
            the sheet pads its own body, so this wrapper is popover-only. */}
        <View style={styles.popoverPad}>{body}</View>
      </Popover>
    );
  }
  return (
    <Sheet visible={visible} onClose={onClose} title="Icon">
      {body}
    </Sheet>
  );
}

interface SearchResultsProps {
  query: string;
  onPick: (emoji: string) => void;
}

function SearchResults({ query, onPick }: SearchResultsProps) {
  const results = searchEmoji(query);
  if (results.length === 0) {
    return (
      <Txt variant="callout" tone="inkMuted" center style={styles.empty}>
        No emoji found
      </Txt>
    );
  }
  return <EmojiGrid items={results} onPick={onPick} />;
}

interface EmojiGridProps {
  items: EmojiMatch[];
  onPick: (emoji: string) => void;
}

/** ~8-up glyph grid: fractional cells so density adapts to the surface width. */
function EmojiGrid({ items, onPick }: EmojiGridProps) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <EmojiCell key={item.glyph} item={item} onPick={onPick} />
      ))}
    </View>
  );
}

interface EmojiCellProps {
  item: EmojiMatch;
  onPick: (emoji: string) => void;
}

function EmojiCell({ item, onPick }: EmojiCellProps) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.code.replace(/_/g, ' ')}
      onPress={() => onPick(item.glyph)}
      {...hoverProps}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor: pressed ? colors.pressed : hovered ? colors.hover : 'transparent' },
      ]}
    >
      <Txt variant="title" center>
        {item.glyph}
      </Txt>
    </Pressable>
  );
}

interface RemoveIconRowProps {
  onPress: () => void;
}

/** Quiet "Remove icon" row — clears the icon back to the ghost affordance. */
function RemoveIconRow({ onPress }: RemoveIconRowProps) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Remove icon"
      onPress={onPress}
      {...hoverProps}
      style={({ pressed }) => [
        styles.removeRow,
        { backgroundColor: pressed ? colors.pressed : hovered ? colors.hover : 'transparent' },
      ]}
    >
      <Icon name="x" size={14} color={colors.inkMuted} />
      <Txt variant="callout" tone="inkMuted">
        Remove icon
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.sm,
  },
  popoverPad: {
    padding: spacing.md,
  },
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Fraction-based cells: exactly 8 columns whatever the surface width, square
  // via aspectRatio — popovers get a dense grid, phone sheets near-44px targets.
  cell: {
    flexBasis: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  empty: {
    paddingVertical: spacing.xl,
  },
});

export type { EmojiPickerProps };
