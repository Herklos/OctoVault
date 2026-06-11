import { StyleSheet } from 'react-native';

import { spacing } from '@/theme';
import { useAiSettings } from '@/lib/ai-settings-context';
import { Card } from '@/components/ui/Card';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { Txt } from '@/components/ui/Txt';

/**
 * The AI section of the profile screen. Exposes the master toggle for AI
 * agents & suggestions; model management and per-feature knobs land alongside
 * the Agents/AI backend in a later pass.
 */
export function AiSettingsCard() {
  const { settings, update } = useAiSettings();

  return (
    <Card title="AI">
      <ToggleRow
        iconName="agents"
        title="AI agents & suggestions"
        detail="Draft and summarize inside your spaces — on-device."
        value={settings.enabled}
        onValueChange={(enabled) => update({ enabled })}
      />
      <Txt variant="micro" tone="inkMuted" style={styles.note}>
        Runs on-device when available. Agent automations are coming soon.
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: spacing.xs },
});
