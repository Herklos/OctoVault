import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { motion, radii, spacing } from '@/theme';
import { useTheme } from '@/lib/use-theme';

interface PinDotsProps {
  length?: number;
  filled?: number;
  /** Monotonic error counter — increment it on each wrong PIN to fire a quick
   *  horizontal shake (the universal "nope" the slots were missing). A counter
   *  rather than a boolean so two consecutive failures both animate. */
  shake?: number;
}

/** Row of PIN slots; filled slots show a dot and an accent border. */
export function PinDots({ length = 6, filled = 0, shake = 0 }: PinDotsProps) {
  const { colors } = useTheme();
  // Wrong-PIN shake: a short decaying left-right wobble. Distance/duration are
  // derived from tokens (half a fast beat per swing) — fast enough to read as a
  // head-shake, short enough not to delay the retry.
  const offset = useSharedValue(0);
  useEffect(() => {
    if (!shake) return;
    const step = motion.fast / 2;
    offset.value = withSequence(
      withTiming(-spacing.sm, { duration: step }),
      withTiming(spacing.sm, { duration: step }),
      withTiming(-spacing.xs, { duration: step }),
      withTiming(spacing.xs, { duration: step }),
      withTiming(0, { duration: step }),
    );
  }, [shake, offset]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <Animated.View style={[styles.row, shakeStyle]}>
      {Array.from({ length }).map((_, i) => {
        const on = i < filled;
        return (
          <View
            key={i}
            style={[
              styles.slot,
              {
                borderColor: on ? colors.accent : colors.lineSoft,
                backgroundColor: on ? colors.accentBg : colors.paperAlt,
                borderTopColor: on ? colors.accent : colors.hairlineHi,
              },
            ]}
          >
            {on ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
  slot: {
    width: 32,
    height: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
});
