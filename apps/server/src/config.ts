import type { SyncConfig } from "@drakkar.software/starfish-server";

/**
 * Starfish collection layout for OctoVault — a Notion/Anytype-style knowledge app
 * (NOT a chat app). ALL content lives in a GENERIC per-object family:
 *
 *   objlog / objsnap  — WAL/CRDT append-only op-log (append) + sibling LWW snapshot
 *                        for every Object with contentKind "append" (pages, boards,
 *                        tasks, …). Folded client-side by @drakkar.software/starfish-wal.
 *   objdoc            — LWW merge-doc for Objects with contentKind "merge" (record-form
 *                        custom types, file captions, …).
 *   objblob           — raw sealed binary blobs for file/image Objects.
 *   objindex          — union-merged tree index (all Objects in a space).
 *   typeindex         — union-merged per-space custom-type registry.
 *
 * Encryption is "delegated" (multi-recipient keyring) for content; the keyring,
 * access record, profiles and per-identity registries are plaintext ("none").
 *
 *   {identity}   - resolver enforces it equals the cap-bound user id
 *   {objectId} / {blobId} / {spaceId} / {rendezvousId} - free path params
 *
 * Keep in sync with apps/mobile/src/lib/starfish/paths.ts (spaceMemberScope.collections)
 * AND Infra/sync/server/drakkar_sync/apps/octovault/collections.py — they are mirrors.
 */
const JSON_ONLY = ["application/json"];

export const config: SyncConfig = {
  version: 1,
  collections: [
    // SPACE-wide multi-recipient keyring: one keyring (CEK) per space, shared by all
    // its documents. READ gated on `space:member`, WRITE on `space:owner` (owner adds
    // recipients on invite / rotates on revoke) — both synthesized by the space-role
    // enricher from the access record below. Backs the WAL `delegated` sealing.
    {
      name: "keyring",
      storagePath: "spaces/{spaceId}/_keyring",
      readRoles: ["space:member"],
      writeRoles: ["space:owner"],
      encryption: "none",
      maxBodyBytes: 65_536,
      allowedMimeTypes: JSON_ONLY,
    },
    // SPACE access record `{ owner, members:[…] }`. READ gated on `space:member`,
    // WRITE on `space:owner`. The space-role enricher reads THIS doc to synthesize
    // space:member / space:owner for every other collection, so its storage leaf stays
    // the legacy `_rooms` path the shared enricher looks up (the collection name is
    // OctoVault's own).
    {
      name: "spaceregistry",
      storagePath: "spaces/{spaceId}/_rooms",
      readRoles: ["space:member"],
      writeRoles: ["space:owner"],
      encryption: "none",
      maxBodyBytes: 131_072,
      allowedMimeTypes: JSON_ONLY,
    },
    // OBJECT TREE (private/E2EE): the union-merged list of every Object in a space —
    // folders, pages, boards. Titles/emoji are sealed. WRITE is `space:member` (any
    // member creates pages/boards); the access record stays owner-only so this can't
    // escalate membership.
    {
      name: "objindex",
      storagePath: "spaces/{spaceId}/objects/_index",
      readRoles: ["space:member"],
      writeRoles: ["space:member"],
      encryption: "delegated",
      maxBodyBytes: 262_144,
      allowedMimeTypes: JSON_ONLY,
    },
    // GENERIC WAL op-log (private/E2EE): one append-only `by_timestamp` log per Object
    // with contentKind "append" (pages, tasks, boards-view, …). Each element is a sealed
    // CRDT op-batch folded client-side by starfish-wal. `requireAuthorSignature` so every
    // op is Ed25519 author-verified before fold. NO `ttlMs` (a TTL would expire a quiet
    // object's whole log). `objects/logs/` subtree (sibling of `_index` leaf + `docs/` +
    // `blobs/`) keeps the file-vs-directory rule. Keep in sync with objLogName in
    // apps/mobile/src/lib/starfish/paths.ts AND Infra collections.py.
    {
      name: "objlog",
      storagePath: "spaces/{spaceId}/objects/logs/{objectId}",
      readRoles: ["space:member"],
      writeRoles: ["space:member"],
      encryption: "delegated",
      appendOnly: { type: "by_timestamp", requireAuthorSignature: true },
      maxBodyBytes: 262_144,
      allowedMimeTypes: JSON_ONLY,
    },
    // GENERIC WAL snapshot (private/E2EE): sibling LWW `<objlog>__snapshot`. Materialized
    // `state` is sealed by the WAL encryptor INSIDE the doc, so the collection itself is
    // `none` (plaintext uptoTs/writerSeq/producedBy + a signature). NOT queued — readers
    // resume from the log.
    {
      name: "objsnap",
      storagePath: "spaces/{spaceId}/objects/logs/{objectId}__snapshot",
      readRoles: ["space:member"],
      writeRoles: ["space:member"],
      encryption: "none",
      maxBodyBytes: 1_048_576,
      allowedMimeTypes: JSON_ONLY,
    },
    // GENERIC merge-doc (private/E2EE): LWW last-writer-wins doc per Object with
    // contentKind "merge" (record-form custom-type objects, file/image caption metadata,
    // …). No appendOnly — the whole doc is replaced on each write and merged by the
    // union-merge engine client-side.
    {
      name: "objdoc",
      storagePath: "spaces/{spaceId}/objects/docs/{objectId}",
      readRoles: ["space:member"],
      writeRoles: ["space:member"],
      encryption: "delegated",
      maxBodyBytes: 262_144,
      allowedMimeTypes: JSON_ONLY,
    },
    // GENERIC raw blob (sealed client-side): binary file/image bytes sealed with the space
    // keyring CEK before upload; the server stores opaque ciphertext. `none` encryption at
    // the collection level because the blob is already client-sealed (AAD = objectBlobName
    // path). Large maxBodyBytes to match the roleResolver ceiling in index.ts.
    {
      name: "objblob",
      storagePath: "spaces/{spaceId}/objects/blobs/{blobId}",
      readRoles: ["space:member"],
      writeRoles: ["space:member"],
      encryption: "none",
      maxBodyBytes: 11_534_336,
      allowedMimeTypes: ["application/octet-stream"],
    },
    // PER-SPACE CUSTOM TYPE REGISTRY (private/E2EE): union-merged list of user-defined
    // TypeDefs — icon, label, fields, editorKind. Merged with built-in type descriptors
    // client-side. Same access model as objindex. `types/` subtree (sibling of `objects/`)
    // keeps the file-vs-directory rule. Keep in sync with typesIndexName in paths.ts AND
    // Infra collections.py.
    {
      name: "typeindex",
      storagePath: "spaces/{spaceId}/types/_index",
      readRoles: ["space:member"],
      writeRoles: ["space:member"],
      encryption: "delegated",
      maxBodyBytes: 262_144,
      allowedMimeTypes: JSON_ONLY,
    },
    // Public-readable profile; only the self-signed root device may write.
    {
      name: "profile",
      storagePath: "user/{identity}/profile",
      readRoles: ["public"],
      writeRoles: ["device:root"],
      encryption: "none",
      maxBodyBytes: 65_536,
      allowedMimeTypes: JSON_ONLY,
    },
    // Per-identity device directory.
    {
      name: "devices",
      storagePath: "users/{identity}/_devices",
      readRoles: ["cap:read:devices"],
      writeRoles: ["cap:write:devices"],
      encryption: "none",
      maxBodyBytes: 131_072,
      allowedMimeTypes: JSON_ONLY,
    },
    // Per-identity space registry.
    {
      name: "spaces",
      storagePath: "user/{identity}/_spaces",
      readRoles: ["cap:read:spaces"],
      writeRoles: ["cap:write:spaces"],
      encryption: "none",
      maxBodyBytes: 131_072,
      allowedMimeTypes: JSON_ONLY,
    },
    // Anonymous rendezvous slot for QR device pairing.
    {
      name: "pairing",
      storagePath: "_pairing/{rendezvousId}",
      readRoles: ["public"],
      writeRoles: ["public"],
      encryption: "none",
      maxBodyBytes: 16_384,
      allowedMimeTypes: JSON_ONLY,
    },
  ],
};
