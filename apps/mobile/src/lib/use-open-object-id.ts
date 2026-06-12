/**
 * Which object the main pane is showing — derived from the current route
 * (`/work/object/:id`), null on every other screen. Lets always-mounted chrome
 * (the sidebar tree's `selectedId` highlight) track the open object without
 * the route having to push state up into the shell.
 */
import { usePathname } from 'expo-router';

const DOC_ROUTE = /^\/work\/object\/([^/?#]+)/;

export function useOpenObjectId(): string | null {
  const pathname = usePathname();
  const match = DOC_ROUTE.exec(pathname ?? '');
  return match ? decodeURIComponent(match[1]) : null;
}
