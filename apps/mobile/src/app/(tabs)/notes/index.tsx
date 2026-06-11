import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { spacing } from '@/theme';
import { initialsFor } from '@/lib/format';
import { useProfile } from '@/lib/profile-context';
import { useSession } from '@/lib/session-context';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { SignInPrompt } from '@/components/ui/SignInPrompt';
import { StackScreen } from '@/components/ui/StackScreen';

/**
 * Notes bottom tab — a personal "magic space" that holds the user's own notes,
 * independent of any vault space. Mirrors the structure of OctoChat's DM screen:
 * global (not space-scoped), with a single header action to create a new note.
 * Business logic (note list, creation) is wired in a later pass.
 */
export default function NotesScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { profile } = useProfile();

  return (
    <StackScreen
      inTabs
      scroll
      header={
        <AppBar
          title="My Notes"
          right={
            session ? (
              <>
                <IconButton name="plus" onPress={() => {}} tooltip="New note" accessibilityLabel="New note" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Profile & accounts"
                  hitSlop={8}
                  onPress={() => router.push('/you')}
                >
                  <Avatar label={initialsFor(profile?.name ?? '')} image={profile?.avatar} size={28} />
                </Pressable>
              </>
            ) : undefined
          }
        />
      }
      contentStyle={styles.content}
    >
      {!session ? (
        <SignInPrompt subtitle="Create an identity to access your personal notes." />
      ) : (
        <EmptyState
          iconName="book"
          title="No notes yet"
          subtitle="Your personal writing space — tap + to create your first note."
        />
      )}
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: 96 },
});
