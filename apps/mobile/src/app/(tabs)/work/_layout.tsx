import { Stack } from 'expo-router';

/** Stack for the workspace (Vault) tab — a single index screen; detail screens
 *  (page/board) live at the app root under `app/work/*`. */
export default function WorkLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
