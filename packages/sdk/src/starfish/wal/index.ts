/**
 * WAL/CRDT document layer for OctoVault — the live wiring of
 * `@drakkar.software/starfish-wal`'s injected interfaces onto the OctoVault
 * Starfish stack (client + space keyring encryptor + device signer).
 *
 * A logical document (a page's blocks, a board's columns/tasks) is one
 * {@link WalDocument}: an append-only op-log at `documentKey` plus an optional
 * sibling `<documentKey>__snapshot`. Pages/boards build their domain shape on top
 * via `page-model.ts` / `board-model.ts`; the `use-wal-doc` hook owns the
 * open→pull→commit lifecycle for a screen.
 */
import { WalDocument } from '@drakkar.software/starfish-wal';
import type { ReaderPosture, WalEncryptor, WalSnapshotStore } from '@drakkar.software/starfish-wal';
import type { Encryptor, StarfishClient } from '@drakkar.software/starfish-client';

import { createWalTransport } from './transport';
import { createWalSnapshotStore } from './snapshot-store';
import { noopEncryptor, walEncryptorFromKeyring } from './encryptor';
import { walSignerFromKeys } from './signer';

export interface CreateWalDocumentOptions {
  client: StarfishClient;
  /** Bare storage key, e.g. `spaces/{spaceId}/objects/pages/{objectId}`. */
  documentKey: string;
  /** This device's Ed25519 keypair (same key the client cap signs with). */
  edPubHex: string;
  edPrivHex: string;
  /** Space keyring encryptor for a private space; omit/null for a public (plaintext) space. */
  encryptor?: Encryptor | null;
  /** Per-session replica disambiguator (default the WalDocument's "0"). */
  sessionNonce?: string;
  /** Configure the sibling snapshot doc (cold-start + compaction). Default true. */
  withSnapshots?: boolean;
  posture?: ReaderPosture;
}

/** Build a {@link WalDocument} fully wired to the live Starfish client. */
export function createWalDocument(opts: CreateWalDocumentOptions): WalDocument {
  const encryptor: WalEncryptor = opts.encryptor
    ? walEncryptorFromKeyring(opts.encryptor)
    : noopEncryptor;
  const snapshotStore: WalSnapshotStore | undefined =
    opts.withSnapshots === false ? undefined : createWalSnapshotStore(opts.client);
  return new WalDocument({
    documentKey: opts.documentKey,
    transport: createWalTransport(opts.client),
    signer: walSignerFromKeys(opts.edPubHex, opts.edPrivHex),
    encryptor,
    snapshotStore,
    sessionNonce: opts.sessionNonce,
    posture: opts.posture ?? 'trust-retain-tail',
  });
}

export {
  WalDocument,
  createWalTransport,
  createWalSnapshotStore,
  walEncryptorFromKeyring,
  walSignerFromKeys,
  noopEncryptor,
};
