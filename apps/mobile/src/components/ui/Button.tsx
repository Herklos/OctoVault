import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';

import { glowShadow, opacity, radii, shadows, spacing, type as typeScale } from '@/theme';
import { focusRingStyle, useFocusRing } from '@/lib/focus';
import { useHover } from '@/lib/use-hover';
import { useScalePress } from '@/lib/use-scale-press';
import { useTheme, type Palette } from '@/lib/use-theme';

import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to fill the parent's width. */
  full?: boolean;
  /** Optional leading icon, auto-colored to match the label. */
  iconName?: IconName;
  disabled?: boolean;
  /** Show a spinner in place of the leading icon and block presses — for async
   *  actions (e.g. generating an invite link) so the wait reads as "working". */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZES = {
  sm: { paddingVertical: 6, paddingHorizontal: 12, txt: 'footnote', iconSize: typeScale.footnote.fontSize + 2, gap: 6, minHeight: 32 },
  md: { paddingVertical: 10, paddingHorizontal: 16, txt: 'body', iconSize: typeScale.body.fontSize + 2, gap: 8, minHeight: 42 },
  lg: { paddingVertical: 13, paddingHorizontal: 20, txt: 'subhead', iconSize: typeScale.subhead.fontSize + 2, gap: 8, minHeight: spacing.controlMinHeight },
} as const;

function variantColors(c: Palette, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return { bg: 'transparent', border: 'transparent', fg: c.onAccent };
    case 'secondary':
      return { bg: c.paper, border: c.lineSoft, fg: c.ink };
    case 'ghost':
      return { bg: 'transparent', border: 'transparent', fg: c.inkSoft };
    case 'danger':
      return { bg: c.paper, border: c.dangerBorder, fg: c.danger };
  }
}

/** Generic pressable button — 4 variants × 3 sizes, with press spring +
 *  pressed fill, web hover wash, keyboard focus ring and (primary) an accent
 *  gradient with a restrained glow. */
export function Button({
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  full = false,
  iconName,
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const v = variantColors(colors, variant);
  const s = SIZES[size];
  const { hovered, hoverProps } = useHover();
  const { focused, focusProps } = useFocusRing();
  const { animStyle, onPressIn, onPressOut } = useScalePress({ scaleTo: 0.97 });
  // Pressed fill complements the scale dip so a press also reads as a wash on
  // flat surfaces (and on touch, where there is no hover precursor).
  const [pressed, setPressed] = useState(false);

  const isPrimary = variant === 'primary';
  const wash = pressed ? colors.pressed : hovered ? (isPrimary ? colors.brightWash : colors.hover) : null;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      onPressIn={() => {
        setPressed(true);
        onPressIn();
      }}
      onPressOut={() => {
        setPressed(false);
        onPressOut();
      }}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          minHeight: s.minHeight,
          gap: s.gap,
          opacity: disabled ? opacity.disabled : 1,
          alignSelf: full ? 'stretch' : 'flex-start',
          width: full ? '100%' : undefined,
        },
        isPrimary ? glowShadow(colors.glow, hovered ? 0.34 : 0.18, hovered ? 12 : 9) : variant === 'secondary' && hovered ? shadows.sm : null,
        focused && focusRingStyle(colors),
        animStyle,
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={[colors.accentGradTop, colors.accentGradBottom]}
          style={[StyleSheet.absoluteFill, styles.fill]}
        />
      ) : null}
      {wash ? <View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: wash }]} /> : null}
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : iconName ? (
        <Icon name={iconName} size={s.iconSize} color={v.fg} />
      ) : null}
      <Txt variant={s.txt} weight="semibold" color={v.fg} numberOfLines={1}>
        {label}
      </Txt>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  fill: { borderRadius: radii.lg },
});
