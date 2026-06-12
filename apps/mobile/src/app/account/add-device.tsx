import { useEffect, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { spacing, type as typeScale } from '@/theme';
import { humanizeError } from '@drakkar.software/octovault-sdk';
import { stepSubtitle } from '@/lib/onboarding-steps';
import { usePinKeys } from '@/lib/use-pin-keys';
import { startDevicePairing } from '@drakkar.software/octovault-sdk';
import { useSession } from '@/lib/session-context';
import { successFeedback } from '@/lib/haptics';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { CopyButton } from '@/components/ui/CopyButton';
import { IconButton } from '@/components/ui/IconButton';
import { Txt } from '@/components/ui/Txt';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import { PinDots } from '@/components/onboarding/PinDots';
import { PinPad } from '@/components/onboarding/PinPad';
import { QrCode } from '@/components/onboarding/QrCode';

const PIN_LENGTH = 6;

/** Step 1: create a one-time TRANSFER PIN → Step 2: a real, PIN-sealed pairing QR
 *  to scan. The PIN here is NOT the app-lock PIN — it's minted for this handoff
 *  and typed once more on the new device, so the copy must say so (native users
 *  have no app-lock PIN at all and were being told to "confirm" one).
 *  Lives under `account/` (not `(onboarding)/`) — entered only from settings on
 *  an already-unlocked vault, so it must not be gated by the onboarding stack. */
export default function AddDeviceScreen() {
  const { session } = useSession();
  const [pin, setPin] = useState('');
  const [stage, setStage] = useState<'pin' | 'qr'>('pin');
  const [payload, setPayload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || !session) return;
    let cancelled = false;
    successFeedback();
    (async () => {
      try {
        const qr = await startDevicePairing(session, pin);
        if (!cancelled) {
          setPayload(qr);
          setStage('qr');
        }
      } catch (e) {
        if (!cancelled) {
          setError(humanizeError(e, 'Couldn’t prepare the pairing code. Try again.'));
          setShake((k) => k + 1);
          setPin('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pin, session]);

  const onDigit = (d: string) => setPin((p) => (p.length < PIN_LENGTH ? p + d : p));
  const onDelete = () => setPin((p) => p.slice(0, -1));
  // Hardware keyboard parity with every other PIN surface (web only).
  usePinKeys({ onDigit, onDelete, enabled: stage === 'pin' });

  // Settings-only flow: bail to the root (which redirects to onboarding) if we
  // somehow land here without an unlocked vault.
  if (!session) return <Redirect href="/" />;

  const fingerprint = session.fingerprint;
  const close = () => router.back();

  if (stage === 'pin') {
    return (
      <AuthScreen
        scroll={false}
        header={
          <AppBar
            title="Add a device"
            subtitle={stepSubtitle('add-device', 0)}
            onBack={() => router.back()}
            right={<IconButton name="x" onPress={close} accessibilityLabel="Cancel" tooltip="Cancel" />}
          />
        }
      >
        <Callout tone="accent" iconName="shield" title="Create a one-time transfer PIN">
          Pick any 6 digits. They seal the pairing code — you&apos;ll type the same PIN once on
          the new device, then it&apos;s never used again.
        </Callout>

        <View style={styles.pinBlock}>
          <Txt variant="caption" weight="semibold" mono uppercase tone="inkSoft" center>
            Create a PIN
          </Txt>
          <PinDots length={PIN_LENGTH} filled={pin.length} shake={shake} />
          {/* Reserved slot so a failure doesn't shove the keypad down. */}
          <View style={styles.errorSlot}>
            {error ? (
              <Txt variant="footnote" tone="danger" center>
                {error}
              </Txt>
            ) : null}
          </View>
        </View>

        <PinPad onDigit={onDigit} onDelete={onDelete} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      header={
        <AppBar
          title="Scan from new device"
          subtitle={stepSubtitle('add-device', 1)}
          onBack={() => {
            setPin('');
            setPayload(null);
            setStage('pin');
          }}
          right={<IconButton name="x" onPress={close} accessibilityLabel="Cancel" tooltip="Cancel" />}
        />
      }
      footer={<Button label="Done" variant="primary" size="lg" full onPress={close} />}
    >
      <Txt variant="callout" tone="inkSoft" center>
        On the new device, choose{' '}
        <Txt variant="callout" weight="bold" tone="ink">
          {Platform.OS === 'web' ? 'Pair from an existing device' : 'Scan QR from existing device'}
        </Txt>{' '}
        and scan this — then enter the same transfer PIN.
      </Txt>

      <View style={styles.qrWrap}>{payload ? <QrCode size={240} value={payload} /> : null}</View>

      {/* Honest status: nothing on this side can observe the scan, so say what
          to do instead of faking a "WAITING…" live indicator. */}
      <Txt variant="caption" tone="inkMuted" center>
        Keep this screen open while the new device finishes, then tap Done.
      </Txt>
      {Platform.OS === 'web' && payload ? (
        <View style={styles.copyRow}>
          <CopyButton value={payload} label="Copy code" />
        </View>
      ) : null}

      <Callout tone="info" iconName="key">
        Fingerprint {fingerprint} — verify it matches on both devices.
      </Callout>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  pinBlock: { gap: spacing.md },
  errorSlot: { minHeight: typeScale.footnote.lineHeight, justifyContent: 'center' },
  qrWrap: { alignItems: 'center' },
  copyRow: { alignItems: 'center' },
});
