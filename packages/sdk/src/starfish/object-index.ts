/**
 * Headless (no-React) create-time seeding of a space's unified OBJECT INDEX —
 * the encrypted `objects/_index` doc. The reactive equivalent is {@link useObjects};
 * this module is what the non-React consumers use: the one-shot seed
 * `createSpace`/`createDmSpace` write at space creation.
 */
import type { Encryptor, StarfishClient } from '@drakkar.software/starfish-client';

import type { ObjectNode } from '../domain/types';

import type { Session } from './identity';
import { objIndexPull, objIndexPush } from './paths';
import { getSpaceEncryptor } from './space-encryptor';

/**
 * Write the create-time seed into a space's index doc with an already-open encryptor —
 * the DM path holds one from `ownerEnsureKeyring`, so it avoids re-opening. Idempotent:
 * a no-op if the index doc already exists (so a re-run never clobbers a populated index).
 * Pass `nodes` to seed specific nodes, or an empty array for the default empty state.
 */
export async function pushIndexSeed(
  client: StarfishClient,
  encryptor: Encryptor,
  spaceId: string,
  nodes: ObjectNode[] = [],
): Promise<void> {
  const res = await client.pull(objIndexPull(spaceId)).catch(() => null);
  if (res?.data && (res.data as Record<string, unknown>)._encrypted) return; // already seeded
  // Shape matches `useObjects` (reads `doc.objects`); the union-merge keys on each
  // node's own id/updatedAt, so no doc-level stamp is needed.
  const sealed = await encryptor.encrypt({ objects: nodes });
  await client.push(objIndexPush(spaceId), sealed as Record<string, unknown>, res?.hash ?? null);
}

/**
 * Seed a brand-new PRIVATE space's index as the OWNER: open (minting, if needed) the
 * space keyring and push the encrypted empty seed. Called from `createSpace` right after
 * `_rooms` claims ownership (so `space:owner` is satisfied for the keyring + index write).
 * New spaces start with an empty index — the "Write your first page" empty state.
 */
export async function seedSpaceObjectIndex(session: Session, spaceId: string): Promise<void> {
  const { encryptor, client } = await getSpaceEncryptor(spaceId, session, { owner: session.userId, members: [] });
  await pushIndexSeed(client, encryptor, spaceId, []);
}
