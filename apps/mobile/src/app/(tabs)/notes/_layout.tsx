import { Stack } from 'expo-router';

/** Stack for the Notes tab — personal "magic space" note list. Detail screens
 *  (page editor) live at the app root under `app/work/*`. */
export default function NotesLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
