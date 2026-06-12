/**
 * PUBLIC spaces — plaintext, cap-only spaces joined via a self-sufficient,
 * space-wide invitation link.
 *
 * Unlike a private space (E2EE keyring + encrypted `inviteToSpace` join), a public
 * space lives entirely in the plaintext `pubspaces/{ownerId}/{spaceId}/…` subtree:
 * a `_rooms` registry doc + one plaintext message doc per room. Access is authorized
 * purely by a member cap the owner SIGNS — no keyring. The recipient is unknown in
 * advance, so the cap is minted against a THROWAWAY ephemeral keypair and BOTH the
 * owner-signed cap and that ephemeral private key are packed into the link's URL
 * fragment. The link itself is the credential and grants access to EVERY room in the
 * space (read-only or read/write). NOT end-to-end encrypted — the server can read it.
 */
import { generateDeviceKeys } from '@drakkar.software/starfish-identities';
import { mintMemberCap } from '@drakkar.software/starfish-sharing';
import { StarfishHttpError } from '@drakkar.software/starfish-client';
import type { StarfishClient } from '@drakkar.software/starfish-client';

import type { PubAccessMap, Space } from '../domain/types';

import { randomId } from '../domain/ids';

import { sealToSelf, unsealFromSelf } from './account-seal';
import type { SealedBlob } from './account-seal';
import { makeClient } from './client';
import type { Session } from './identity';
import { bytesToHex, pubspaceAccessPull, pubspaceAccessPush, pubspaceScope } from './paths';
import {
  getPubspaceAccess,
  localPubspaceEntries,
  mergePubspaceAccess,
  savePubspaceAccess,
} from './pubspace-caps';
import type { AccessMap, PubspaceAccess } from './pubspace-caps';
import {
  addJoinedPublicSpaceWithAccess,
  addJoinedSpace,
  updateSpacesDoc,
} from './registry';

/** Everything a joiner needs, packed into the invitation link's URL fragment. */
export interface PublicInviteToken {
  ownerId: string;
  spaceId: string;
  spaceName: string;
  /** The owner-signed member cap-cert (CapCert). */
  cap: unknown;
  /** The throwaway ephemeral subject's Ed25519 private key (hex). */
  key: string;
  /** Read/write link (true) or read-only (false). */
  write: boolean;
}

// ── base64url for the link fragment (UTF-8 safe, web + native) ────────────────
function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(bin) : Buffer.from(json, 'utf-8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(b64, 'base64').toString('utf-8');
}

/** Pack an invite into a `/join#…` link. The credential rides in the fragment
 *  (`#…`), which browsers never send to the server, put in `Referer`, or log. */
export function encodePublicInviteLink(origin: string, token: PublicInviteToken): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/join#${toBase64Url(JSON.stringify(token))}`;
}

/** Decode the token from a `#…` fragment (with or without the leading `#`). */
export function decodePublicInvite(fragment: string): PublicInviteToken {
  const frag = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  const tok = JSON.parse(fromBase64Url(frag)) as Partial<PublicInviteToken>;
  if (!tok || !tok.ownerId || !tok.spaceId || !tok.cap || !tok.key) {
    throw new Error('That public invite link is malformed or incomplete.');
  }
  return {
    ownerId: tok.ownerId,
    spaceId: tok.spaceId,
    spaceName: tok.spaceName ?? 'Public space',
    cap: tok.cap,
    key: tok.key,
    write: !!tok.write,
  };
}

/** Opaque public-space id; ownership is recorded by the `{ownerId}` storage path.
 *  CSPRNG-backed so it can't be predicted (see `@/lib/ids`). */
function newPublicSpaceId(): string {
  return `psp-${randomId()}`;
}

const monogram = (name: string) => name.trim().slice(0, 2).toUpperCase() || 'PS';

/** The cap subject's userId, mirroring the SDK derivation: SHA-256(edPub), first
 *  32 hex chars. Reproduced here so a randomly-generated throwaway keypair gets a
 *  matching, self-consistent identity without a slow Argon2 root bootstrap. */
async function ephemeralUserId(edPubHex: string): Promise<string> {
  const bytes = new Uint8Array(edPubHex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(edPubHex.slice(i * 2, i * 2 + 2), 16);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest)).slice(0, 32);
}

/** The plaintext access record for a public space, stored at `_rooms`.
 *  Owner-set name/image are the shared space identity; joiners read but
 *  cannot write (pubspace:writer is withheld on `_rooms`). */
interface PublicSpaceDoc {
  v: 1;
  /** Owner-set shared space name. */
  name?: string;
  /** Owner-set space image (data URI). */
  image?: string;
}

/** Public-space ids are prefixed so the data layer can branch synchronously without
 *  fetching the space record (the `type` field on the record stays authoritative for
 *  display). Kept in sync with `newPublicSpaceId`. */
export const isPublicSpaceId = (spaceId: string): boolean => spaceId.startsWith('psp-');

/** Auth (cap + signing key) + ownerId + write for a public space, derived from the
 *  stored invite (a joiner) or — when none is stored — this identity as the owner. */
export function publicSpaceAuth(
  session: Session,
  spaceId: string,
): { cap: unknown; signingKey: string; ownerId: string; write: boolean } {
  const access = getPubspaceAccess(spaceId);
  if (access) return { cap: access.cap, signingKey: access.key, ownerId: access.ownerId, write: access.write };
  // No stored invite ⇒ we are the owner; manage it with the account cap.
  return { cap: session.accountCap, signingKey: session.keys.edPriv, ownerId: session.userId, write: true };
}

/** Read a public space's access doc — shared name/image + its hash (for a CAS write). */
export async function readPublicSpaceDoc(
  client: StarfishClient,
  ownerId: string,
  spaceId: string,
): Promise<{ name: string | null; image: string | null; hash: string | null }> {
  // 404 → empty doc; any other error (offline) propagates so callers can distinguish.
  const res = await client.pull(pubspaceAccessPull(ownerId, spaceId)).catch((err: unknown) => {
    if (err instanceof StarfishHttpError && err.status === 404) return null;
    throw err;
  });
  const data = res?.data as Partial<PublicSpaceDoc> | undefined;
  return {
    name: typeof data?.name === 'string' ? data.name : null,
    image: typeof data?.image === 'string' ? data.image : null,
    hash: res?.hash ?? null,
  };
}

/**
 * Owner: create a new PUBLIC space. Registers the shared name in the plaintext `_rooms`
 * access doc (written with the account cap → `pubspace:owner`) and registers the space
 * in the owner's own `_spaces` list as `type:'public'`. The object index starts empty —
 * the "Write your first page" state.
 */
export async function createPublicSpace(session: Session, name: string): Promise<Space> {
  const trimmed = name.trim() || 'Public space';
  const spaceId = newPublicSpaceId();
  const doc: PublicSpaceDoc = { v: 1, name: trimmed };
  await session.accountClient.push(
    pubspaceAccessPush(session.userId, spaceId),
    doc as unknown as Record<string, unknown>,
    null,
  );
  const space: Space = {
    id: spaceId,
    name: trimmed,
    short: monogram(trimmed),
    members: 1,
    type: 'public',
    ownerId: session.userId,
    write: true,
  };
  await addJoinedSpace(session.accountClient, session.userId, space);
  return space;
}

/**
 * Owner: mint a space-wide invitation link for a public space. `write` chooses a
 * read-only or read/write link. `origin` is the app's web origin (the caller passes
 * `window.location.origin` on web).
 */
export async function createPublicInvite(
  session: Session,
  spaceId: string,
  spaceName: string,
  write: boolean,
  origin: string,
): Promise<{ token: PublicInviteToken; link: string }> {
  // A throwaway ephemeral keypair, generated RANDOMLY. We deliberately do NOT
  // bootstrap a root identity from a mnemonic here: that runs Argon2id, which —
  // under the web pure-JS shim — blocks the main thread for seconds and freezes
  // the UI. The subject userId mirrors the SDK derivation (SHA-256(edPub)) so the
  // minted cap is self-consistent.
  const ek = generateDeviceKeys();
  const userIdHex = await ephemeralUserId(ek.edPub);
  const cap = await mintMemberCap(
    session.keys.edPriv,
    session.keys.edPub,
    { edPubHex: ek.edPub, kemPubHex: ek.kemPub, userIdHex },
    'pubspace',
    pubspaceScope(session.userId, spaceId, write),
  );
  const token: PublicInviteToken = { ownerId: session.userId, spaceId, spaceName, cap, key: ek.edPriv, write };
  return { token, link: encodePublicInviteLink(origin, token) };
}

/**
 * Joiner: accept a public invite link — store its cap+key and register the space in
 * this identity's own `_spaces` list. No keyring check (there is none). Idempotent.
 */
export async function joinPublicSpace(session: Session, token: PublicInviteToken): Promise<Space> {
  const access: PubspaceAccess = { ownerId: token.ownerId, cap: token.cap, key: token.key, write: token.write };
  savePubspaceAccess(token.spaceId, access); // device-local: keeps reads synchronous here
  const name = token.spaceName.trim() || `public-${token.spaceId.slice(-6)}`;
  const space: Space = {
    id: token.spaceId,
    name,
    short: monogram(name),
    members: 1,
    type: 'public',
    ownerId: token.ownerId,
    write: token.write,
  };
  // Seal the credential to the account key and persist it in the synced `_spaces` doc
  // (atomically with the space) so the user's OTHER devices recover access WITHOUT
  // re-opening the link — the public twin of how a private member cap self-heals.
  const sealed = await sealToSelf(session, JSON.stringify(access));
  await addJoinedPublicSpaceWithAccess(session.accountClient, session.userId, space, sealed);
  return space;
}

/**
 * Sign-in orchestrator: reconcile this device's public-space access with the synced
 * `_spaces` doc (its sealed `pubAccess` map). Two halves, both best-effort:
 *
 * - RECOVER — unseal every server entry into the in-memory + kv cache, so a device
 *   that never opened the invite link gains read/write access to a public space it
 *   already sees in its list.
 * - BACKFILL — seal any device-local-only entry missing from the server doc and upload
 *   it in ONE batched write, so spaces this device joined before the credential synced
 *   propagate to the user's other devices (no re-join needed). This is what heals an
 *   account that joined public spaces on web/desktop before this feature shipped.
 *
 * Failures are logged, not thrown: access still works from whatever is cached locally.
 */
export async function recoverPubspaceAccess(session: Session, serverPubAccess: PubAccessMap): Promise<void> {
  // 1. RECOVER: unseal server entries → merge over the local cache (server wins).
  const recovered: AccessMap = {};
  for (const [spaceId, sealed] of Object.entries(serverPubAccess)) {
    try {
      recovered[spaceId] = JSON.parse(await unsealFromSelf(session, sealed)) as PubspaceAccess;
    } catch (e) {
      console.error('[OctoVault] pubspace recover: failed to unseal', spaceId, e);
    }
  }
  mergePubspaceAccess(recovered);

  // 2. BACKFILL: local-only entries the server doc doesn't have yet → seal + upload.
  const local = localPubspaceEntries();
  const missing = Object.keys(local).filter((id) => !(id in serverPubAccess));
  if (missing.length === 0) return;
  try {
    const sealedEntries: Record<string, SealedBlob> = {};
    for (const id of missing) sealedEntries[id] = await sealToSelf(session, JSON.stringify(local[id]));
    await updateSpacesDoc(session.accountClient, session.userId, (cur) => ({
      spaces: cur.spaces,
      caps: cur.caps,
      pubAccess: { ...cur.pubAccess, ...sealedEntries },
    }));
  } catch (e) {
    console.error('[OctoVault] pubspace backfill failed', e);
  }
}

/** A client authenticated for a public space (owner's account cap or joiner's link cap). */
export function publicSpaceClient(session: Session, spaceId: string): StarfishClient {
  const auth = publicSpaceAuth(session, spaceId);
  return makeClient(auth.cap, auth.signingKey);
}

/**
 * Owner: update a public space's SHARED identity (name / image) in its plaintext `_rooms`
 * access doc, written with the account cap (`pubspace:owner`). Joiners read but cannot
 * write `_rooms`. An `undefined` field is left unchanged; `null`/empty image clears it.
 */
export async function updatePublicSpaceMeta(
  session: Session,
  spaceId: string,
  meta: { name?: string | null; image?: string | null },
): Promise<void> {
  const client = session.accountClient;
  const { name: curName, image: curImage, hash } = await readPublicSpaceDoc(client, session.userId, spaceId);
  const name = (meta.name === undefined ? curName : meta.name)?.trim() || undefined;
  const image = (meta.image === undefined ? curImage : meta.image) || undefined;
  const doc: PublicSpaceDoc = {
    v: 1,
    ...(name ? { name } : {}),
    ...(image ? { image } : {}),
  };
  await client.push(pubspaceAccessPush(session.userId, spaceId), doc as unknown as Record<string, unknown>, hash);
}

