/**
 * Discover tab — browse the global public-object directory.
 *
 * Pulls the world-readable `_index/objects/public` projection (no auth) and
 * renders it via the shared `<DiscoverScreen>` from `@drakkar.software/octospaces-ui`.
 * Tapping a row navigates to the existing object viewer (`/work/object/[id]`),
 * which already handles `access:'public'` nodes via `objPubPull`.
 *
 * The root `_layout.tsx` already mounts `<OctoSpacesThemeProvider>` at the app
 * root, so all `octospaces-ui` components resolve `useOctoSpacesTheme()` here.
 *
 * App-specific behaviour injected as props:
 *   - `renderIcon`  — type-registry icon so discovered objects match the work tree.
 *   - `onOpen`      — pushes the canonical object route, passing `spaceId` so the
 *                     viewer sets the right active space.
 */
/**
 * Discover tab — browse the global public-object directory.
 *
 * Pulls the world-readable `_index/objects/public` projection (no auth) and
 * renders it via the shared `<DiscoverScreen>` from `@drakkar.software/octospaces-ui`.
 * Tapping a row navigates to the existing object viewer (`/work/object/[id]`),
 * which already handles `access:'public'` nodes via `objPubPull`.
 *
 * The root `_layout.tsx` already mounts `<OctoSpacesThemeProvider>` at the app
 * root, so all `octospaces-ui` components resolve `useOctoSpacesTheme()` here.
 *
 * App-specific behaviour injected as props:
 *   - `renderIcon`  — type-registry icon so discovered objects match the work tree.
 *   - `onOpen`      — pushes the canonical object route, passing `spaceId` so the
 *                     viewer sets the right active space.
 *   - `reloadRef`   — lets `useFocusEffect` trigger a soft-refresh when returning to
 *                     the tab, keeping the list current without a full remount.
 */
import React, { useCallback, useRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { DiscoverScreen } from '@drakkar.software/octospaces-ui';
import type { DiscoverEntry } from '@drakkar.software/octospaces-ui';

import { readObjectDirectory, routeForNode } from '@drakkar.software/octovault-sdk';
import { Icon } from '@/components/ui/Icon';
import { useTypeRegistry } from '@/lib/type-registry-context';

export default function DiscoverTab() {
  const registry = useTypeRegistry();
  const reloadRef = useRef<(() => void) | null>(null);

  // Soft-refresh whenever the tab comes into focus (pull-to-refresh handles manual).
  useFocusEffect(
    useCallback(() => {
      reloadRef.current?.();
    }, []),
  );

  const renderIcon = useCallback(
    (entry: DiscoverEntry) => (
      <Icon name={registry.iconForNode({ type: entry.type })} size={16} />
    ),
    [registry],
  );

  const onOpen = useCallback((entry: DiscoverEntry) => {
    router.push({
      pathname: routeForNode({ type: entry.type }),
      params: {
        id: entry.id,
        spaceId: entry.spaceId,
        label: entry.title,
        ...(entry.emoji ? { emoji: entry.emoji } : {}),
      },
    });
  }, []);

  return (
    <DiscoverScreen
      loadEntries={readObjectDirectory}
      renderIcon={renderIcon}
      onOpen={onOpen}
      title="Discover"
      emptyMessage="No public objects yet"
      reloadRef={reloadRef}
    />
  );
}
