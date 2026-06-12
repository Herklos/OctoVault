import { useCallback, useMemo, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { spacing, type as typeScale } from '@/theme';
import { humanizeError } from '@drakkar.software/octovault-sdk';
import { clearPendingSeedWords, pendingSeedWords, stepSubtitle } from '@/lib/onboarding-steps';
import { useArgon2Progress } from '@/lib/use-argon2-progress';
import { useSession } from '@/lib/session-context';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Txt } from '@/components/ui/Txt';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import { SeedBackup } from '@/components/onboarding/SeedBackup';
import { SeedVerify } from '@/components/onboarding/SeedVerify';

type Stage = 'backup' | 'verify';

/** Add-account · create: generate a fresh seed, back it up (reveal-gated, then
 *  verified word-by-word), and append it to the unlocked vault (no PIN step —
 *  the vault lock already exists). */
export default function CreateAccountScreen() {
  const { session, addAccount } = useSession();
  // Module-level stash, not a per-mount useMemo: backing out and re-entering
  // must show the SAME words the user may have written down already.
  const words = useMemo(() => pendingSeedWords('add-account'), []);
  const [stage, setStage] = useState<Stage>('backup');
  const [revealed, setRevealed] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const argon2 = useArgon2Progress();
  const onValidChange = useCallback((v: boolean) => setVerified(v), []);

  // Reached without an unlocked vault (e.g. a stale deep link) — nothing to add to.
  if (!session) return <Redirect href="/" />;

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await addAccount(words);
      clearPendingSeedWords('add-account');
      router.replace('/(tabs)/work');
    } catch (e) {
      setError(humanizeError(e, 'Couldn’t add the account. Try again.'));
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
          subtitle={stepSubtitle('add-account', stage === 'backup' ? 0 : 1)}
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
              disabled={!revealed}
              onPress={() => setStage('verify')}
            />
          ) : (
            <>
              <Button
                label={busy ? 'Adding account…' : 'Add account'}
                variant="primary"
                size="lg"
                full
                loading={busy}
                disabled={busy || !verified}
                onPress={confirm}
              />
              {/* Dedicated Argon2id progress line (reserved height — no shift),
                  mirroring the first-identity ceremony. */}
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
