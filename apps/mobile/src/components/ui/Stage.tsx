import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/theme';

interface StageProps {
  children: ReactNode;
  /** Reading-column cap. Defaults to the editor column; pass `layout.listMaxWidth`
   *  for a workspace list, or a wider value for a board. */
  maxWidth?: number;
  /** Apply the default horizontal screen padding. Default true. */
  padded?: boolean;
  /** Style merged onto the inner column (e.g. vertical padding, gap). */
  style?: StyleProp<ViewStyle>;
}

/**
 * Centered, width-capped reading column for the main pane's WORK content.
 *
 * The desktop shell gives a routed page the FULL pane width (see {@link StackScreen}
 * `centerFull`), which is right for chrome but lets a document/board/list sprawl across
 * ~1100px. `Stage` re-introduces the editorial reading column — a Notion/Anytype-style
 * centered measure — without touching the shared shell layout (so search / account /
 * space screens that want full width are unaffected). On phones the cap exceeds the
 * viewport, so it degrades to a full-width padded column.
 */
export function Stage({ children, maxWidth = layout.editorMaxWidth, padded = true, style }: StageProps) {
  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { maxWidth }, padded && styles.padded, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%', alignItems: 'center', flexGrow: 1 },
  inner: { width: '100%', flexGrow: 1 },
  padded: { paddingHorizontal: spacing.screenX },
});
