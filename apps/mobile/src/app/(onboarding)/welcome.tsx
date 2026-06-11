import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { humanizeError } from '@/lib/errors';
import { setAuthFlow } from '@/lib/onboarding-steps';
import { useResponsive } from '@/lib/use-responsive';
import { useSession } from '@/lib/session-context';
import { hasNostrSignSchnorr, loginWithNostrExtension } from '@/lib/nostr';
import { HeroMark } from '@/components/brand/HeroMark';
import { Wordmark } from '@/components/brand/Wordmark';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { Txt } from '@/components/ui/Txt';

export default function Welcome() {
  const { prepareNostrSignIn } = useSession();
  const { isWide } = useResponsive();
  // NIP-07 extensions inject `window.nostr` from their content script. Timing is
  // not guaranteed against React mount, so probe at mount AND on tab focus — and
  // only render the button once we've actually seen the provider.
  const [nostrAvailable, setNostrAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const probe = () => setNostrAvailable(hasNostrSignSchnorr());
    probe();
    const t = setTimeout(probe, 250);
    window.addEventListener('focus', probe);
    return () => {
      clearTimeout(t);
      window.removeEventListener('focus', probe);
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Expert paths (device pairing, Nostr) fold behind one quiet disclosure so the
  // front door stays a two-decision page: create, or recover.
  const [moreOpen, setMoreOpen] = useState(false);

  const onNostrLogin = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const root = await loginWithNostrExtension();
      prepareNostrSignIn(root);
      setAuthFlow('nostr');
      router.push('/(onboarding)/lock');
    } catch (e) {
      setError(humanizeError(e, 'The Nostr extension didn’t respond. Try again.'));
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      brand={
        <View style={styles.hero}>
          {/* Larger lockup + type at desktop scale — the one screen allowed a
              full staged brand moment. */}
          <HeroMark size={isWide ? 156 : 128} />
          <View style={styles.lockup}>
            <Wordmark hideMark size={isWide ? 40 : 32} />
            <Txt variant={isWide ? 'heading' : 'subhead'} weight="medium" tone="inkSoft" center>
              Your end-to-end encrypted{'\n'}knowledge vault.
            </Txt>
            <Txt variant="caption" tone="inkMuted" center>
              Pages, boards and notes — sealed with keys only you hold.
            </Txt>
          </View>
        </View>
      }
    >
      <View style={styles.actions}>
        <Button
          label="Create new identity"
          variant="primary"
          size="lg"
          full
          onPress={() => router.push('/(onboarding)/seed')}
        />
        <Button
          label="I have a recovery seed"
          variant="secondary"
          size="lg"
          full
          onPress={() => router.push('/(onboarding)/recover')}
        />

        <Button
          label={moreOpen ? 'Fewer options' : 'More options'}
          variant="ghost"
          size="sm"
          full
          iconName={moreOpen ? 'chevron-up' : 'chevron-down'}
          onPress={() => setMoreOpen((v) => !v)}
        />
        {moreOpen ? (
          <Reveal>
            <View style={styles.more}>
              <Button
                // The web build has no camera scanner — promise the paste flow
                // it actually delivers; native promises the scan it has.
                label={Platform.OS === 'web' ? 'Pair from an existing device' : 'Scan QR from existing device'}
                variant="ghost"
                size="md"
                full
                iconName={Platform.OS === 'web' ? 'devices' : 'qr'}
                onPress={() => router.push('/pair')}
              />
              {nostrAvailable ? (
                <>
                  <Button
                    label="Login with Nostr extension"
                    variant="ghost"
                    size="md"
                    full
                    iconName="key"
                    loading={busy}
                    onPress={onNostrLogin}
                  />
                  <Txt variant="caption" tone="inkMuted" center>
                    Use a deterministic NIP-07 extension (nos2x, Alby) — a randomized signer would lock you out on reinstall.
                  </Txt>
                </>
              ) : null}
            </View>
          </Reveal>
        ) : null}

        {error ? (
          <Txt variant="footnote" tone="danger" center>
            {error}
          </Txt>
        ) : null}
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  lockup: {
    alignItems: 'center',
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
  more: {
    gap: spacing.md,
  },
});
