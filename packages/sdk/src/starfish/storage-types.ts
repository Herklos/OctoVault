/**
 * Re-exports the shared octospaces-sdk persisted-session storage types.
 * The shapes (DerivedIdentity, PersistedSession, Vault, VaultLoad, …) are
 * semantically identical to what the vault had; only import paths changed.
 */
export type {
  DerivedIdentity,
  PersistedSession,
  Vault,
  UnlockMethod,
  PasskeyEnrollment,
  SeedLock,
  VaultLoad,
} from '@drakkar.software/octospaces-sdk';
