import { useCallback, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { Platform } from 'react-native';

import type { Palette } from '@/theme';

/**
 * Keyboard focus ring for web — the `:focus-visible` treatment RN can't
 * express. React-native-web forwards the `outline*` style keys straight to
 * CSS, so the ring hugs the control's border-radius without affecting layout
 * (unlike a border swap, which would shift content by the border width).
 * Native has no Tab-driven focus traversal for these controls, so everything
 * here collapses to a no-op there.
 *
 * Inline styles can't target the CSS `:focus-visible` pseudo-class, so we
 * reproduce its heuristic: a ring should appear when focus arrives via the
 * KEYBOARD, but stay quiet when a pointer click moves DOM focus (browsers
 * focus on click too, and a ring on every mouse press reads as noise). A
 * module-level listener pair tracks the last input modality — the same
 * approach as the WICG focus-visible polyfill, scoped to what we need.
 */

const isWeb = Platform.OS === 'web';

/** Ring geometry — width reads at a glance, offset clears 1px hairline borders. */
const RING_WIDTH = 2;
const RING_OFFSET = 1;

// Last-input-modality tracker. Capture phase so it runs before React's own
// focus handlers; guarded for SSR (Expo web static rendering has no window).
let keyboardModality = false;
if (isWeb && typeof window !== 'undefined') {
  window.addEventListener('keydown', () => (keyboardModality = true), true);
  window.addEventListener('pointerdown', () => (keyboardModality = false), true);
}

/**
 * The focus-ring style itself. Apply it CONDITIONALLY on the `focused` state
 * from `useFocusRing()` — never statically, or the ring shows at rest:
 *
 *     const { focused, focusProps } = useFocusRing();
 *     <Pressable {...focusProps} style={[base, focused && focusRingStyle(colors)]} />
 */
export function focusRingStyle(p: Palette): ViewStyle {
  if (!isWeb) return {};
  return {
    outlineColor: p.focusRing,
    outlineStyle: 'solid',
    outlineWidth: RING_WIDTH,
    outlineOffset: RING_OFFSET,
  };
}

/**
 * Focus-visible state for a Pressable-based control. RNW forwards
 * `onFocus`/`onBlur` to the DOM node; `focused` only flips true when the
 * focus arrived from the keyboard (see modality tracker above). Constant
 * `false` + empty props on native, mirroring `useHover`.
 */
export function useFocusRing() {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback(() => setFocused(keyboardModality), []);
  const onBlur = useCallback(() => setFocused(false), []);

  return {
    focused: isWeb && focused,
    focusProps: isWeb ? { onFocus, onBlur } : {},
  };
}
