import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/theme';
import { useResponsive } from '@/lib/use-responsive';
import { useTheme } from '@/lib/use-theme';
import { Icon } from '@/components/ui/Icon';
import { StackScreen } from '@/components/ui/StackScreen';
import { Txt } from '@/components/ui/Txt';

interface AuthScreenProps {
  /** Top chrome (usually an `<AppBar/>`). Omit on staged front doors (welcome,
   *  unlock) where the brand lockup IS the header. */
  header?: ReactNode;
  /** Brand lockup slot rendered above the body (HeroMark / Wordmark composition). */
  brand?: ReactNode;
  children: ReactNode;
  /** Pinned CTA row under the scroll body — width-capped to the auth column so
   *  footers line up with the content above them. */
  footer?: ReactNode;
  scroll?: boolean;
  /** The quiet "End-to-end encrypted · No email, no phone" rail under the body.
   *  On by default — it's the product's trust signature; turn off for in-app
   *  utility screens (create-space) where it would read as noise. */
  trust?: boolean;
  /** Extra styles merged into the content column (rarely needed). */
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Shared scaffold for every onboarding/auth surface (welcome, seed, lock,
 * unlock, recover, pair, account-add/create/recover/backup/add-device). One
 * `layout.authColumnWidth` reading column ends the width drift that made the
 * funnel jump between 360–600px on every push, and one trust rail keeps the
 * E2EE promise staged consistently. On wide viewports the column gets a more
 * generous vertical rhythm so these screens read as a composed page, not a
 * strip floating in pearl-colored emptiness.
 */
export function AuthScreen({ header, brand, children, footer, scroll = true, trust = true, contentStyle }: AuthScreenProps) {
  const { isWide } = useResponsive();
  return (
    <StackScreen
      scroll={scroll}
      header={header}
      footer={footer ? <View style={styles.footer}>{footer}</View> : undefined}
      contentStyle={[styles.content, isWide && styles.contentWide, contentStyle]}
    >
      {brand ? <View style={[styles.brand, isWide && styles.brandWide]}>{brand}</View> : null}
      {children}
      {trust ? <TrustRail /> : null}
    </StackScreen>
  );
}

/** The product's trust signature, staged once at the foot of every auth column. */
function TrustRail() {
  const { colors } = useTheme();
  return (
    <View style={styles.trust}>
      <Icon name="lock" size={12} color={colors.accent} />
      <Txt variant="caption" tone="inkMuted">
        End-to-end encrypted · No email, no phone
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    gap: spacing.lg,
    maxWidth: layout.authColumnWidth,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
  },
  // Wide viewports: looser vertical rhythm so the column reads as a staged page.
  contentWide: {
    paddingVertical: spacing.xxxl,
    gap: spacing.xl,
  },
  brand: {
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.sm,
  },
  brandWide: {
    marginBottom: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.md,
    maxWidth: layout.authColumnWidth,
    width: '100%',
    alignSelf: 'center',
  },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
});
