/**
 * Re-exports the shared octospaces-sdk space + spaces-doc registry.
 *
 * `leaveSpace` and `CategoryError` are vault-specific and live in registry-ext.ts.
 * `addJoinedPublicSpaceWithAccess` is renamed `addJoinedSpaceWithLinkAccess` in
 * octospaces; vault code should be updated to use the new name.
 */
export {
  readSpaces,
  updateSpacesDoc,
  updateMutesDoc,
  updateReadsDoc,
  updateDmsDoc,
  updateQuickReactionsDoc,
  updateArchivedDmsDoc,
  setDmMapping,
  writeSpaces,
  reorderSpaces,
  readSpaceAccess,
  writeSpaceAccess,
  addSpaceMember,
  removeSpaceMember,
  addJoinedSpace,
  addJoinedSpaceWithCap,
  addJoinedSpaceWithLinkAccess,
  createSpace,
  reconcileSpaceMeta,
  onSpaceMeta,
  broadcastSpaceMeta,
} from '@drakkar.software/octospaces-sdk';
export type { SpaceMeta, SpaceMetaUpdate } from '@drakkar.software/octospaces-sdk';
