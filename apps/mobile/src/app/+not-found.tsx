import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/theme';
import { HeroMark } from '@/components/brand/HeroMark';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Txt } from '@/components/ui/Txt';

/** 404 — an unknown deep link or a stale URL. On-brand (the octopus mark, not a
 *  generic globe) and recoverable: go back when there's history to return to,
 *  land in the Vault otherwise, or hand off to search to find the page that moved. */
export default function NotFound() {
  const canGoBack = router.canGoBack();
  return (
    <Screen style={styles.screen}>
      <View style={styles.wrap}>
        <HeroMark size={96} />
        <Txt variant="title" weight="bold" center style={styles.title}>
          Lost at sea
        </Txt>
        <Txt variant="callout" tone="inkSoft" center>
          This page has drifted out of reach — it may have moved, or the link may be wrong.
        </Txt>
        <View style={styles.actions}>
          {canGoBack ? <Button label="Go back" variant="secondary" iconName="arrow-l" onPress={() => router.back()} /> : null}
          <Button label="Back to the Vault" variant="primary" onPress={() => router.replace('/(tabs)/work')} />
        </View>
        <Button
          label="Search instead"
          variant="ghost"
          size="sm"
          iconName="search"
          onPress={() => router.replace('/(tabs)/search')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  // Reuse the onboarding column so the copy + actions hold a readable measure.
  wrap: { alignItems: 'center', gap: spacing.md, padding: spacing.xl, maxWidth: layout.authColumnWidth, alignSelf: 'center', width: '100%' },
  // The mark's halo blooms past the disc — give the title room so rings don't ride onto it.
  title: { marginTop: spacing.lg },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
