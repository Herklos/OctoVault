import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { fonts } from '@/theme';
import { useResponsive } from '@/lib/use-responsive';
import { useTheme } from '@/lib/use-theme';

/**
 * Native (iOS / Android) bottom tabs. Renders the real platform tab bar via Expo
 * Router's `NativeTabs`. Four tabs: Vault (workspace), Notes (personal magic space),
 * Agents (active space automations), and Search (iOS 26 floats it to bottom-right).
 * The web/PWA build keeps the JS `Tabs` renderer in `_layout.tsx`.
 */
export default function NativeTabsLayout() {
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  return (
    <NativeTabs
      // On wide native layouts the AppFrame desktop sidebar replaces the bottom bar.
      hidden={isWide}
      tintColor={colors.accent}
      backgroundColor={colors.paper}
      iconColor={{ default: colors.inkMuted }}
      labelStyle={{
        default: { fontFamily: fonts.bodyMedium, color: colors.inkMuted },
        selected: { fontFamily: fonts.bodyMedium, color: colors.accent },
      }}
    >
      <NativeTabs.Trigger name="work">
        <NativeTabs.Trigger.Label>Vault</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={<NativeTabs.Trigger.VectorIcon family={Feather} name="briefcase" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notes">
        <NativeTabs.Trigger.Label>Notes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={<NativeTabs.Trigger.VectorIcon family={Feather} name="book-open" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="agents">
        <NativeTabs.Trigger.Label>Agents</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={<NativeTabs.Trigger.VectorIcon family={Ionicons} name="sparkles-outline" />} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={<NativeTabs.Trigger.VectorIcon family={Feather} name="search" />} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
