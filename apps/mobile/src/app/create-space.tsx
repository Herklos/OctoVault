import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { humanizeError } from '@drakkar.software/octovault-sdk';
import { useSession } from '@/lib/session-context';
import { useSpaces } from '@/lib/use-spaces';
import { AppBar } from '@/components/ui/AppBar';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { SignInPrompt } from '@/components/ui/SignInPrompt';
import { StackScreen } from '@/components/ui/StackScreen';
import { TextField } from '@/components/ui/TextField';
import { Txt } from '@/components/ui/Txt';
import { AuthScreen } from '@/components/onboarding/AuthScreen';

type SpaceType = 'private' | 'public';

/**
 * Creating a space — its own screen (reached from the space switcher / rail "+"
 * and the foot of /join), split out of the old three-cards-in-one join screen so
 * each job reads on its own.
 */
export default function CreateSpaceScreen() {
  const { session } = useSession();
  const { createSpace, setActiveId } = useSpaces();
  const [name, setName] = useState('');
  const [type, setType] = useState<SpaceType>('private');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/work'));

  if (!session) {
    return (
      <StackScreen header={<AppBar title="Create a space" onBack={goBack} />}>
        <SignInPrompt subtitle="Create an identity to start a space." />
      </StackScreen>
    );
  }

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const space = await createSpace(name, type);
      if (!space) throw new Error('Could not create the space.');
      // Land directly inside the new space's vault.
      setActiveId(space.id);
      router.replace('/(tabs)/work');
    } catch (e) {
      setError(humanizeError(e, 'Couldn’t create the space. Try again.'));
      setBusy(false);
    }
  };

  return (
    <AuthScreen trust={false} header={<AppBar title="Create a space" onBack={goBack} />}>
      <View style={styles.field}>
        <Txt variant="micro" weight="semibold" mono uppercase tone="inkMuted">
          Name
        </Txt>
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="e.g. Research, Family, Side project…"
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={create}
          returnKeyType="go"
        />
      </View>

      <View style={styles.field}>
        <Txt variant="micro" weight="semibold" mono uppercase tone="inkMuted">
          Visibility
        </Txt>
        <View style={styles.typeRow}>
          <Button
            label="Private"
            variant={type === 'private' ? 'primary' : 'secondary'}
            size="sm"
            iconName="lock"
            onPress={() => setType('private')}
          />
          <Button
            label="Public"
            variant={type === 'public' ? 'primary' : 'secondary'}
            size="sm"
            iconName="globe"
            onPress={() => setType('public')}
          />
        </View>
        <Txt variant="footnote" tone="inkSoft">
          {type === 'private'
            ? 'End-to-end encrypted. Members join by encrypted invite. You’ll be its owner.'
            : 'Plaintext — anyone with the invitation link can read (or, with a read/write link, post). You’ll be its owner.'}
        </Txt>
      </View>

      {type === 'public' ? (
        <Callout tone="warning" iconName="unlock" title="Not end-to-end encrypted">
          A public space is stored as plaintext the server can read. Don’t use it for anything sensitive.
        </Callout>
      ) : null}

      <Button
        label={busy ? 'Creating…' : type === 'public' ? 'Create public space' : 'Create space'}
        variant="primary"
        size="lg"
        full
        loading={busy}
        disabled={busy || !name.trim()}
        onPress={create}
      />

      {error ? (
        <Callout tone="danger" iconName="alert">
          {error}
        </Callout>
      ) : null}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
});
