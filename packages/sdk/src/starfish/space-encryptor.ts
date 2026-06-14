/**
 * Re-exports the shared octospaces-sdk per-node access resolver.
 *
 * The old vault space-encryptor model (one Encryptor per space) is replaced by the
 * octospaces per-node access model:
 *   - getSpaceEncryptor(spaceId, session, reg) → getNodeAccess(spaceId, nodeId, node, session, reg)
 *   - buildSpaceEncryptor(session, spaceId)    → buildNodeAccess(spaceId, nodeId, node, session)
 *   - clearSpaceEncryptors()                  → clearNodeAccessCache()
 *   - SpaceEncryptor                          → NodeAccessHandle
 *
 * The returned `NodeAccessHandle` has `{ client, encryptor | null, isOwnerOpen }`.
 * `encryptor` is null for plaintext nodes (access:'space'/'public' without enc:true).
 */
export {
  SpaceAccessError,
  getSpaceClient,
  getNodeAccess,
  buildNodeAccess,
  clearNodeAccessCache,
  openEncryptor,
  buildEncryptor,
  ownerTrustedAdders,
  ownerEnsureKeyring,
} from '@drakkar.software/octospaces-sdk';
export type { NodeAccessHandle } from '@drakkar.software/octospaces-sdk';

// ── Compat shims (Phase 3: update callers to use getNodeAccess directly) ─────

import {
  getSpaceClient,
  buildEncryptor,
  ownerTrustedAdders,
  keyringPull,
  type Session,
} from '@drakkar.software/octospaces-sdk';
import type { Encryptor, StarfishClient } from '@drakkar.software/starfish-client';

/**
 * @deprecated Use `getNodeAccess(spaceId, nodeId, node, session, reg)` instead.
 * Returns the space-wide keyring encryptor (for E2EE spaces) and the member client.
 * For plaintext spaces / nodes without enc:true, `encryptor` is null.
 */
export async function getSpaceEncryptor(
  spaceId: string,
  session: Session,
  _reg: { owner: string | null; members: string[] } | null,
): Promise<{ encryptor: Encryptor | null; client: StarfishClient }> {
  const client = getSpaceClient(spaceId, session);
  const encryptor = await buildEncryptor(
    client,
    session.keys,
    keyringPull(spaceId),
    ownerTrustedAdders(session),
  );
  return { encryptor, client };
}
