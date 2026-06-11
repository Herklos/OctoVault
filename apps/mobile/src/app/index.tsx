import { Redirect, type Href } from 'expo-router';

import { useNavPrefs } from '@/lib/use-nav-prefs';
import { useSession } from '@/lib/session-context';

/** Entry: go to the app if an identity is restored, the unlock screen if a sealed
 *  one is waiting (web), else onboarding. Signed-in launches resume at the LAST
 *  open document (recorded by AppFrame's route tracker) — the Notion behavior of
 *  reopening exactly where you were — falling back to the Vault home. */
export default function Index() {
  const { session, status } = useSession();
  const { hydrated, lastRoute } = useNavPrefs();
  if (status === 'loading' || status === 'switching') return null;
  if (status === 'locked') return <Redirect href="/(onboarding)/unlock" />;
  if (!session) return <Redirect href="/(onboarding)/welcome" />;
  // Hold one frame for the device-local pref read (SpacesProvider kicks it off
  // with the session) so we don't flash the Vault home before resuming.
  if (!hydrated) return null;
  // The stored href is a concrete runtime path ('/work/page/abc?spaceId=…'),
  // which typed-routes can't verify statically — it was recorded from a real
  // visit, and a stale id degrades to the editor's missing-node fallback.
  if (lastRoute) return <Redirect href={lastRoute as Href} />;
  return <Redirect href="/(tabs)/work" />;
}
