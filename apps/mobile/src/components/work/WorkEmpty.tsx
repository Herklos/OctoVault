import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Empty state for a space with no content yet — shown once the object index has
 * loaded and holds no pages/boards (gated on `loaded`). Plain-spoken copy (the
 * encryption/CRDT story belongs in onboarding, not an empty screen) over two
 * LIVE create CTAs wired to `useObjects.create`.
 */
export function WorkEmpty({ onNewPage, onNewBoard, disabled }: { onNewPage: () => void; onNewBoard: () => void; disabled?: boolean }) {
  return (
    <View style={styles.floor}>
      <EmptyState
        iconName="book"
        title="Write your first page"
        subtitle="Pages hold your notes and documents; boards track work in columns. Everything here is private to this space and syncs to all your devices."
      >
        <View style={styles.actions}>
          <Button label="New page" variant="primary" iconName="plus" size="sm" disabled={disabled} onPress={onNewPage} />
          <Button label="New board" variant="secondary" iconName="plus" size="sm" disabled={disabled} onPress={onNewBoard} />
        </View>
      </EmptyState>
    </View>
  );
}

/**
 * Zero-SPACE state for the Vault tab — a brand-new identity has no space yet,
 * and the object store is disabled without one, so the create buttons above
 * would sit disabled forever ("Opening workspace…", the old dead end). This is
 * a live door instead: one CTA into the create/join flow.
 */
export function WorkNoSpaces() {
  const router = useRouter();
  return (
    <EmptyState
      iconName="lock"
      title="Create your first space"
      subtitle="A space is a private home for your pages and boards — end-to-end encrypted, shared only with people you invite."
    >
      <Button label="Create a space" variant="primary" iconName="plus" onPress={() => router.push('/join')} />
    </EmptyState>
  );
}

const styles = StyleSheet.create({
  floor: { minHeight: 320 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
});
