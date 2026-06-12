/**
 * React hook: returns the current Argon2id derivation progress (0..1) while
 * it is in flight, or `null` when idle.
 *
 * The pure subscription primitive lives in the SDK's hash-wasm shim
 * (`subscribeArgon2Progress`); this thin wrapper keeps the React import out of
 * the SDK while giving onboarding screens a convenient hook.
 */
import { useEffect, useState } from 'react';

import { subscribeArgon2Progress } from '@drakkar.software/octovault-sdk/platform';

export function useArgon2Progress(): number | null {
  const [p, setP] = useState<number | null>(null);
  useEffect(() => subscribeArgon2Progress(setP), []);
  return p;
}
