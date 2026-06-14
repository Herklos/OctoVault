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

/** Returns the raw cap string for member-kind entries; null otherwise. */
export function getMemberCap(spaceId: string): string | null {
  const entry = getSpaceAccessEntry(spaceId);
  return entry?.kind === 'member' ? entry.cap : null;
}
