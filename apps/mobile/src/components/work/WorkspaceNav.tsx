import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import { useProfile } from '@/lib/profile-context';
import { useSpaces } from '@/lib/use-spaces';
import { useTheme } from '@/lib/use-theme';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Txt } from '@/components/ui/Txt';
import { WorkObjects } from '@/components/work/WorkObjects';

/**
 * Persistent left navigation of the OctoVault desktop shell: a compact spaces
 * rail + the active space's workspace tree (pages + boards). The WAL/CRDT
 * counterpart of the chat-era DesktopNav — it routes page/board presses into the
 * main pane via {@link WorkObjects}. Rendered once by {@link AppFrame} on wide web.
 */
export function WorkspaceNav() {
  const { colors } = useTheme();
  const router = useRouter();
  const { profile } = useProfile();
  const { spaces, activeId, setActiveId } = useSpaces();
  const space = spaces.find((s) => s.id === activeId) ?? spaces[0];
  const meLabel = (profile?.name ?? '··').slice(0, 2).toUpperCase();

  return (
    <>
      <View style={[styles.rail, { width: layout.railWidth, backgroundColor: colors.canvas, borderRightColor: colors.lineSoft }]}>
        <ScrollView contentContainerStyle={styles.railScroll} showsVerticalScrollIndicator={false}>
          {spaces.map((s) => {
            const active = s.id === activeId;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={s.name}
                onPress={() => setActiveId(s.id)}
                style={[styles.tile, { backgroundColor: active ? colors.accentBg : colors.fill, borderColor: active ? colors.accentBorder : colors.lineFaint }]}
              >
                <Txt variant="caption" weight="bold" tone={active ? 'accent' : 'inkMuted'}>
                  {(s.short || s.name.slice(0, 2)).toUpperCase()}
                </Txt>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" accessibilityLabel="Join or create a space" onPress={() => router.push('/join')} style={[styles.tile, styles.add, { borderColor: colors.lineFaint }]}>
            <Icon name="plus" size={16} color={colors.inkMuted} />
          </Pressable>
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Account" onPress={() => router.push('/you')} style={[styles.tile, { backgroundColor: colors.fill, borderColor: colors.lineFaint }]}>
          <Txt variant="caption" weight="bold" tone="inkMuted">{meLabel}</Txt>
        </Pressable>
      </View>

      <View style={[styles.sidebar, { width: layout.sidebarWidth, backgroundColor: colors.paperAlt, borderRightColor: colors.lineSoft }]}>
        <View style={styles.head}>
          <Txt variant="heading" weight="bold" numberOfLines={1} style={styles.headTitle}>{space?.name ?? 'OctoVault'}</Txt>
          <IconButton name="search" size={16} color={colors.inkMuted} onPress={() => router.push('/search')} accessibilityLabel="Search" />
        </View>
        <ScrollView contentContainerStyle={styles.tree} showsVerticalScrollIndicator={false}>
          <WorkObjects spaceId={space?.id ?? null} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  rail: { borderRightWidth: 1, alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  railScroll: { alignItems: 'center', gap: spacing.sm, flexGrow: 1 },
  tile: { width: 40, height: 40, borderRadius: radii.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  add: { backgroundColor: 'transparent', borderStyle: 'dashed' },
  sidebar: { borderRightWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  headTitle: { flex: 1 },
  tree: { paddingHorizontal: spacing.sm, paddingBottom: spacing.lg },
});
