import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/theme';
import { useInShell } from '@/lib/use-responsive';
import { useTheme } from '@/lib/use-theme';

import { IconButton } from './IconButton';
import { Txt } from './Txt';

interface AppBarProps {
  title?: string;
  /** Replaces the title text with an interactive node (e.g. the Vault tab's
   *  SpaceSwitcher trigger). `title` still feeds accessibility/fallbacks. */
  titleNode?: ReactNode;
  /** String renders as a centered caption; node lets you compose icons. */
  subtitle?: ReactNode;
  /** Convenience: renders a back chevron on the left — MOBILE ONLY. Inside the
   *  desktop shell the sidebar + breadcrumb trail are the back affordance, so a
   *  stack chevron is suppressed (it misreads as browser-back there). */
  onBack?: () => void;
  /** Override the left region entirely. */
  left?: ReactNode;
  /** Right-aligned actions. */
  right?: ReactNode;
}

/**
 * iOS-style header: symmetric flexible side regions with a centered title +
 * optional sub-line. Used across every pushed screen.
 */
export function AppBar({ title, titleNode, subtitle, onBack, left, right }: AppBarProps) {
  const { colors } = useTheme();
  const inShell = useInShell();
  const leftNode =
    left ??
    (onBack && !inShell ? (
      <IconButton name="arrow-l" size={20} color={colors.ink} onPress={onBack} accessibilityLabel="Back" />
    ) : null);

  return (
    <View style={[styles.bar, inShell && styles.barShell, { backgroundColor: colors.paper, borderBottomColor: colors.lineSoft }]}>
      {/* On desktop the title hugs the start; on mobile both sides flex to center it. */}
      {leftNode ? (
        <View style={inShell ? styles.sideShell : styles.side}>{leftNode}</View>
      ) : !inShell ? (
        <View style={styles.side} />
      ) : null}
      <View style={[styles.center, inShell && styles.centerShell]}>
        {titleNode ?? (
          <Txt variant="heading" weight="semibold" numberOfLines={1}>
            {title}
          </Txt>
        )}
        {subtitle != null ? (
          typeof subtitle === 'string' ? (
            <Txt variant="caption" tone="inkMuted" numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : (
            <View style={styles.subRow}>{subtitle}</View>
          )
        ) : null}
      </View>
      <View style={[inShell ? styles.sideShell : styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.headerMinHeight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  barShell: { minHeight: layout.desktopTopbarHeight, paddingHorizontal: spacing.lg, paddingVertical: 0, gap: spacing.md },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minWidth: 32 },
  sideShell: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  center: { flexShrink: 1, alignItems: 'center', paddingHorizontal: 6, gap: 2 },
  centerShell: { flex: 1, minWidth: 0, alignItems: 'flex-start', paddingHorizontal: 0 },
  right: { justifyContent: 'flex-end' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
