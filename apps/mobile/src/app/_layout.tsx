import 'react-native-gesture-handler';

import { configureStarfishPlatform } from '@/lib/starfish/platform';
import { registerServiceWorker } from '@/lib/pwa';
import { ProfileProvider } from '@/lib/profile-context';
import { RoomsRegistryProvider } from '@/lib/rooms-registry-context';
import { SessionProvider } from '@/lib/session-context';
import { SpaceObjectsProvider } from '@/lib/space-objects-context';
import { SpacesProvider } from '@/lib/spaces-context';

import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme';
import { useAppFonts } from '@/lib/use-app-fonts';
import { AppFrame } from '@/components/ui/AppFrame';

// Install platform crypto (no-op on web; quick-crypto install() on native).
configureStarfishPlatform();

// Register the PWA service worker (web production only; no-op elsewhere).
registerServiceWorker();

// Keep the native splash up until our fonts are ready (must run at module top).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = colors[scheme];

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Block first paint until fonts resolve so we never flash a fallback face.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          {/* Provider tree for OctoVault: the session, the user's spaces, the per-space
              access registry (read by the workspace open flow), and the profile. */}
          <SessionProvider>
            <SpacesProvider>
              <RoomsRegistryProvider>
                <ProfileProvider>
                  <SpaceObjectsProvider>
                    <AppFrame>
                      <Stack
                        screenOptions={{
                          headerShown: false,
                          contentStyle: { backgroundColor: palette.canvas },
                        }}
                      />
                    </AppFrame>
                  </SpaceObjectsProvider>
                </ProfileProvider>
              </RoomsRegistryProvider>
            </SpacesProvider>
          </SessionProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
