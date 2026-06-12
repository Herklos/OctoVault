// Platform adapters — web variant.
// Consumed as @drakkar.software/octovault-sdk/platform.

export { configureStarfishPlatform } from './platform';
export { kvGet, kvSet, kvRemove } from './kv';
export {
  loadVault, vaultMethods, unlockVault, saveVault, clearVault,
  passkeySupported, addPasskeyToVault, removePasskeyFromVault,
} from './storage';
export { passkeyEnrollable, enrollPasskey, evalPasskey } from './passkey';
export { subscribeArgon2Progress } from './hash-wasm-shim';
