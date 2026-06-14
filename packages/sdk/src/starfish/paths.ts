/**
 * Collection path + cap-scope helpers for OctoVault.
 *
 * Re-exports the shared OctoSpaces path/scope surface. OctoVault uses the same
 * generic `obj*` collection family and the same cap-scope model; no vault-specific
 * path helpers are needed beyond what octospaces-sdk provides.
 *
 * Removed (pubspace subsystem dropped in favour of per-node access:'public'):
 *   pubObjIndex*, pubspaceAccess*, pubspaceRoom*, pubstreamRoom*, spaceIndex*
 *   pubspaceScope, pubstreamBotScope, spaceIdFromCap
 */
export {
  // ── Object collections constant (for cap scopes) ──────────────────────────
  OBJECT_COLLECTIONS,

  // ── Cap scopes ─────────────────────────────────────────────────────────────
  ownerScope,
  spaceMemberScope,
  nodeMemberScope,
  accountScope,
  linkedDeviceScope,

  // ── Space-wide keyring (one per space, encrypts all enc nodes) ────────────
  keyringName,
  keyringPull,
  keyringPush,

  // ── Attachments ────────────────────────────────────────────────────────────
  attachmentPull,
  attachmentPush,

  // ── Profile + registries ───────────────────────────────────────────────────
  profilePull,
  profilePush,
  spacesPull,
  spacesPush,
  // spaceAccessPull/Push now return `_access` (not `_rooms`)
  spaceAccessPull,
  spaceAccessPush,

  // ── Object index (plaintext, member-gated) ─────────────────────────────────
  objIndexPull,
  objIndexPush,

  // ── Space-tier & general object content ────────────────────────────────────
  objLogPull,
  objLogPush,
  objDocPull,
  objDocPush,
  objectBlobPull,
  objectBlobPush,

  // ── Public node content (access:'public', world-readable) ──────────────────
  objPubName,
  objPubPull,
  objPubPush,

  // ── Invite-only plaintext content (access:'invite'+enc:false, cap-gated) ───
  objInvName,
  objInvPull,
  objInvPush,

  // ── Per-space custom type registry ─────────────────────────────────────────
  typesIndexPull,
  typesIndexPush,

  // ── Global object directory (server-maintained projection) ─────────────────
  objectDirName,
  objectDirPull,
  readObjectDirectory,
  parseObjectDirectoryDoc,

  // ── Utilities ──────────────────────────────────────────────────────────────
  userIdFromEdPub,
  bytesToHex,
} from '@drakkar.software/octospaces-sdk';
export type { PublicObjectDirEntry } from '@drakkar.software/octospaces-sdk';

// ── Local path-name helpers (not yet in octospaces-sdk public API) ──────────
// Derived from the same naming convention used internally by octospaces-sdk.

/**
 * spaceId prefix from a `{spaceId}-{objectId}`-style room ID.
 *
 * Assumes spaceId contains exactly one hyphen segment (e.g. `"sp-abc123"`).
 * Incorrect for multi-segment spaceIds — verify the format before changing
 * the slice count.
 */
export function spaceIdFromRoomId(roomId: string): string {
  return roomId.split('-').slice(0, 2).join('-');
}

/** Starfish name for an attachment blob (`spaces/{spaceId}/attachments/{roomId}/{blobId}`). */
export function attachmentName(roomId: string, blobId: string): string {
  return `spaces/${spaceIdFromRoomId(roomId)}/attachments/${roomId}/${blobId}`;
}

/** Starfish name for the object index doc (`spaces/{spaceId}/objects/_index`). */
export function objIndexName(spaceId: string): string {
  return `spaces/${spaceId}/objects/_index`;
}

/** Starfish name for an object WAL log (`spaces/{spaceId}/objects/logs/{objectId}`). */
export function objLogName(spaceId: string, objectId: string): string {
  return `spaces/${spaceId}/objects/logs/${objectId}`;
}

/** Starfish name for an object merge doc (`spaces/{spaceId}/objects/docs/{objectId}`). */
export function objDocName(spaceId: string, objectId: string): string {
  return `spaces/${spaceId}/objects/docs/${objectId}`;
}

/** Starfish name for an object blob (`spaces/{spaceId}/objects/blobs/{blobId}`). */
export function objectBlobName(spaceId: string, blobId: string): string {
  return `spaces/${spaceId}/objects/blobs/${blobId}`;
}

/** Starfish name for the custom types index (`spaces/{spaceId}/types/_index`). */
export function typesIndexName(spaceId: string): string {
  return `spaces/${spaceId}/types/_index`;
}
