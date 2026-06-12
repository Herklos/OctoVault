/**
 * Member-cap shims — thin compatibility layer over the shared octospaces-sdk
 * space-access store.
 *
 * The vault's old `hydrateMemberCaps` / `getMemberCap` / `saveMemberCap` /
 * `removeMemberCap` / `clearMemberCaps` API is now backed by the octospaces
 * `hydrateSpaceAccessStore` / `getSpaceAccessEntry` / `saveSpaceAccessEntry` /
 * `removeSpaceAccessEntry` / `clearSpaceAccessStore`.
 *
 * Re-export the canonical store API directly:
 */
import {
  hydrateSpaceAccessStore,
  getSpaceAccessEntry,
  saveSpaceAccessEntry,
  removeSpaceAccessEntry,
  getNodeAccessEntry,
  saveNodeAccessEntry,
  removeNodeAccessEntry,
  localSpaceAccessEntries,
  memberCapsFromStore,
  linkAccessFromStore,
  clearSpaceAccessStore,
} from '@drakkar.software/octospaces-sdk';
export type { SpaceAccessEntry, SpaceAccessMap } from '@drakkar.software/octospaces-sdk';
export {
  hydrateSpaceAccessStore,
  getSpaceAccessEntry,
  saveSpaceAccessEntry,
  removeSpaceAccessEntry,
  getNodeAccessEntry,
  saveNodeAccessEntry,
  removeNodeAccessEntry,
  localSpaceAccessEntries,
  memberCapsFromStore,
  linkAccessFromStore,
  clearSpaceAccessStore,
};

import type { CapMap } from '../domain/types';

/**
 * @deprecated Use `getSpaceAccessEntry(spaceId)` instead.
 * Returns the raw cap string for member-kind entries; null otherwise.
 */
export function getMemberCap(spaceId: string): string | null {
  const entry = getSpaceAccessEntry(spaceId);
  return entry?.kind === 'member' ? entry.cap : null;
}

/**
 * @deprecated Use `saveSpaceAccessEntry(spaceId, { kind: 'member', cap })` instead.
 */
export function saveMemberCap(spaceId: string, cap: string): void {
  saveSpaceAccessEntry(spaceId, { kind: 'member', cap });
}

/**
 * @deprecated Use `removeSpaceAccessEntry(spaceId)` instead.
 */
export function removeMemberCap(spaceId: string): void {
  removeSpaceAccessEntry(spaceId);
}

/**
 * @deprecated Use `clearSpaceAccessStore()` instead.
 */
export function clearMemberCaps(): void {
  clearSpaceAccessStore();
}

/**
 * @deprecated Use `hydrateSpaceAccessStore(userId, caps, {})` instead.
 * Hydrates member caps from the synced `_spaces` doc over the local kv store.
 */
export async function hydrateMemberCaps(userId: string, serverCaps: CapMap): Promise<void> {
  await hydrateSpaceAccessStore(userId, serverCaps, {});
}
