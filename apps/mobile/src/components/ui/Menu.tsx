import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { layout, opacity, radii, spacing } from '@/theme';
import { focusRingStyle, useFocusRing } from '@/lib/focus';
import { useHover } from '@/lib/use-hover';
import { useTheme } from '@/lib/use-theme';

import { Icon, type IconName } from './Icon';
import { Txt } from './Txt';

/**
 * Menu rows — the shared vocabulary for every context/handle/switcher menu.
 * Presentation-agnostic: render inside a {@link Popover} on wide screens and a
 * {@link Sheet} on narrow ones, so one menu definition serves both. Compose:
 *
 *     <Menu>
 *       <MenuLabel>PAGE</MenuLabel>
 *       <MenuItem icon="copy" label="Duplicate" shortcut="⌘D" onPress={…} />
 *       <MenuSeparator />
 *       <MenuItem icon="trash" label="Delete" danger onPress={…} />
 *     </Menu>
 */
export function Menu({ children }: { children: ReactNode }) {
  return (
    <View accessibilityRole="menu" style={styles.menu}>
      {children}
    </View>
  );
}

interface MenuItemProps {
  icon?: IconName;
  label: string;
  /** Custom trailing accessory (rendered after the shortcut hint). */
  trailing?: ReactNode;
  /** Keyboard hint, e.g. "⌘D" — discoverability is half of a shortcut's value. */
  shortcut?: string;
  /** Destructive row: danger ink + a danger wash instead of the neutral one. */
  danger?: boolean;
  /** Render a trailing check (the active option in a single-select group). */
  checked?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

/** One pressable menu row: icon, label, shortcut/accessory, optional check. */
export function MenuItem({ icon, label, trailing, shortcut, danger = false, checked = false, disabled = false, onPress }: MenuItemProps) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useHover();
  const { focused, focusProps } = useFocusRing();

  const wash = danger ? colors.dangerBg : colors.hover;
  const pressedFill = danger ? colors.dangerBg : colors.pressed;

  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityState={{ disabled, checked }}
      disabled={disabled}
      onPress={onPress}
      {...focusProps}
      {...hoverProps}
      style={({ pressed }) => [
        styles.item,
        pressed ? { backgroundColor: pressedFill } : hovered ? { backgroundColor: wash } : null,
        focused && focusRingStyle(colors),
        disabled && styles.disabled,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={danger ? colors.danger : colors.inkMuted} /> : null}
      <Txt variant="subhead" tone={danger ? 'danger' : 'ink'} numberOfLines={1} style={styles.label}>
        {label}
      </Txt>
      {shortcut ? (
        <Txt variant="caption" mono tone="inkFaint">
          {shortcut}
        </Txt>
      ) : null}
      {trailing ?? null}
      {checked ? <Icon name="check" size={15} color={colors.accent} /> : null}
    </Pressable>
  );
}

/** Micro mono uppercase section header between row groups. */
export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <Txt variant="micro" weight="bold" mono uppercase tone="inkFaint" style={styles.sectionLabel}>
      {children}
    </Txt>
  );
}

/** Hairline rule between row groups. */
export function MenuSeparator() {
  const { colors } = useTheme();
  return <View style={[styles.separator, { backgroundColor: colors.lineFaint }]} />;
}

const styles = StyleSheet.create({
  menu: {
    minWidth: layout.menuMinWidth,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    // Web menus stay dense (Notion-tight rows); touch keeps the tap-target floor.
    minHeight: Platform.OS === 'web' ? undefined : spacing.controlMinHeight,
  },
  label: { flex: 1 },
  disabled: { opacity: opacity.disabled },
  sectionLabel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
    marginHorizontal: spacing.sm,
  },
});
