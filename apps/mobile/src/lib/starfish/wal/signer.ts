/**
 * `WalSigner` from this device's Ed25519 keypair.
 *
 * {@link createEd25519Signer} reuses the protocol's `signAppendAuthor` /
 * `signDocAuthor`, so the proof is byte-identical to what the server (and a
 * reader's `verifyAppendAuthor`) checks. The key must be the same device key the
 * StarfishClient cap signs requests with, so the client's auto-signed append and
 * the WAL author proof agree.
 */
import { createEd25519Signer } from '@drakkar.software/starfish-wal';
import type { WalSigner } from '@drakkar.software/starfish-wal';

export function walSignerFromKeys(edPubHex: string, edPrivHex: string): WalSigner {
  return createEd25519Signer(edPubHex, edPrivHex);
}
