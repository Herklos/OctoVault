import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { getSyncBase } from '@drakkar.software/octovault-sdk';
import { useServerHealth, type HealthStatus } from '@/lib/use-server-health';
import { useTheme } from '@/lib/use-theme';
import { Card } from '@/components/ui/Card';
import { Row } from '@/components/ui/Row';
import { Txt } from '@/components/ui/Txt';

const STATUS_LABEL: Record<HealthStatus, string> = {
  checking: 'Checking…',
  ok: 'Reachable',
  down: 'Unreachable',
};

/**
 * Diagnostics card under the profile: shows whether the Starfish server
 * (EXPO_PUBLIC_STARFISH_URL) is reachable. Tap the row to re-probe; the probe
 * also re-runs on an interval.
 */
export function DebugStatsCard() {
  const { colors } = useTheme();
  const { status, latencyMs, recheck } = useServerHealth();
  const dotColor = status === 'ok' ? colors.success : status === 'down' ? colors.danger : colors.warning;

  return (
    <Card title="DIAGNOSTICS">
      <Row
        iconName="globe"
        title="Server"
        detail={getSyncBase()}
        detailMono
        onPress={recheck}
        right={
          <View style={styles.statusColumn}>
            <View style={styles.statusGroup}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              <Txt variant="caption" weight="semibold" mono>{STATUS_LABEL[status]}</Txt>
            </View>
            {status === 'ok' ? <Txt variant="caption" tone="inkMuted" mono>{latencyMs}ms</Txt> : null}
          </View>
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  statusColumn: { alignItems: 'flex-end', gap: spacing.xs },
  statusGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
