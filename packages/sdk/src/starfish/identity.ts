/**
 * Re-exports the shared octospaces-sdk identity / session implementation.
 *
 * Note: the octospaces Session type adds `spacesRegistryClient` and
 * `spacesKeyringClient` (both fall back to the default clients when no
 * `sharedSpacesNamespace` is configured — OctoVault is single-namespace).
 */
export {
  buildSession,
  buildLinkedSession,
  deriveSession,
  rootIdentityOf,
  ownerTrustedAdders,
  generateSeedWords,
  isValidSeed,
  fingerprintFromUserId,
} from '@drakkar.software/octospaces-sdk';
export type { Session, LinkedIdentity } from '@drakkar.software/octospaces-sdk';
