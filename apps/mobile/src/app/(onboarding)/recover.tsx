import { useEffect, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Platform } from 'react-native';

import { humanizeError } from '@/lib/errors';
import { setAuthFlow, stepSubtitle, useFirstRunSpace } from '@/lib/onboarding-steps';
import { useSession } from '@/lib/session-context';
import { AppBar } from '@/components/ui/AppBar';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import { SeedRecoverForm } from '@/components/onboarding/SeedRecoverForm';

export default function RecoverScreen() {
  const { signIn, prepareSignIn, session } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRun = useFirstRunSpace();

  useEffect(() => setAuthFlow('recover'), []);

  // Already signed in: recovering here creates a NEW first account and replaces the
  // vault. Adding an existing seed as another account goes through /account/recover.
  // `busy`/`finishing` keep the screen mounted through our OWN sign-in (the session
  // lands mid-await, before the first-run hook navigates).
  if (session && !busy && !firstRun.finishing) return <Redirect href="/(tabs)/work" />;

  const restore = async (words: string[]) => {
    // First account on web: seal the recovered seed behind a PIN/passkey first.
    if (Platform.OS === 'web') {
      prepareSignIn(words);
      router.push('/(onboarding)/lock');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(words);
      // Stays busy until useFirstRunSpace resolves the spaces registry (a
      // recovered identity keeps its spaces; a blank one gets "Personal").
      firstRun.finish();
    } catch (e) {
      setError(humanizeError(e, 'Couldn’t recover that identity. Check the words and try again.'));
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      header={
        <AppBar title="Recover identity" subtitle={stepSubtitle('recover', 0)} onBack={() => router.back()} />
      }
    >
      <SeedRecoverForm submitLabel="Recover" busy={busy || firstRun.finishing} error={error} onSubmit={restore} />
    </AuthScreen>
  );
}
