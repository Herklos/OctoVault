import { Redirect, router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { spacing } from '@/theme';
import { useSession } from '@/lib/session-context';
import { AppBar } from '@/components/ui/AppBar';
import { StackScreen } from '@/components/ui/StackScreen';
import { SeedUnlock } from '@/components/onboarding/SeedUnlock';

/** Cold-start unlock for a sealed, web-persisted seed (PIN or passkey). */
export default function UnlockScreen() {
  const { status, unlockMethods, unlock, fullSignOut } = useSession();

  if (status === 'loading') return null;
  if (status !== 'locked') return <Redirect href="/" />;

  // Navigate first, THEN clear: flipping `status` via fullSignOut() while still on
  // this screen would trip the `status !== 'locked'` redirect above and race the nav.
  const forget = () => {
    router.replace('/(onboarding)/recover');
    void fullSignOut();
  };

  return (
    <StackScreen
      scroll
      contentStyle={styles.content}
      header={<AppBar title="Unlock OctoVault" subtitle="welcome back" />}
    >
      <SeedUnlock
        methods={unlockMethods}
        onUnlock={unlock}
        onDone={() => router.replace('/(tabs)/work')}
        onForget={() => void forget()}
      />
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.lg, justifyContent: 'center', maxWidth: 440, width: '100%', alignSelf: 'center' },
});
