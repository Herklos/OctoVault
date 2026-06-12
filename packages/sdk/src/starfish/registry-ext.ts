/**
 * OctoVault-specific space-registry extensions.
 *
 * `leaveSpace` and `CategoryError` are vault-specific (not in octospaces-sdk).
 */
import { updateSpacesDoc } from '@drakkar.software/octospaces-sdk';
import type { StarfishClient } from '@drakkar.software/starfish-client';
import { removeSpaceAccessEntry } from '@drakkar.software/octospaces-sdk';

/**
 * Member-side: leave a space — drop it from this identity's own `_spaces` doc (the
 * `spaces` list AND its `caps`/`pubAccess` entry) through the conflict-retrying
 * `updateSpacesDoc` funnel, then forget its member cap from the local store.
 *
 * This is a LOCAL leave (the user stops syncing/seeing the space) — it does NOT
 * remove the user from the owner's roster or rotate the keyring; that is the owner's
 * `removeSpaceMember`, and a true keyring revoke is out of scope.
 */
export async function leaveSpace(
  client: StarfishClient,
  userId: string,
  spaceId: string,
): Promise<void> {
  await updateSpacesDoc(client, userId, (cur) => {
    if (!cur.spaces.some((s) => s.id === spaceId)) return cur; // not joined — skip
    const caps = { ...cur.caps };
    delete caps[spaceId];
    const pubAccess = { ...cur.pubAccess };
    delete pubAccess[spaceId];
    return { spaces: cur.spaces.filter((s) => s.id !== spaceId), caps, pubAccess };
  });
  removeSpaceAccessEntry(spaceId);
}

/** A user-facing category/space validation failure (empty/duplicate name).
 *  The hook layer surfaces `message` verbatim, unlike an opaque network/HTTP error. */
export class CategoryError extends Error {}
