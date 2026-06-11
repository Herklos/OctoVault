import { useState } from 'react';
import { Redirect, router } from 'expo-router';

import { flowSteps, getAuthFlow, stepSubtitle, useFirstRunSpace } from '@/lib/onboarding-steps';
import type { SeedLock } from '@/lib/starfish/storage-types';
import { useSession } from '@/lib/session-context';
import { AppBar } from '@/components/ui/AppBar';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import { SeedLockSetup } from '@/components/onboarding/SeedLockSetup';

/** Web set-lock step: seal the staged identity (seed or Nostr-derived) behind a
 *  PIN (+ optional passkey). One vault format covers both origins. */
export default function LockScreen() {
  const {
    pendingSeed,
    pendingNostrIdentity,
    passkeyAvailable,
    signIn,
    signInWithRootIdentity,
    session,
  } = useSession();
  const firstRun = useFirstRunSpace();
  // True from the moment our own seal starts: signIn sets the session (and clears
  // the staged identity) mid-await, and without this flag the guards below would
  // unmount the screen before the first-run hook can seed the "Personal" space.
  const [submitting, setSubmitting] = useState(false);
  // This screen terminates three funnels (create / recover / Nostr) with
  // different step counts — the staging screen recorded which one is live so the
  // subtitle stays truthful (see onboarding-steps.ts).
  const flow = getAuthFlow();

  // Already signed in: this screen creates the FIRST account's app-lock, so running
  // signIn here would replace the whole vault. Adding accounts goes through
  // addAccount (no lock step), so bounce back into the app.
  if (session && !submitting && !firstRun.finishing) return <Redirect href="/(tabs)/work" />;
  // Reached without anything staged (e.g. a direct reload) — restart onboarding.
  // Branch order matches the staging order: the welcome handlers only set one of
  // the two at a time, so checking nostr first is enough.
  if (!pendingNostrIdentity && !pendingSeed && !submitting && !firstRun.finishing) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  const seal = pendingNostrIdentity
    ? (lock: SeedLock) => signInWithRootIdentity(pendingNostrIdentity.root, pendingNostrIdentity.name, lock)
    : (lock: SeedLock) => signIn(pendingSeed!.words, pendingSeed!.name, lock);

  const onSubmit = async (lock: SeedLock) => {
    setSubmitting(true);
    try {
      await seal(lock);
    } catch (e) {
      setSubmitting(false);
      throw e; // SeedLockSetup owns the error surface
    }
  };

  return (
    <AuthScreen
      header={
        <AppBar
          title="Secure this device"
          subtitle={stepSubtitle(flow, flowSteps(flow).length - 1)}
          onBack={() => router.back()}
        />
      }
    >
      <SeedLockSetup
        passkeyAvailable={passkeyAvailable}
        onSubmit={onSubmit}
        // First-run completion: seeds a "Personal" space when the registry is
        // empty (new identity), then replaces to the vault. A recovered identity
        // hydrates its existing spaces and skips the create.
        onDone={firstRun.finish}
      />
    </AuthScreen>
  );
}
