import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { spacing, type as typeScale } from '@/theme';
import { humanizeError } from '@drakkar.software/octovault-sdk';
import { usePinKeys } from '@/lib/use-pin-keys';
import { completeDevicePairing, type PairResult } from '@drakkar.software/octovault-sdk';
import { useSession } from '@/lib/session-context';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Pill } from '@/components/ui/Pill';
import { TextField } from '@/components/ui/TextField';
import { Txt } from '@/components/ui/Txt';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import { PinDots } from '@/components/onboarding/PinDots';
import { PinPad } from '@/components/onboarding/PinPad';
import { QrScanner } from '@/components/onboarding/QrScanner';
import { SeedLockSetup } from '@/components/onboarding/SeedLockSetup';

const PIN_LENGTH = 6;

/** New-device side of pairing: capture the code (camera on native, paste on web),
 *  then re-enter the 6-digit transfer PIN on the same PinPad it was created on —
 *  full entry parity with `account/add-device` instead of a free-form TextInput. */
export default function PairScreen() {
  const { addLinkedDevice, session, passkeyAvailable } = useSession();
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [result, setResult] = useState<PairResult | null>(null);

  const pair = async (payload: string, enteredPin: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await completeDevicePairing(payload.trim(), enteredPin));
    } catch (e) {
      setError(humanizeError(e, 'Pairing failed. Check the code and the transfer PIN, then try again.'));
      setShake((k) => k + 1);
      setPin(''); // also prevents the auto-pair effect from re-firing the same attempt
    } finally {
      setBusy(false);
    }
  };

  // Auto-pair the moment both halves are present — order-independent, so pasting
  // the code after typing the PIN works too. A failed attempt clears the PIN,
  // which keeps this from looping on the same bad pair.
  useEffect(() => {
    if (result || busy) return;
    if (code.trim() && pin.length === PIN_LENGTH) void pair(code, pin);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pair is stable enough; deps below are the actual triggers
  }, [code, pin, result, busy]);

  const onDigit = (d: string) => {
    if (busy) return;
    setPin((p) => (p.length < PIN_LENGTH ? p + d : p));
  };
  const onDelete = () => setPin((p) => p.slice(0, -1));
  // Hardware-keyboard parity (web). Off once paired — the success state may host
  // SeedLockSetup, which runs its own PIN listener.
  usePinKeys({ onDigit, onDelete, enabled: !busy && !result });

  if (result) {
    const linked = { userId: result.userId, keys: result.deviceKeys, capCert: result.capCert };
    // A signed-out web device must set an app-lock (PIN) before its vault can be
    // sealed. Native (Keychain) and an already-unlocked web vault add without one.
    const needsLock = Platform.OS === 'web' && !session;
    return (
      <AuthScreen
        header={<AppBar title="Device paired" subtitle="New device" onBack={() => router.back()} />}
      >
        <View style={styles.verified}>
          <Pill tone="success" label="VERIFIED ✓" mono />
          <Txt variant="title" weight="bold" center>
            Fingerprint matches
          </Txt>
          <Txt variant="callout" mono tone="inkSoft" center>
            {result.fingerprint}
          </Txt>
        </View>
        <Callout tone="info" iconName="shield">
          Pairing validated for identity {result.userId.slice(0, 8)}…. Your owned spaces
          are ready on this device; spaces you only joined need a re-invite from their
          owner.
        </Callout>
        {error ? (
          <Callout tone="danger" iconName="alert">
            {error}
          </Callout>
        ) : null}
        {needsLock ? (
          <SeedLockSetup
            passkeyAvailable={passkeyAvailable}
            onSubmit={(lock) => addLinkedDevice(linked, undefined, lock)}
            onDone={() => router.replace('/(tabs)/work')}
          />
        ) : (
          <Button
            label={adding ? 'Adding…' : 'Add this device'}
            variant="primary"
            size="lg"
            full
            loading={adding}
            disabled={adding}
            onPress={async () => {
              setAdding(true);
              setError(null);
              try {
                await addLinkedDevice(linked);
                router.replace('/(tabs)/work');
              } catch (e) {
                setError(humanizeError(e, 'Couldn’t add this device. Try again.'));
                setAdding(false);
              }
            }}
          />
        )}
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      header={
        <AppBar title="Pair this device" subtitle="New device" onBack={() => router.back()} />
      }
    >
      {Platform.OS !== 'web' ? <QrScanner onScan={(d) => setCode(d)} /> : null}

      <View style={styles.section}>
        <Txt variant="micro" weight="semibold" mono uppercase tone="inkMuted">
          Pairing code
        </Txt>
        <Txt variant="footnote" tone="inkSoft">
          {Platform.OS === 'web'
            ? 'Paste the code from “Copy code” on your existing device.'
            : 'Scan the QR above, or paste the code.'}
        </Txt>
        <TextField
          value={code}
          onChangeText={setCode}
          placeholder="octovault-pair:…"
          mono
          multiline
          minHeight={72}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.pinBlock}>
        <Txt variant="caption" weight="semibold" mono uppercase tone="inkSoft" center>
          {busy ? 'Pairing…' : 'Enter the transfer PIN'}
        </Txt>
        <PinDots length={PIN_LENGTH} filled={pin.length} shake={shake} />
        {/* Reserved slot: a failed pair reports here without jolting the pad. */}
        <View style={styles.errorSlot}>
          {error ? (
            <Txt variant="footnote" tone="danger" center>
              {error}
            </Txt>
          ) : null}
        </View>
      </View>

      <PinPad onDigit={onDigit} onDelete={onDelete} />

      <Txt variant="caption" tone="inkMuted" center>
        The 6-digit PIN was created on your existing device when it showed the QR.
      </Txt>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  verified: { alignItems: 'center', gap: spacing.sm },
  section: { gap: spacing.xs },
  pinBlock: { gap: spacing.md },
  errorSlot: { minHeight: typeScale.footnote.lineHeight, justifyContent: 'center' },
});
