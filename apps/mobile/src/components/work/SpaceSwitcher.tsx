import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import type { View as ViewType } from 'react-native';
import { Platform, Pressable, StyleSheet } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import { focusRingStyle, useFocusRing } from '@/lib/focus';
import { useHover } from '@/lib/use-hover';
import { useSpaces } from '@/lib/use-spaces';
import { useTheme } from '@/lib/use-theme';
import type { Space } from '@drakkar.software/octovault-sdk';
import { AccountSwitcher } from '@/components/account/AccountSwitcher';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { Popover } from '@/components/ui/Popover';
import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';

/** Space monogram fallback when no image is set. */
const monogram = (s: Space) => (s.short || s.name.slice(0, 2)).toUpperCase();

interface SpaceSwitcherProps {
  /**
   * `sidebar` — the desktop sidebar header: name + avatar + chevron opening an
   * anchored {@link Popover} (Notion's top-left workspace switcher).
   * `appbar` — the phone Vault tab's AppBar title: same trigger shape opening a
   * bottom {@link Sheet}, because phones previously had NO way to change space.
   */
  variant: 'sidebar' | 'appbar';
}

/**
 * The workspace switcher — one menu, every form factor: the space list (avatar,
 * check on the active one), "Join or create a space", the active space's
 * settings, and the account section (switch / add / profile / log out, reusing
 * {@link AccountSwitcher} so multi-account lives one press from the space name
 * instead of buried behind the desktop-only rail avatar). Selecting a space
 * goes through `switchSpace`, which navigates the main pane home BEFORE
 * activating — switching under an open document used to silently revert.
 */
export function SpaceSwitcher({ variant }: SpaceSwitcherProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { spaces, activeId, switchSpace } = useSpaces();
  const { hovered, hoverProps } = useHover();
  const { focused, focusProps } = useFocusRing();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<ViewType>(null);

  const active = spaces.find((s) => s.id === activeId) ?? spaces[0] ?? null;
  const close = () => setOpen(false);

  const onSelect = (id: string) => {
    close();
    if (id !== activeId) switchSpace(id);
  };

  const menu = (
    <Menu>
      {spaces.length > 0 ? <MenuLabel>Spaces</MenuLabel> : null}
      {spaces.map((s) => (
        <SpaceRow key={s.id} space={s} active={s.id === active?.id} onPress={() => onSelect(s.id)} />
      ))}
      <MenuItem
        icon="plus"
        label={spaces.length > 0 ? 'Join or create a space' : 'Create your first space'}
        onPress={() => {
          close();
          router.push('/join');
        }}
      />
      {active ? (
        <MenuItem
          icon="gear"
          label="Space settings"
          onPress={() => {
            close();
            router.push({ pathname: '/space/[id]', params: { id: active.id } });
          }}
        />
      ) : null}
      <MenuSeparator />
      <MenuLabel>Account</MenuLabel>
      <AccountSwitcher onRequestClose={close} onViewProfile={() => router.push('/you')} />
    </Menu>
  );

  return (
    <>
      <Pressable
        ref={anchorRef}
        accessibilityRole="button"
        accessibilityLabel={active ? `${active.name} — switch space` : 'Switch space'}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        onPress={() => setOpen(true)}
        {...hoverProps}
        {...focusProps}
        style={({ pressed }) => [
          variant === 'sidebar' ? styles.triggerSidebar : styles.triggerAppbar,
          pressed ? { backgroundColor: colors.pressed } : hovered ? { backgroundColor: colors.hover } : null,
          focused && focusRingStyle(colors),
        ]}
      >
        {active ? <Avatar label={monogram(active)} image={active.image} size={22} /> : null}
        <Txt variant="heading" weight="semibold" numberOfLines={1} style={styles.triggerName}>
          {active?.name ?? 'OctoVault'}
        </Txt>
        <Icon name="chev-down" size={14} color={colors.inkMuted} />
      </Pressable>
      {variant === 'sidebar' ? (
        <Popover visible={open} onClose={close} anchorRef={anchorRef} placement="bottom-start" width={layout.popoverWidth}>
          {menu}
        </Popover>
      ) : (
        <Sheet visible={open} onClose={close} presentation="sheet">
          {menu}
        </Sheet>
      )}
    </>
  );
}

interface SpaceRowProps {
  space: Space;
  active: boolean;
  onPress: () => void;
}

/** One space in the menu — a MenuItem-shaped row with a leading Avatar (which
 *  MenuItem's `icon: IconName` can't express) and a trailing check when active. */
function SpaceRow({ space, active, onPress }: SpaceRowProps) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  const { focused, focusProps } = useFocusRing();
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={active ? `${space.name} (current)` : `Switch to ${space.name}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      {...hoverProps}
      {...focusProps}
      style={({ pressed }) => [
        styles.spaceRow,
        pressed ? { backgroundColor: colors.pressed } : hovered ? { backgroundColor: colors.hover } : null,
        focused && focusRingStyle(colors),
      ]}
    >
      <Avatar label={monogram(space)} image={space.image} size={24} />
      <Txt variant="subhead" weight={active ? 'semibold' : 'regular'} numberOfLines={1} style={styles.spaceName}>
        {space.name}
      </Txt>
      {active ? <Icon name="check" size={15} color={colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** Sidebar header: start-aligned, shrinks with the 248px column. */
  triggerSidebar: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.md,
  },
  /** AppBar title slot: centered within the flexible middle region. */
  triggerAppbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
  },
  triggerName: { flexShrink: 1, minWidth: 0 },
  /** Mirrors MenuItem's row metrics so avatar rows sit flush with icon rows. */
  spaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    minHeight: Platform.OS === 'web' ? undefined : spacing.controlMinHeight,
  },
  spaceName: { flex: 1, minWidth: 0 },
});
