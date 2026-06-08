import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import { useHover } from '@/lib/use-hover';
import { useResponsive } from '@/lib/use-responsive';
import { useTheme } from '@/lib/use-theme';
import { AutosaveField } from '@/components/ui/AutosaveField';
import { Txt } from '@/components/ui/Txt';

interface ObjectHeroProps {
  /** Optional emoji glyph shown before the title. */
  emoji?: string;
  /** Object title; falls back to "Untitled" when empty. */
  title?: string;
  /** Optional secondary line under the title (e.g. a board's done count). */
  subtitle?: string;
  /** Optional trailing control aligned to the row's end (e.g. an "Add column" button). */
  trailing?: ReactNode;
  /** When set AND on a wide screen, the title becomes click-to-edit in place (no
   *  bottom sheet) — Notion-style. On small screens the title stays read-only and is
   *  edited via the {@link ObjectActions} sheet, so the callback is simply unused there. */
  onChangeTitle?: (text: string) => void;
}

/**
 * The header for a `page`/`board` view: an emoji + display title (+ optional
 * subtitle and a trailing control). Shared by {@link PageView} and {@link BoardView}
 * so the hero markup + emoji sizing live in one place.
 *
 * On wide screens, passing `onChangeTitle` makes the title click-to-edit: tapping it
 * swaps the text for an inline {@link AutosaveField} at the same `pageTitle` metrics
 * (mounted only while editing, so it always seeds from the current title). On phones
 * the title is read-only here and edited from the kebab sheet.
 */
export function ObjectHero({ emoji, title, subtitle, trailing, onChangeTitle }: ObjectHeroProps) {
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const { hovered, hoverProps } = useHover();
  const [editing, setEditing] = useState(false);
  const canEditInline = isWide && !!onChangeTitle;

  return (
    <View style={styles.hero}>
      {emoji ? <Txt style={styles.emoji}>{emoji}</Txt> : null}
      <View style={styles.text}>
        {canEditInline && editing ? (
          <AutosaveField
            initialText={title ?? ''}
            textVariant="pageTitle"
            plain
            autoFocus
            placeholder="Untitled"
            accessibilityLabel="Title"
            onCommit={(t) => onChangeTitle!(t)}
            onClose={() => setEditing(false)}
          />
        ) : canEditInline ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Rename ${title || 'Untitled'}`}
            onPress={() => setEditing(true)}
            {...hoverProps}
            style={[styles.titleHit, { backgroundColor: hovered ? colors.hover : 'transparent' }]}
          >
            <Txt variant="pageTitle" weight="bold" tone={title ? 'ink' : 'inkFaint'}>
              {title || 'Untitled'}
            </Txt>
          </Pressable>
        ) : (
          <Txt variant="pageTitle" weight="bold">
            {title || 'Untitled'}
          </Txt>
        )}
        {subtitle ? (
          <Txt variant="caption" tone="inkFaint" style={styles.subtitle}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emoji: { fontSize: layout.objectHeroEmoji },
  text: { flex: 1, gap: 2 },
  // Negative margin so the hover/press surface hugs the text without shifting the
  // title's optical left edge (the inline editor is flush, so they line up).
  titleHit: { alignSelf: 'flex-start', marginHorizontal: -spacing.xs, paddingHorizontal: spacing.xs, borderRadius: radii.sm },
  subtitle: { paddingHorizontal: spacing.xs },
});
