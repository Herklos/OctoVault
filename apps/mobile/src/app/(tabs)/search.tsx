import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { layout, spacing } from '@/theme';
import { initialsFor } from '@/lib/format';
import { useProfile } from '@/lib/profile-context';
import { quickFindKeyHandlers, useQuickFind } from '@/lib/use-quick-find';
import { useSession } from '@/lib/session-context';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { QuickFindResults } from '@/components/ui/CommandPalette';
import { SignInPrompt } from '@/components/ui/SignInPrompt';
import { StackScreen } from '@/components/ui/StackScreen';
import { TextField } from '@/components/ui/TextField';

/**
 * Search tab — the touch shell around Quick Find. Same brain and result list
 * as the mod+K palette (`lib/use-quick-find` + {@link QuickFindResults}), just
 * full-screen: autofocused input, recents while the query is empty, ranked
 * title matches with highlights/breadcrumbs after, and the create-page escape
 * hatch so no search dead-ends. The list is a FlatList so long result sets
 * scroll instead of clipping.
 */
export default function SearchScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { profile } = useProfile();
  // Hook order: called before the signed-out gate (it is safe without a
  // session — the shared index store is simply empty then).
  const find = useQuickFind();

  if (!session) {
    return (
      <StackScreen
        header={
          <AppBar
            title="Search"
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Profile & accounts"
                hitSlop={8}
                onPress={() => router.push('/you')}
              >
                <Avatar label={initialsFor(profile?.name ?? '')} image={profile?.avatar} size={28} />
              </Pressable>
            }
          />
        }
      >
        <SignInPrompt subtitle="Sign in to search your workspace." />
      </StackScreen>
    );
  }

  return (
    <StackScreen
      header={
        <AppBar
          title="Search"
          subtitle={find.spaceName ?? undefined}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile & accounts"
              hitSlop={8}
              onPress={() => router.push('/you')}
            >
              <Avatar label={initialsFor(profile?.name ?? '')} image={profile?.avatar} size={28} />
            </Pressable>
          }
        />
      }
      contentStyle={styles.content}
    >
      <TextField
        leadingIcon="search"
        value={find.query}
        onChangeText={find.setQuery}
        placeholder={find.spaceName ? `Search ${find.spaceName}…` : 'Search pages & boards…'}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="go"
        blurOnSubmit={false}
        {...quickFindKeyHandlers(find, { escapeClears: true })}
      />
      <QuickFindResults find={find} scroll />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.md,
    gap: spacing.md,
    maxWidth: layout.listMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
});
