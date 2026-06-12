/**
 * `WalTransport` over the live {@link StarfishClient}.
 *
 * The WAL document layer (`@drakkar.software/starfish-wal`) ships only the
 * transport *interface* — the live adapter is the consumer's job (see
 * `Starfish/docs/ts/wal/03-document.md`). This is that adapter:
 *
 *  - `append` → `StarfishClient.append(/push/<key>, data)`. The client auto-signs
 *    the element with the cap's device key (the SAME Ed25519 key the WAL
 *    {@link createEd25519Signer} uses), so the stored element's author proof is
 *    the one a reader verifies. WAL also hands us `authorPubkey`/`authorSignature`
 *    in `body`; they are redundant here (the client re-signs identically) so we
 *    only forward `body.data`.
 *  - `pull` → an {@link AppendLogCursor} seeded at `checkpoint`, returning the raw
 *    elements (ciphertext `data` + `ts` + author fields). We do NOT decrypt or
 *    verify here — `WalDocument` does both itself.
 *
 * `documentKey` is the bare storage key (e.g. `spaces/{spaceId}/objects/pages/{id}`);
 * the client's `namespace` (empty in local dev) is prepended internally, so the
 * key the client author-signs over matches the `documentKey` WAL verifies over.
 */
import { AppendLogCursor, StarfishHttpError } from '@drakkar.software/starfish-client';
import type { StarfishClient } from '@drakkar.software/starfish-client';
import type { WalAppendElement, WalTransport } from '@drakkar.software/starfish-wal';

export function createWalTransport(client: StarfishClient): WalTransport {
  return {
    async append(documentKey, body) {
      const res = await client.append(`/push/${documentKey}`, body.data);
      return { ts: res.timestamp };
    },
    async pull(documentKey, checkpoint) {
      // A fresh stateless cursor per call: `since` makes the server return only
      // elements with `ts > checkpoint`, ascending — exactly the WAL contract.
      const cursor = new AppendLogCursor({
        client,
        pullPath: `/pull/${documentKey}`,
        since: checkpoint,
      });
      // A never-written object has no log doc yet — 404 is not an error, just an
      // empty starting state. Rethrow everything else (403, decrypt errors, etc.)
      // so the caller can surface them via openError.
      const els = await cursor.pull().catch((e: unknown) => {
        if (e instanceof StarfishHttpError && e.status === 404) return [];
        throw e;
      });
      return els.map<WalAppendElement>((e) => ({
        ts: e.ts,
        data: e.data,
        authorPubkey: e.authorPubkey ?? '',
        authorSignature: e.authorSignature ?? '',
      }));
    },
  };
}
