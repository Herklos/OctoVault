import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { layout, radii, spacing } from '@/theme';
import { useTheme } from '@/lib/use-theme';

import { Button } from './Button';
import { CopyButton } from './CopyButton';
import { EmptyState } from './EmptyState';
import { Txt } from './Txt';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Short label for which surface failed ("Page", "Board") — folds into the copy
   *  ("this page hit an error…") and the console log. */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Catches a render/lifecycle exception in its subtree so one broken screen never
 * takes down the whole app. Users get a friendly recovery surface — "Try again"
 * (clears the error and remounts the children: most crashes are transient, a bad
 * pull or a race) and "Back to the Vault" — with the technical details tucked
 * behind a disclosure. The raw stacks render only in __DEV__; in production the
 * disclosure shows the error name/message and a copy button so a user can still
 * hand us a useful report. (React error boundaries must be class components; the
 * themed surface is a function child so it can use {@link useTheme}.)
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    // eslint-disable-next-line no-console -- surface the stack to the dev console too
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info.componentStack);
  }

  /** Clear the caught error and re-render the children. If the cause persists the
   *  boundary just catches again — never worse than staying on the crash screen. */
  reset = () => this.setState({ error: null, componentStack: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <CrashScreen
        error={this.state.error}
        componentStack={this.state.componentStack}
        label={this.props.label}
        onReset={this.reset}
      />
    );
  }
}

interface CrashScreenProps {
  error: Error;
  componentStack: string | null;
  label?: string;
  onReset: () => void;
}

function CrashScreen({ error, componentStack, label, onReset }: CrashScreenProps) {
  const { colors } = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const what = label ? label.toLowerCase() : 'screen';
  // Full report for the copy button — includes the stacks even when they aren't
  // rendered (production), so a user-pasted report is still diagnosable.
  const report = [label ? `[${label}]` : null, `${error.name}: ${error.message}`, error.stack ?? null, componentStack]
    .filter(Boolean)
    .join('\n\n');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <EmptyState
        iconName="alert"
        title="Something went wrong"
        subtitle={`This ${what} hit an error it couldn’t recover from. Your notes are safe — try again, or head back to your vault.`}
      >
        <View style={styles.actions}>
          <Button label="Try again" variant="primary" iconName="refresh" onPress={onReset} />
          <Button label="Back to the Vault" variant="secondary" onPress={() => router.replace('/(tabs)/work')} />
        </View>
        <Button
          label={showDetails ? 'Hide details' : 'Show details'}
          variant="ghost"
          size="sm"
          iconName={showDetails ? 'chevron-up' : 'chevron-down'}
          onPress={() => setShowDetails((s) => !s)}
        />
        {showDetails ? (
          <View style={[styles.details, { borderColor: colors.lineFaint, backgroundColor: colors.codeBg }]}>
            <Txt variant="footnote" weight="bold" mono tone="danger" selectable>
              {error.name}: {error.message}
            </Txt>
            {__DEV__ && error.stack ? (
              <Txt variant="caption" mono tone="inkMuted" selectable>
                {error.stack}
              </Txt>
            ) : null}
            {__DEV__ && componentStack ? (
              <Txt variant="caption" mono tone="inkFaint" selectable>
                {componentStack}
              </Txt>
            ) : null}
            <CopyButton value={report} label="Copy details" />
          </View>
        ) : null}
      </EmptyState>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { flexGrow: 1, padding: spacing.xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  details: {
    width: '100%',
    maxWidth: layout.dialogMaxWidth,
    alignSelf: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
});
