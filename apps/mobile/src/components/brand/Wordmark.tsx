import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { fonts, spacing } from '@/theme';
import { useTheme } from '@/lib/use-theme';

const LOGO = require('../../../assets/images/logo.png') as number;

interface WordmarkProps {
  /** Font size of the wordmark text; the mark scales with it. */
  size?: number;
  /** Override the ink color of "Octo" (the "Vault" half always uses accent). */
  color?: string;
  /** Hide the octopus mark and render text only. */
  hideMark?: boolean;
}

/** "🐙 OctoVault" lockup — editorial display type with the accent-colored "Vault". */
export function Wordmark({ size = 20, color, hideMark = false }: WordmarkProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {!hideMark && <Image source={LOGO} style={{ width: size + 10, height: size + 10 }} contentFit="contain" />}
      <Text style={[styles.text, { fontSize: size, color: color ?? colors.ink }]}>
        Octo<Text style={{ color: colors.accent }}>Vault</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    fontFamily: fonts.display,
    letterSpacing: -0.4,
    includeFontPadding: false,
  },
});
