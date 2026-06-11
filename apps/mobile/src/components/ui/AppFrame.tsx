import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { isMacDesktop } from '@/lib/desktop';
import { ConfirmProvider } from '@/lib/use-confirm';
import { setSidebarCollapsedPref, toggleSidebarPref, useNavPrefs, useTrackLastRoute } from '@/lib/use-nav-prefs';
import { useQuickCreate } from '@/lib/use-quick-create';
import { useInShell } from '@/lib/use-responsive';
import { ShortcutProvider, formatShortcut, useShortcut } from '@/lib/use-shortcuts';
import { useSession } from '@/lib/session-context';
import { useTheme } from '@/lib/use-theme';
import { layers, layout, motion, paperBorder, radii, shadows, spacing } from '@/theme';
import { WorkspaceNav } from '@/components/work/WorkspaceNav';
import { AppLockGate } from './AppLockGate';
import { CommandPalette } from './CommandPalette';
import { DesktopUpdateBanner } from './DesktopUpdateBanner';
import { IconButton } from './IconButton';
import { ToastProvider } from './Toast';

/**
 * App-wide layout shell. On wide viewports (web/tablet) it frames the routed
 * content with the persistent desktop navigation; on phones — and on the
 * onboarding stack or before sign-in — it renders the routes untouched so the
 * mobile bottom-tab layout stands on its own.
 *
 * Also the single mount point for the app-wide interaction layer: toasts,
 * confirm dialogs, keyboard shortcuts and the mod+K command palette all live
 * here (inside the root view, so absolutely-positioned hosts cover the whole
 * window), plus the last-route tracker that powers open-at-last-location.
 *
 * On wide layouts the DesktopUpdateBanner sits at the top so it stays visible
 * over the persistent sidebar; on phones the tabs layout renders it just above
 * the bottom tab bar instead (see `(tabs)/_layout.tsx`).
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const inShell = useInShell();
  const { session, status } = useSession();

  // Remember the open document on every navigation (cheap kv write) so the next
  // cold start can resume exactly there (see app/index.tsx).
  useTrackLastRoute();

  return (
    <View style={styles.col}>
      {isMacDesktop() ? (
        // Draggable strip clearing the macOS traffic lights (hiddenInset). The
        // WebkitAppRegion key is forwarded to inline CSS by react-native-web.
        <View
          style={[
            styles.titlebar,
            { backgroundColor: colors.canvas },
            { WebkitAppRegion: 'drag' } as object,
          ]}
        />
      ) : null}
      <ToastProvider>
        <ConfirmProvider>
          <ShortcutProvider>
            {/* Render the update banner at the top of the app in the desktop shell
                (web/tablet) and on every native screen — NativeTabs can't host a
                custom view above the tab bar, so native loses the above-bar slot (see
                (tabs)/_layout.native.tsx). On native the banner is the topmost view,
                so it clears the status bar / notch. On mobile web the (tabs) layout
                renders it above the bottom bar instead, so skip it here. */}
            {inShell || Platform.OS !== 'web' ? (
              <DesktopUpdateBanner topInset={Platform.OS !== 'web'} />
            ) : null}
            {inShell ? (
              <View style={[styles.row, { backgroundColor: colors.canvas }]}>
                <CollapsibleNav />
                <View style={styles.main}>
                  {children}
                  <SidebarReopen />
                </View>
              </View>
            ) : (
              <View style={styles.fill}>{children}</View>
            )}
            {/* Signed-in only: shortcuts act on the active space's store and the
                palette searches it — neither makes sense on the onboarding stack. */}
            {session ? <ShellShortcuts /> : null}
            {session ? <CommandPalette /> : null}
          </ShortcutProvider>
        </ConfirmProvider>
      </ToastProvider>
      {status === 'switching' ? (
        <View style={[StyleSheet.absoluteFill, styles.switching, { backgroundColor: colors.scrim }]}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
      {/* Topmost child so the native biometric lock covers everything above (renders
          nothing on web / when the lock is off). */}
      <AppLockGate />
    </View>
  );
}

/**
 * The desktop nav (rail + sidebar) behind an animated-width clip, so mod+\
 * tucks the whole chrome away and the document takes the full window — the
 * inner pane keeps its natural width during the animation (content slides out,
 * never squishes).
 */
function CollapsibleNav() {
  const { sidebarCollapsed } = useNavPrefs();
  const navWidth = layout.railWidth + layout.sidebarWidth;
  const width = useSharedValue(sidebarCollapsed ? layout.sidebarCollapsedWidth : navWidth);

  useEffect(() => {
    width.value = withTiming(sidebarCollapsed ? layout.sidebarCollapsedWidth : navWidth, { duration: motion.base });
  }, [sidebarCollapsed, navWidth, width]);

  const anim = useAnimatedStyle(() => ({ width: width.value }));

  return (
    <Animated.View style={[styles.nav, anim]}>
      <View style={[styles.navInner, { width: navWidth }]}>
        <WorkspaceNav />
      </View>
    </Animated.View>
  );
}

/**
 * Floating reopen control in the main pane while the sidebar is collapsed —
 * the collapse toggle disappears WITH the sidebar, so without this the only
 * way back is the (web-only) shortcut. A bordered paper chip, not a bare
 * glyph, so it reads as a control over any document content beneath it.
 */
function SidebarReopen() {
  const { colors } = useTheme();
  const { sidebarCollapsed } = useNavPrefs();
  if (!sidebarCollapsed) return null;
  return (
    <View style={[styles.reopen, paperBorder(colors), shadows.sm]}>
      <IconButton
        name="sidebar"
        size={15}
        color={colors.inkMuted}
        onPress={() => setSidebarCollapsedPref(false)}
        tooltip="Show sidebar"
        shortcut={formatShortcut('mod+\\')}
        accessibilityLabel="Show sidebar"
      />
    </View>
  );
}

/**
 * Global keyboard bindings owned by the shell (mounted inside ShortcutProvider;
 * mod+K belongs to CommandPalette, which binds itself). Renders nothing.
 */
function ShellShortcuts() {
  const { newPage } = useQuickCreate();
  useShortcut('mod+n', newPage);
  useShortcut('mod+\\', toggleSidebarPref);
  return null;
}

const styles = StyleSheet.create({
  col: { flex: 1 },
  titlebar: { height: layout.desktopTitlebarInset },
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, minWidth: 0 },
  /** Clip the fixed-width nav as the animated wrapper narrows. */
  nav: { overflow: 'hidden' },
  navInner: { flex: 1, flexDirection: 'row' },
  reopen: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    zIndex: layers.header,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  switching: { alignItems: 'center', justifyContent: 'center' },
});
