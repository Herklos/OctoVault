import { useState } from 'react';
import { Redirect, router } from 'expo-router';

import { humanizeError } from '@/lib/errors';
import { useSession } from '@/lib/session-context';
import { AppBar } from '@/components/ui/AppBar';
import { IconButton } from '@/components/ui/IconButton';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import { SeedRecoverForm } from '@/components/onboarding/SeedRecoverForm';

/** Add-account · recover: append an existing seed to the unlocked vault and
 *  switch to it (no PIN step). */
export default function RecoverAccountScreen() {
  const { session, addAccount } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reached without an unlocked vault (e.g. a stale deep link) — nothing to add to.
  if (!session) return <Redirect href="/" />;

  const add = async (words: string[]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await addAccount(words);
      router.replace('/(tabs)/work');
    } catch (e) {
      setError(humanizeError(e, 'Couldn’t add that account. Check the words and try again.'));
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      header={
        <AppBar
          title="Recover identity"
          subtitle="Add an existing account"
          onBack={() => router.back()}
          right={<IconButton name="x" onPress={() => router.back()} accessibilityLabel="Cancel" tooltip="Cancel" />}
        />
      }
    >
      <SeedRecoverForm submitLabel="Add account" busy={busy} error={error} onSubmit={add} />
    </AuthScreen>
  );
}
