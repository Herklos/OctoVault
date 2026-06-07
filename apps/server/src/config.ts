import type { SyncConfig } from "@drakkar.software/starfish-server";

/**
 * Starfish collection layout for OctoVault — a Notion/Anytype-style knowledge app
 * (NOT a chat app). Content lives in WAL/CRDT op-log collections
 * (`pagelog`/`boardlog`, each with a sibling `*snap` LWW snapshot), folded
 * client-side by `@drakkar.software/starfish-wal`; the object TREE is a
 * union-merged index (`objindex`). Encryption is "delegated" (opaque ciphertext,
 * multi-recipient keyring) for content; the keyring, the space access record,
 * profiles and the per-identity registries are plaintext ("none") metadata, gated
 * by caps + the space-role enricher.
 *
 *   {identity}  - resolver enforces it equals the cap-bound user id
 *   {objectId} / {spaceId} / {rendezvousId} - free path params
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
    // PAGE op-log (private/E2EE): WAL/CRDT — one append-only `by_timestamp` op-log per
    // `page` Object; each appended element is a sealed CRDT op-batch folded client-side.
    // `requireAuthorSignature` so every op is Ed25519 author-verified before fold. NO
    // `ttlMs` (a TTL would expire a quiet page's whole log on read). Distinct
    // `objects/pages/` subtree (sibling of the `_index` leaf) keeps the file-vs-directory
    // rule. Keep in sync with pageLogName in apps/mobile + Infra collections.py.
    {
      name: "pagelog",
      storagePath: "spaces/{spaceId}/objects/pages/{objectId}",
      readRoles: ["space:member"],
      writeRoles: ["space:member"],
      encryption: "delegated",
      appendOnly: { type: "by_timestamp", requireAuthorSignature: true },
      maxBodyBytes: 262_144,
      allowedMimeTypes: JSON_ONLY,
    },
    // PAGE snapshot (private/E2EE): sibling LWW doc `<pagelog>__snapshot` a trusted-role
    // client writes for fast cold-start + log compaction. The sensitive materialized
    // `state` is sealed by the WAL encryptor INSIDE the doc, so the collection itself is
    // `none` (the doc also carries plaintext uptoTs/writerSeq/producedBy + a signature).
    {
      name: "pagesnap",
      storagePath: "spaces/{spaceId}/objects/pages/{objectId}__snapshot",
      readRoles: ["space:member"],
      writeRoles: ["space:member"],
      encryption: "none",
      maxBodyBytes: 1_048_576,
      allowedMimeTypes: JSON_ONLY,
    },
    // BOARD op-log + snapshot (private/E2EE): WAL/CRDT kanban — same model as `pagelog`.
    {
      name: "boardlog",
      storagePath: "spaces/{spaceId}/objects/boards/{objectId}",
      readRoles: ["space:member"],
      writeRoles: ["space:member"],
      encryption: "delegated",
      appendOnly: { type: "by_timestamp", requireAuthorSignature: true },
      maxBodyBytes: 262_144,
      allowedMimeTypes: JSON_ONLY,
    },
    {
      name: "boardsnap",
      storagePath: "spaces/{spaceId}/objects/boards/{objectId}__snapshot",
      readRoles: ["space:member"],
      writeRoles: ["space:member"],
      encryption: "none",
      maxBodyBytes: 1_048_576,
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
