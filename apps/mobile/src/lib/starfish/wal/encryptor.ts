/**
 * `WalEncryptor` adapters.
 *
 * Under `encryption: "delegated"` (private spaces) we back WAL's seal/open with
 * the space keyring {@link Encryptor} (`{ encrypt, decrypt }` → `{ seal, open }`),
 * so each op-batch and the snapshot `state` are sealed `{ _encrypted, _epoch }`
 * exactly like every other space document. Under `encryption: "none"` (public
 * spaces) we use the package's {@link noopEncryptor}.
 */
import { noopEncryptor } from '@drakkar.software/starfish-wal';
import type { WalEncryptor } from '@drakkar.software/starfish-wal';
import type { Encryptor } from '@drakkar.software/starfish-client';

export { noopEncryptor };

/** Wrap a space keyring {@link Encryptor} as a {@link WalEncryptor}. */
export function walEncryptorFromKeyring(enc: Encryptor): WalEncryptor {
  return {
    seal: (plain) => enc.encrypt(plain),
    open: (sealed) => enc.decrypt(sealed),
  };
}
