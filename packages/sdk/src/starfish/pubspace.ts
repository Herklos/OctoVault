/**
 * @deprecated Public-space subsystem removed.
 *
 * The pubspace model (plaintext spaces at `pubspaces/{ownerId}/{spaceId}/…`) has been
 * replaced by per-node access control: `ObjectNode.access = 'public'` makes a node
 * world-readable via the `objpub` collection, without a separate namespace.
 *
 * Use instead:
 *   createNode(session, spaceId, { ..., access: 'public' })  — to publish a node
 *   createSpaceInviteLink / joinSpaceByLink                  — for space-level sharing
 *   createNodeInviteLink / joinNodeByLink                    — for node-level sharing
 *
 * Runtime stubs: functions that previously joined/created public spaces now THROW so
 * call-sites are surfaced immediately. Functions that returned read-only data return
 * safe defaults. Update call-sites to use the new per-node access API (Phase 3).
 */

/** @deprecated Throws at runtime — see module docstring. */
export function createPublicSpace(..._args: unknown[]): never {
  throw new Error('[octovault] pubspace removed: use createNode with access:"public" instead.');
}

/** @deprecated Throws at runtime — see module docstring. */
export function createPublicInvite(..._args: unknown[]): never {
  throw new Error('[octovault] pubspace removed: use createSpaceInviteLink / createNodeInviteLink instead.');
}

/** @deprecated Throws at runtime — see module docstring. */
export function joinPublicSpace(..._args: unknown[]): never {
  throw new Error('[octovault] pubspace removed: use joinSpaceByLink / joinNodeByLink instead.');
}

/** @deprecated No-op; use recoverSpaceAccess instead. */
export async function recoverPubspaceAccess(..._args: unknown[]): Promise<void> {
  // pubspace removed — recoverSpaceAccess is called separately by the bootstrap path
}

/** @deprecated Throws at runtime — see module docstring. */
export function publicSpaceClient(..._args: unknown[]): never {
  throw new Error('[octovault] pubspace removed: no public-space client needed with per-node access.');
}

/** @deprecated Returns a stub auth object — update callers to per-node access. */
export function publicSpaceAuth(..._args: unknown[]): { cap: unknown; signingKey: string; ownerId: string } {
  // Return a stub so TypeScript callers compile; at runtime the pubspace branch
  // should be removed (Phase 3) since isPublicSpaceId always returns false now.
  throw new Error('[octovault] pubspace removed: use per-node access instead.');
}

/** @deprecated Always returns false — pubspace ids no longer exist. */
export function isPublicSpaceId(_id: string): boolean { return false; }

/** @deprecated Throws at runtime — see module docstring. */
export function updatePublicSpaceMeta(..._args: unknown[]): never {
  throw new Error('[octovault] pubspace removed: use writeSpaceAccess instead.');
}

/** @deprecated Throws at runtime — see module docstring. */
export function readPublicSpaceDoc(..._args: unknown[]): never {
  throw new Error('[octovault] pubspace removed: use readSpaceAccess instead.');
}

/** @deprecated No-op — pubspace subsystem removed. */
export function publicPaths(..._args: unknown[]): { pull: string; push: string } {
  throw new Error('[octovault] pubspace removed: public nodes use objPubPull/Push instead.');
}
