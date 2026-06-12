import { useCallback, useEffect, useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { spacing, type as typeScale } from '@/theme';
import { humanizeError } from '@drakkar.software/octovault-sdk';
import { pendingSeedWords, setAuthFlow, stepSubtitle, useFirstRunSpace } from '@/lib/onboarding-steps';
import { useArgon2Progress } from '@/lib/use-argon2-progress';
import { useSession } from '@/lib/session-context';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Txt } from '@/components/ui/Txt';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import { SeedBackup } from '@/components/onboarding/SeedBackup';
import { SeedVerify } from '@/components/onboarding/SeedVerify';

/** Backup (reveal-gated) → verify (re-enter two words) → finalize. */
type Stage = 'backup' | 'verify';

export default function SeedScreen() {
  const { signIn, prepareSignIn, session } = useSession();
  // Stable across back-navigation: the words live in the module-level stash, NOT
  // a per-mount useMemo — re-entering this screen must show the SAME phrase the
  // user may already have written down (see onboarding-steps.ts).
  const words = useMemo(() => pendingSeedWords('onboarding'), []);
  const [stage, setStage] = useState<Stage>('backup');
  const [revealed, setRevealed] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const argon2 = useArgon2Progress();
  const firstRun = useFirstRunSpace();

  useEffect(() => setAuthFlow('create'), []);
  const onValidChange = useCallback((v: boolean) => setVerified(v), []);

  // Already signed in: this screen creates the FIRST account, so running signIn here
  // would replace the whole vault. Adding accounts goes through /account/* instead.
  // `busy`/`finishing` suppress the redirect through our OWN sign-in: the session
  // lands mid-await, and unmounting here would skip the first-run space seeding.
  if (session && !busy && !firstRun.finishing) return <Redirect href="/(tabs)/work" />;

  const confirm = async () => {
    if (busy) return;
    // First account on web: the seed must be sealed behind a PIN/passkey before it
    // touches disk, so route through the lock-setup screen instead of persisting here.
    if (Platform.OS === 'web') {
      prepareSignIn(words);
      router.push('/(onboarding)/lock');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(words);
      // Stays busy until useFirstRunSpace seeds the Personal space + navigates.
      firstRun.finish();
    } catch (e) {
      setError(humanizeError(e, 'Couldn’t create your identity. Try again.'));
      setBusy(false);
    }
  };

  const onBack = () => {
    if (stage === 'verify') setStage('backup');
    else router.back();
  };

  return (
    <AuthScreen
      header={
        <AppBar
          title={stage === 'backup' ? 'Back up your seed' : 'Verify your backup'}
          subtitle={stepSubtitle('create', stage === 'backup' ? 0 : 1)}
          onBack={onBack}
          right={<IconButton name="x" onPress={() => router.back()} accessibilityLabel="Cancel" tooltip="Cancel" />}
        />
      }
      footer={
        <View style={styles.footer}>
          {stage === 'backup' ? (
            <Button
              label="I've written it down"
              variant="primary"
              size="lg"
              full
              iconName="arrow-r"
              // Reveal-gated: you can't claim a backup of words you never saw.
              disabled={!revealed}
              onPress={() => setStage('verify')}
            />
          ) : (
            <>
              <Button
                label={busy ? 'Creating identity…' : 'Create identity'}
                variant="primary"
                size="lg"
                full
                loading={busy}
                disabled={busy || !verified}
                onPress={confirm}
              />
              {/* Dedicated progress line (reserved height — no layout shift) so the
                  multi-second Argon2id derivation reads as real progress instead of
                  a percentage spliced into a button label. */}
              <View style={styles.progressSlot}>
                {busy && argon2 != null ? (
                  <Txt variant="caption" mono tone="inkMuted" center>
                    Deriving keys… {Math.round(argon2 * 100)}%
                  </Txt>
                ) : null}
              </View>
            </>
          )}
        </View>
      }
    >
      {stage === 'backup' ? (
        <SeedBackup words={words} error={error} onRevealed={() => setRevealed(true)} />
      ) : (
        <>
          <SeedVerify words={words} onValidChange={onValidChange} />
          {error ? (
            <Txt variant="footnote" tone="danger" center>
              {error}
            </Txt>
          ) : null}
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.xs },
  progressSlot: { minHeight: typeScale.caption.lineHeight, justifyContent: 'center' },
});
