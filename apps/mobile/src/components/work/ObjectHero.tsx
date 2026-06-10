import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import { useHover } from '@/lib/use-hover';
import { useResponsive } from '@/lib/use-responsive';
import { useTheme } from '@/lib/use-theme';
import { AutosaveField } from '@/components/ui/AutosaveField';
import { Txt } from '@/components/ui/Txt';

interface ObjectHeroProps {
  /** Emoji glyph shown as the large object icon above the title. */
  emoji?: string;
  /** Object title; falls back to "Untitled" when empty. */
  title?: string;
  /** Optional subtle meta line under the title (e.g. a board's progress). Block
   *  counts and other noise should NOT live here — keep it editorial. */
  subtitle?: string;
  /** When set AND on a wide screen, the title becomes click-to-edit in place
   *  (Notion-style). On phones the title is read-only here and edited via the sheet. */
  onChangeTitle?: (text: string) => void;
  /** When set AND on a wide screen, the icon becomes a pressable "change icon" target. */
  onPressIcon?: () => void;
  /** Left inset so the hero aligns with a gutter-indented content column (the page
   *  editor reserves a left gutter for block handles; the board does not). */
  leftInset?: number;
}

/**
 * The header for a `page`/`board` view, in the Notion/Anytype idiom: a large object
 * icon sitting ABOVE a big editorial display title, with generous breathing room.
 * Shared by {@link PageView} and {@link BoardView} so the hero markup + metrics live
 * in one place.
 *
 * On wide screens, `onChangeTitle` makes the title click-to-edit (an inline
 * {@link AutosaveField} at `pageTitle` metrics, mounted only while editing so it always
 * seeds from the current title); `onPressIcon` makes the icon a "change icon" target.
 * On phones the title is read-only here and edited from the kebab sheet.
 */
export function ObjectHero({ emoji, title, subtitle, onChangeTitle, onPressIcon, leftInset = 0 }: ObjectHeroProps) {
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const titleHover = useHover();
  const iconHover = useHover();
  const [editing, setEditing] = useState(false);
  const canEditTitle = isWide && !!onChangeTitle;
  const canEditIcon = isWide && !!onPressIcon;

  const iconGlyph = (
    <Txt style={styles.icon} accessibilityLabel="Icon">
      {emoji || '📄'}
    </Txt>
  );

  return (
    <View style={[styles.hero, leftInset ? { paddingLeft: leftInset } : null]}>
      {canEditIcon ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change icon"
          onPress={onPressIcon}
          {...iconHover.hoverProps}
          style={[styles.iconHit, { backgroundColor: iconHover.hovered ? colors.hover : 'transparent' }]}
        >
          {iconGlyph}
        </Pressable>
      ) : (
        <View style={styles.iconHit}>{iconGlyph}</View>
      )}

      {canEditTitle && editing ? (
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
      ) : canEditTitle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Rename ${title || 'Untitled'}`}
          onPress={() => setEditing(true)}
          {...titleHover.hoverProps}
          style={[styles.titleHit, { backgroundColor: titleHover.hovered ? colors.hover : 'transparent' }]}
        >
          <Txt variant="pageTitle" weight="bold" tone={title ? 'ink' : 'inkFaint'}>
            {title || 'Untitled'}
          </Txt>
        </Pressable>
      ) : (
        <Txt variant="pageTitle" weight="bold" tone={title ? 'ink' : 'inkFaint'}>
          {title || 'Untitled'}
        </Txt>
      )}

      {subtitle ? (
        <Txt variant="footnote" tone="inkMuted" style={styles.meta}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'flex-start', paddingTop: spacing.lg, gap: spacing.xs, marginBottom: spacing.sm },
  // Hit target hugs the glyph so the hover wash doesn't balloon; negative margin keeps
  // the icon's optical left edge flush with the title below.
  iconHit: { marginHorizontal: -spacing.xs, paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radii.md, marginBottom: spacing.xs },
  icon: { fontSize: layout.objectIconLg, lineHeight: layout.objectIconLg + 8 },
  // Negative margin so the press surface hugs the text without shifting the title's
  // optical left edge (the inline editor is flush, so they line up).
  titleHit: { alignSelf: 'flex-start', marginHorizontal: -spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm },
  meta: { marginTop: spacing.xs },
});
