import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { copyText } from '@/lib/clipboard';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Txt } from '@/components/ui/Txt';

import { SeedGrid } from './SeedGrid';

interface SeedBackupProps {
  /** The 12-word recovery phrase to display. */
  words: readonly string[];
  /** A creation failure to surface in place of the default warning, if any. */
  error?: string | null;
  /** Lead-in copy; defaults to the first-time "write these down" wording. */
  intro?: ReactNode;
  /** Fires the FIRST time the grid is revealed. The seed ceremony gates its
   *  confirm CTA on this — a user must have at least seen the words before they
   *  can claim to have written them down (the grid mounts concealed). */
  onRevealed?: () => void;
}

/**
 * The recovery-seed backup body: a warning, the concealable 12-word grid, and
 * reveal / copy controls. Shared by first-account onboarding and add-account so
 * the phrase-handling UI stays identical. The confirm action lives in each
 * screen's footer — the handler differs (first sign-in vs. add-account).
 * Native deliberately gets no Copy button: the phrase belongs on paper, and the
 * mobile clipboard syncs to other apps/devices too eagerly to trust with it.
 */
export function SeedBackup({ words, error, intro, onRevealed }: SeedBackupProps) {
  const [revealed, setRevealed] = useState(false);
  const [everRevealed, setEverRevealed] = useState(false);

  const toggleReveal = () => {
    setRevealed((v) => {
      const next = !v;
      if (next && !everRevealed) {
        setEverRevealed(true);
        onRevealed?.();
      }
      return next;
    });
  };

  return (
    <>
      {intro ?? (
        <Txt variant="body" tone="inkSoft">
          Write these 12 words down somewhere private. They&apos;re the{' '}
          <Txt variant="body" weight="bold" tone="ink">
            only
          </Txt>{' '}
          way to recover your account.
        </Txt>
      )}

      <SeedGrid words={words} concealed={!revealed} />

      <View style={styles.actions}>
        <Button
          label={revealed ? 'Hide' : 'Reveal'}
          variant="ghost"
          size="sm"
          iconName={revealed ? 'eye-off' : 'eye'}
          onPress={toggleReveal}
        />
        {Platform.OS === 'web' ? (
          <Button
            label="Copy"
            variant="ghost"
            size="sm"
            iconName="copy"
            onPress={() => void copyText(words.join(' '))}
          />
        ) : null}
      </View>

      {error ? (
        <Callout tone="danger" iconName="alert" title="Couldn't create identity">
          {error}
        </Callout>
      ) : (
        <Callout tone="danger" iconName="alert" title="Keep them offline.">
          Anyone with these 12 words can read your notes forever. Paper beats screenshots.
        </Callout>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
