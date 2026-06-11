/**
 * Which document the main pane is showing — derived from the current route
 * (`/work/page/:id` or `/work/board/:id`), null on every other screen. Lets
 * always-mounted chrome (the sidebar tree's `selectedId` highlight) track the
 * open page/board without the routes having to push state up into the shell.
 */
import { usePathname } from 'expo-router';

const DOC_ROUTE = /^\/work\/(?:page|board)\/([^/?#]+)/;

export function useOpenObjectId(): string | null {
  const pathname = usePathname();
  const match = DOC_ROUTE.exec(pathname ?? '');
  return match ? decodeURIComponent(match[1]) : null;
}
