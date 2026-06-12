/**
 * Re-exports the shared octospaces-sdk Starfish client helpers.
 */
export {
  makeClient,
  capProviderFor,
  openEncryptor,
  buildEncryptor,
  ownerEnsureKeyring,
  readProfile,
  readPseudo,
  readProfiles,
  writeProfile,
  writePseudo,
  ensureProfileKeys,
  buildAuthHeaders,
  ensurePseudo,
} from '@drakkar.software/octospaces-sdk';
export type { DeviceKeys, PublicProfile } from '@drakkar.software/octospaces-sdk';
