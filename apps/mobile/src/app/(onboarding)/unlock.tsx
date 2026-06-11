import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { useConfirm } from '@/lib/use-confirm';
import { useSession } from '@/lib/session-context';
import { HeroMark } from '@/components/brand/HeroMark';
import { Wordmark } from '@/components/brand/Wordmark';
import { Txt } from '@/components/ui/Txt';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import { SeedUnlock } from '@/components/onboarding/SeedUnlock';

/** Cold-start unlock for a sealed, web-persisted seed (PIN or passkey). The daily
 *  front door — staged with the brand lockup, not a bare PIN pad. */
export default function UnlockScreen() {
  const { status, unlockMethods, unlock, fullSignOut } = useSession();
  const confirm = useConfirm();

  if (status === 'loading') return null;
  if (status !== 'locked') return <Redirect href="/" />;

  // "Use recovery seed instead" destroys the ENTIRE sealed vault — every held
  // account, recoverable only via their 12-word seeds. One mis-tap used to wipe
  // it silently; now the cost is spelled out and confirmed first.
  const forget = async () => {
    const ok = await confirm({
      title: 'Erase this device’s vault?',
      message:
        'This forgets every account stored here. Accounts can only be restored with their 12-word recovery seeds — make sure you have them before continuing.',
      confirmLabel: 'Erase and recover',
      danger: true,
    });
    if (!ok) return;
    // Navigate first, THEN clear: flipping `status` via fullSignOut() while still on
    // this screen would trip the `status !== 'locked'` redirect above and race the nav.
    router.replace('/(onboarding)/recover');
    void fullSignOut();
  };

  return (
    <AuthScreen
      brand={
        <View style={styles.brand}>
          <HeroMark size={96} />
          <Wordmark hideMark size={28} />
          <Txt variant="subhead" tone="inkSoft" center>
            Welcome back — unlock your vault.
          </Txt>
        </View>
      }
    >
      <SeedUnlock
        methods={unlockMethods}
        onUnlock={unlock}
        onDone={() => router.replace('/(tabs)/work')}
        onForget={() => void forget()}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: spacing.lg },
});
