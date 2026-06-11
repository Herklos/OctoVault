import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import Animated from 'react-native-reanimated';

import { initialsFor } from '@/lib/format';
import { useProfile } from '@/lib/profile-context';
import { useScalePress } from '@/lib/use-scale-press';
import { Avatar } from '@/components/ui/Avatar';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Header-right profile puck: the signed-in identity's avatar (or monogram
 * fallback) with a press-scale spring and an optional accent ring. Tapping
 * opens `/you` (Profile & accounts). Drop this into any AppBar `right` prop
 * instead of copy-pasting the inline Pressable+Avatar pattern.
 */
export function ProfileButton({ ring = false, size = 30 }: { ring?: boolean; size?: number }) {
  const router = useRouter();
  const { profile } = useProfile();
  const { animStyle, onPressIn, onPressOut } = useScalePress({ scaleTo: 0.9 });
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Profile & accounts"
      hitSlop={8}
      onPress={() => router.push('/you')}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={animStyle}
    >
      <Avatar label={initialsFor(profile?.name ?? '')} image={profile?.avatar} size={size} ring={ring} />
    </AnimatedPressable>
  );
}
