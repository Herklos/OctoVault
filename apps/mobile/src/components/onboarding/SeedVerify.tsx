import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { useTheme } from '@/lib/use-theme';
import { Icon } from '@/components/ui/Icon';
import { TextField } from '@/components/ui/TextField';
import { Txt } from '@/components/ui/Txt';

interface SeedVerifyProps {
  /** The full 12-word phrase the user just claimed to have written down. */
  words: readonly string[];
  /** Reports whether BOTH challenge words currently match — the parent gates its
   *  confirm CTA on this, keeping the heavy submit handler in one place. */
  onValidChange: (valid: boolean) => void;
}

/** Two distinct random indices, biased apart so the user has to consult the
 *  whole written phrase rather than its first line. */
function pickChallenge(count: number): [number, number] {
  const first = Math.floor(Math.random() * Math.floor(count / 2)); // first half
  const second = Math.floor(count / 2) + Math.floor(Math.random() * Math.ceil(count / 2)); // second half
  return [first, second];
}

/**
 * The recovery-credential verification ceremony (the 1Password/Anytype-grade
 * step the funnel was missing): before an irrecoverable E2EE identity is
 * finalized, the user re-enters two randomly-chosen words from the phrase —
 * proof the words actually made it onto paper, not just past a button. Pure
 * presentation: the parent owns the stage machine and the final submit.
 */
export function SeedVerify({ words, onValidChange }: SeedVerifyProps) {
  const { colors } = useTheme();
  // Stable per mount: re-rolling the challenge on every keystroke render would
  // make the fields chase a moving target.
  const [a, b] = useMemo(() => pickChallenge(words.length), [words]);
  const [entryA, setEntryA] = useState('');
  const [entryB, setEntryB] = useState('');

  const matchA = entryA.trim().toLowerCase() === words[a];
  const matchB = entryB.trim().toLowerCase() === words[b];

  useEffect(() => {
    onValidChange(matchA && matchB);
  }, [matchA, matchB, onValidChange]);

  return (
    <View style={styles.block}>
      <Txt variant="body" tone="inkSoft">
        Check your backup: type word{' '}
        <Txt variant="body" weight="bold" tone="ink">
          #{a + 1}
        </Txt>{' '}
        and word{' '}
        <Txt variant="body" weight="bold" tone="ink">
          #{b + 1}
        </Txt>{' '}
        from your written phrase.
      </Txt>

      <ChallengeField index={a} value={entryA} onChangeText={setEntryA} matched={matchA} autoFocus />
      <ChallengeField index={b} value={entryB} onChangeText={setEntryB} matched={matchB} />

      {matchA && matchB ? (
        <View style={styles.okRow}>
          <Icon name="check-circle" size={14} color={colors.success} />
          <Txt variant="footnote" tone="success">
            Backup confirmed.
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

interface ChallengeFieldProps {
  index: number;
  value: string;
  onChangeText: (v: string) => void;
  matched: boolean;
  autoFocus?: boolean;
}

/** One labeled word entry with a quiet trailing check once it matches. */
function ChallengeField({ index, value, onChangeText, matched, autoFocus = false }: ChallengeFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Txt variant="micro" weight="semibold" mono uppercase tone="inkMuted">
        Word #{index + 1}
      </Txt>
      <View style={styles.fieldRow}>
        <View style={styles.fieldInput}>
          <TextField
            value={value}
            onChangeText={onChangeText}
            placeholder="word"
            mono
            autoFocus={autoFocus}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            accessibilityLabel={`Word number ${index + 1}`}
          />
        </View>
        {/* Fixed-width status slot so the check appearing never shifts the field. */}
        <View style={styles.status}>
          {matched ? <Icon name="check" size={16} color={colors.success} /> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.lg },
  field: { gap: spacing.xs },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fieldInput: { flex: 1 },
  status: { width: spacing.xl, alignItems: 'center' },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
