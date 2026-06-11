import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { radii } from '@/theme';
import { focusRingStyle, useFocusRing } from '@/lib/focus';
import { useHover } from '@/lib/use-hover';
import { useScalePress } from '@/lib/use-scale-press';
import { useTheme } from '@/lib/use-theme';

import { Icon, type IconName } from './Icon';
import { Tooltip } from './Tooltip';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface IconButtonProps {
  name: IconName;
  onPress?: () => void;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
  /** Hover hint (web-only Tooltip) — icon-only controls should always set one;
   *  it doubles as the accessibility label when none is given. */
  tooltip?: string;
  /** Keyboard-shortcut caption shown beside `tooltip` (e.g. "⌘K"). */
  shortcut?: string;
  style?: StyleProp<ViewStyle>;
}

/** Tappable icon with a press spring + haptics — header & toolbar actions. */
export function IconButton({
  name,
  onPress,
  size = 20,
  color,
  accessibilityLabel,
  tooltip,
  shortcut,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  const { focused, focusProps } = useFocusRing();
  const { animStyle, onPressIn, onPressOut } = useScalePress({ scaleTo: 0.86, fadeTo: 0.7 });
  // Pressed fill complements the scale dip — one step past the hover circle.
  const [pressed, setPressed] = useState(false);

  const button = (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? tooltip ?? name}
      hitSlop={8}
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
        styles.btn,
        { backgroundColor: pressed ? colors.pressed : hovered ? colors.hover : 'transparent' },
        focused && focusRingStyle(colors),
        animStyle,
        style,
      ]}
    >
      <Icon name={name} size={size} color={color ?? colors.inkSoft} />
    </AnimatedPressable>
  );

  if (!tooltip) return button;
  return (
    <Tooltip label={tooltip} shortcut={shortcut}>
      {button}
    </Tooltip>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 6, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
});
