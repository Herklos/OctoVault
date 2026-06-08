import { useFonts } from 'expo-font';
import {
  Newsreader_600SemiBold,
  Newsreader_700Bold,
} from '@expo-google-fonts/newsreader';
import {
  SplineSans_400Regular,
  SplineSans_500Medium,
  SplineSans_600SemiBold,
  SplineSans_700Bold,
} from '@expo-google-fonts/spline-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';

/**
 * Loads every font family referenced by `fonts` in `src/theme.ts`.
 * Keys here MUST stay in sync with that file. Returns `[loaded, error]`.
 *
 * Identity "Ink & Pearl": Newsreader (editorial serif — display/headings),
 * Spline Sans (quiet grotesk — body), JetBrains Mono (labels/keys/fingerprints).
 */
export function useAppFonts(): [boolean, Error | null] {
  return useFonts({
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    SplineSans_400Regular,
    SplineSans_500Medium,
    SplineSans_600SemiBold,
    SplineSans_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
}
