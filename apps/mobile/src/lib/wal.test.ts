import { beforeAll, describe, expect, it } from 'vitest';
import { configurePlatform } from '@drakkar.software/starfish-protocol';
import { ed25519 } from '@noble/curves/ed25519.js';
import {
  WalDocument,
  createEd25519Signer,
  noopEncryptor,
  type WalAppendElement,
  type WalEncryptor,
  type WalSnapshotDoc,
  type WalSnapshotStore,
  type WalTransport,
} from '@drakkar.software/starfish-wal';

import * as page from './page-content';
import * as board from './board-content';

// Node's vitest has no btoa/atob — wire base64 so the protocol's author signer works.
beforeAll(() => {
  if (typeof globalThis.btoa !== 'function') {
    configurePlatform({
      base64: {
        encode: (data) => Buffer.from(data).toString('base64'),
        decode: (str) => new Uint8Array(Buffer.from(str, 'base64')),
      },
    });
  }
});

function hex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function signer() {
  const priv = ed25519.utils.randomSecretKey();
  return createEd25519Signer(hex(ed25519.getPublicKey(priv)), hex(priv));
}

/** In-memory append-only collection shared by several WalDocuments (one server). */
class FakeTransport implements WalTransport {
  readonly els: WalAppendElement[] = [];
  private seq = 0;
  async append(_key: string, body: { data: Record<string, unknown>; authorPubkey: string; authorSignature: string }) {
    this.seq += 1;
    this.els.push({ ts: this.seq, ...body });
    return { ts: this.seq };
  }
  async pull(_key: string, checkpoint: number) {
    return this.els.filter((e) => e.ts > checkpoint);
  }
}

class FakeSnapshotStore implements WalSnapshotStore {
  private docs = new Map<string, WalSnapshotDoc>();
  async read(key: string) {
    return this.docs.get(key) ?? null;
  }
  async write(key: string, doc: WalSnapshotDoc) {
    this.docs.set(key, doc);
  }
}

/** A "delegated"-style encryptor: opaque wrapper the author signature is over. */
const wrappingEncryptor: WalEncryptor = {
  seal: (obj) => ({ _encrypted: JSON.stringify(obj), _epoch: 1 }),
  open: (sealed) => JSON.parse((sealed as { _encrypted: string })._encrypted),
};

const KEY = 'spaces/s/objects/pages/p';

async function openDoc(transport: WalTransport, opts: { nonce: string; enc?: WalEncryptor; store?: WalSnapshotStore }) {
  const doc = new WalDocument({
    documentKey: KEY,
    transport,
    signer: signer(),
    encryptor: opts.enc ?? noopEncryptor,
    snapshotStore: opts.store,
    sessionNonce: opts.nonce,
  });
  await doc.open();
  return doc;
}

describe('page-model on WAL', () => {
  it('two devices adding blocks converge to the same set', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, { nonce: 'A' });
    const b = await openDoc(t, { nonce: 'B' });

    page.appendBlock(a, { type: 'heading', text: 'From A' });
    await a.commit();
    page.appendBlock(b, { type: 'paragraph', text: 'From B' });
    await b.commit();

    await a.pull();
    await b.pull();

    const idsA = page.readBlocks(a).map((x) => x.id).sort();
    const idsB = page.readBlocks(b).map((x) => x.id).sort();
    expect(idsA).toEqual(idsB);
    expect(idsA).toHaveLength(2);
    expect(page.readBlocks(a).map((x) => x.text).sort()).toEqual(['From A', 'From B']);
  });

  it('concurrent edits to the SAME block text converge (char RGA)', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, { nonce: 'A' });
    const id = page.appendBlock(a, { text: 'hello' });
    await a.commit();

    const b = await openDoc(t, { nonce: 'B' });
    expect(page.readBlocks(b).map((x) => x.text)).toEqual(['hello']);

    page.setBlockText(a, id, 'hello!');
    page.setBlockText(b, id, 'hello?');
    await a.commit();
    await b.commit();
    await a.pull();
    await b.pull();

    const ta = page.readBlocks(a)[0]!.text;
    const tb = page.readBlocks(b)[0]!.text;
    expect(ta).toBe(tb); // converged
    expect(ta).toContain('hello');
    expect(ta).toContain('!');
    expect(ta).toContain('?');
  });

  it('round-trips under a delegated (sealing) encryptor', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, { nonce: 'A', enc: wrappingEncryptor });
    page.appendBlock(a, { type: 'todo', text: 'sealed', checked: true });
    await a.commit();
    // The stored element is opaque ciphertext, not the plaintext block.
    expect(JSON.stringify(t.els[0]!.data)).not.toContain('sealed');

    const b = await openDoc(t, { nonce: 'B', enc: wrappingEncryptor });
    const blocks = page.readBlocks(b);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'todo', text: 'sealed', checked: true });
  });

  it('a fresh reader cold-starts from a trusted snapshot', async () => {
    const t = new FakeTransport();
    const store = new FakeSnapshotStore();
    const a = await openDoc(t, { nonce: 'A', store });
    page.appendBlock(a, { type: 'heading', text: 'Title' });
    page.appendBlock(a, { text: 'Body' });
    await a.commit();
    const snap = await a.snapshot();
    expect(snap.uptoTs).toBeGreaterThan(0);

    const reader = new WalDocument({
      documentKey: KEY,
      transport: t,
      signer: signer(),
      snapshotStore: store,
      posture: 'trust',
    });
    await reader.open();
    expect(reader.currentCheckpoint).toBe(snap.uptoTs); // resumed at the snapshot
    expect(page.readBlocks(reader).map((x) => x.text)).toEqual(['Title', 'Body']);
  });
});

describe('board-model on WAL', () => {
  it('two devices adding tasks to different columns converge', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, { nonce: 'A' });
    const todo = board.addColumn(a, 'Todo');
    const doing = board.addColumn(a, 'Doing');
    await a.commit();

    const b = await openDoc(t, { nonce: 'B' });
    board.addTask(a, todo, 'Task A');
    board.addTask(b, doing, 'Task B');
    await a.commit();
    await b.commit();
    await a.pull();
    await b.pull();

    const ba = board.readBoard(a);
    const bb = board.readBoard(b);
    expect(ba.total).toBe(2);
    expect(bb.total).toBe(2);
    expect(ba.tasksByColumn[todo]!.map((x) => x.title)).toEqual(['Task A']);
    expect(ba.tasksByColumn[doing]!.map((x) => x.title)).toEqual(['Task B']);
  });

  it('moving a task across columns and marking it done converges', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, { nonce: 'A' });
    const todo = board.addColumn(a, 'Todo');
    const done = board.addColumn(a, 'Done');
    const task = board.addTask(a, todo, 'Ship it');
    await a.commit();

    const b = await openDoc(t, { nonce: 'B' });
    board.moveTask(a, task, done, 1);
    board.changeStatus(a, task, 'done');
    await a.commit();
    await b.pull();

    const folded = board.readBoard(b);
    expect(folded.tasksByColumn[todo]).toEqual([]);
    expect(folded.tasksByColumn[done]!.map((x) => x.title)).toEqual(['Ship it']);
    expect(folded.done).toBe(1);
  });
});
