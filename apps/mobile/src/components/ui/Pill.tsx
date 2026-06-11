import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { opacity, radii, swatch, type Palette, type SwatchName } from '@/theme';
import { focusRingStyle, useFocusRing } from '@/lib/focus';
import { useHover } from '@/lib/use-hover';
import { useTheme } from '@/lib/use-theme';

import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

export type PillTone = 'neutral' | 'accent' | 'success' | 'danger' | 'note';

interface PillProps {
  label: string;
  tone?: PillTone;
  /** Categorical swatch color (tags, board labels) — wins over `tone` when set. */
  swatchName?: SwatchName;
  iconName?: IconName;
  mono?: boolean;
  /** Makes the whole chip pressable (filter chips, tag pickers). */
  onPress?: () => void;
  /** Adds a trailing × that removes the chip (multi-select tags). */
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
}

function toneColors(c: Palette, tone: PillTone) {
  switch (tone) {
    case 'accent':
      return { bg: c.accentBg, fg: c.accentInk, border: c.accentBorder };
    case 'success':
      return { bg: c.successBg, fg: c.success, border: c.successBorder };
    case 'danger':
      return { bg: c.dangerBg, fg: c.danger, border: c.dangerBorder };
    case 'note':
      return { bg: c.note, fg: c.noteInk, border: 'transparent' };
    default:
      return { bg: c.fill, fg: c.inkSoft, border: c.lineFaint };
  }
}

/** Small labeled chip — tags, "e2ee", status, member counts. `swatchName`
 *  pulls from the 8-color categorical palette; `onPress`/`onRemove` turn the
 *  chip interactive (hover/pressed wash, focus ring) for tag and filter UIs. */
export function Pill({
  label,
  tone = 'neutral',
  swatchName,
  iconName,
  mono = false,
  onPress,
  onRemove,
  style,
}: PillProps) {
  const { scheme, colors } = useTheme();
  const sw = swatchName ? swatch(scheme, swatchName) : null;
  const t = sw ? { bg: sw.bg, fg: sw.text, border: sw.border } : toneColors(colors, tone);
  const { hovered, hoverProps } = useHover();
  const { focused, focusProps } = useFocusRing();

  const content = (
    <>
      {iconName ? <Icon name={iconName} size={11} color={t.fg} /> : null}
      <Txt variant="micro" weight="medium" mono={mono} color={t.fg}>
        {label}
      </Txt>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${label}`}
          hitSlop={6}
          onPress={onRemove}
          style={({ pressed }) => (pressed ? { opacity: opacity.muted } : null)}
        >
          <Icon name="x" size={10} color={t.fg} />
        </Pressable>
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }, style]}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      // The chip itself is well under the touch-target floor — pad the
      // pressable region the way IconButton does.
      hitSlop={8}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border }, focused && focusRingStyle(colors), style]}
    >
      {({ pressed }) => (
        <>
          {/* Ink wash over the tinted fill — the same hover/pressed language as rows. */}
          {hovered || pressed ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                styles.wash,
                { backgroundColor: pressed ? colors.pressed : colors.hover },
              ]}
            />
          ) : null}
          {content}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  wash: { borderRadius: radii.pill },
});
