import { Platform, StyleSheet } from 'react-native';

import { spacing } from '@/theme';
import { isDesktop } from '@/lib/desktop';
import { useNotificationSettings } from '@/lib/notification-settings-context';
import { Card } from '@/components/ui/Card';
import { Divider } from '@/components/ui/Divider';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { Txt } from '@/components/ui/Txt';

/**
 * The NOTIFICATIONS section of the profile screen. Reads/writes the shared
 * per-identity notification preferences; the sub-settings dim and lock while
 * the master toggle is off. The sound toggle only appears on desktop (Electron),
 * where the app controls its own notification sound — mobile push sound follows
 * the platform channel.
 */
export function NotificationSettingsCard() {
  const { settings, update } = useNotificationSettings();
  const off = !settings.enabled;
  // iOS renders its banner from the generic payload, so it can't show a
  // decrypted preview — lock the toggle off and say so.
  const previewUnsupported = Platform.OS === 'ios';

  return (
    <Card title="NOTIFICATIONS">
      <ToggleRow
        iconName="bell"
        title="Enable notifications"
        detail="Alert me about changes in your spaces"
        value={settings.enabled}
        onValueChange={(enabled) => update({ enabled })}
      />
      <Divider style={styles.divider} />
      <ToggleRow
        iconName="eye"
        title="Show content preview"
        detail={
          previewUnsupported
            ? 'Not yet supported on iOS — the system renders the banner'
            : 'Decrypt and show what changed'
        }
        value={previewUnsupported ? false : settings.preview}
        onValueChange={(preview) => update({ preview })}
        disabled={off || previewUnsupported}
      />
      {isDesktop() ? (
        <>
          <Divider style={styles.divider} />
          <ToggleRow
            iconName="volume"
            title="Play sound"
            detail="Play a sound with each notification"
            value={settings.sound}
            onValueChange={(sound) => update({ sound })}
            disabled={off}
          />
        </>
      ) : null}
      <Txt variant="micro" tone="inkMuted" style={styles.note}>
        Previews are decrypted on this device — including on the lock screen on Android.
        iOS shows a generic banner; its preview and sound follow your system settings.
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  divider: { marginVertical: spacing.xs },
  note: { marginTop: spacing.xs },
});
