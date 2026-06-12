// Platform adapters — native variant (React Native / Expo).
// Consumed as @drakkar.software/octovault-sdk/platform on native.

export { configureStarfishPlatform } from './platform.native';
export { kvGet, kvSet, kvRemove } from './kv.native';
export {
  loadVault, vaultMethods, unlockVault, saveVault, clearVault,
  passkeySupported, addPasskeyToVault, removePasskeyFromVault,
} from './storage.native';
export { passkeyEnrollable, enrollPasskey, evalPasskey } from './passkey.native';
export { subscribeArgon2Progress } from './hash-wasm-shim';
