/**
 * board-content unit coverage — column management + done-column flag.
 *
 * Tasks are now first-class ObjectNodes (see task-model.test.ts). This file
 * covers only the WAL-backed column operations.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { configurePlatform } from '@drakkar.software/starfish-protocol';
import { ed25519 } from '@noble/curves/ed25519.js';
import {
  WalDocument,
  createEd25519Signer,
  noopEncryptor,
  type WalAppendElement,
  type WalTransport,
} from '@drakkar.software/starfish-wal';

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

const KEY = 'spaces/s/objects/logs/b';

async function openDoc(transport: WalTransport, nonce: string) {
  const doc = new WalDocument({ documentKey: KEY, transport, signer: signer(), encryptor: noopEncryptor, sessionNonce: nonce });
  await doc.open();
  return doc;
}

describe('orderBetween (fractional drop ordering)', () => {
  it('lands strictly between two siblings', () => {
    expect(board.orderBetween(1, 2)).toBeGreaterThan(1);
    expect(board.orderBetween(1, 2)).toBeLessThan(2);
  });
  it('lands before the first card on a drop at the top', () => {
    expect(board.orderBetween(undefined, 1)).toBeLessThan(1);
  });
  it('lands after the last card on a drop at the end', () => {
    expect(board.orderBetween(3, undefined)).toBeGreaterThan(3);
  });
  it('handles an empty column', () => {
    expect(board.orderBetween(undefined, undefined)).toBe(1);
  });
  it('repeated top-insertions keep producing distinct decreasing keys', () => {
    let top: number | undefined;
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) {
      top = board.orderBetween(undefined, top);
      seen.push(top);
    }
    expect(new Set(seen).size).toBe(10);
    expect([...seen].sort((a, b) => b - a)).toEqual(seen);
  });
});

describe('moveColumn', () => {
  it('reorders the strip and converges across devices', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const c1 = board.addColumn(a, 'One');
    const c2 = board.addColumn(a, 'Two');
    const c3 = board.addColumn(a, 'Three');
    await a.commit();

    board.moveColumn(a, c3, 0);
    await a.commit();

    const b = await openDoc(t, 'B');
    expect(board.readColumns(a).map((c) => c.id)).toEqual([c3, c1, c2]);
    expect(board.readColumns(b).map((c) => c.id)).toEqual([c3, c1, c2]);
  });

  it('survives a concurrent rename of an untouched column (minimal RGA diff)', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const c1 = board.addColumn(a, 'One');
    const c2 = board.addColumn(a, 'Two');
    await a.commit();

    const b = await openDoc(t, 'B');
    board.moveColumn(a, c2, 0);
    board.renameColumn(b, c1, 'Renamed');
    await a.commit();
    await b.commit();
    await a.pull();
    await b.pull();

    const ca = board.readColumns(a);
    const cb = board.readColumns(b);
    expect(ca.map((c) => c.title)).toEqual(cb.map((c) => c.title));
    expect(ca.find((c) => c.id === c1)?.title).toBe('Renamed');
  });

  it('clamps an out-of-range index instead of dropping the column', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const c1 = board.addColumn(a, 'One');
    const c2 = board.addColumn(a, 'Two');
    board.moveColumn(a, c1, 99);
    expect(board.readColumns(a).map((c) => c.id)).toEqual([c2, c1]);
  });
});

describe('deleteColumn', () => {
  it('removes the column from the strip', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const keep = board.addColumn(a, 'Keep');
    const drop = board.addColumn(a, 'Drop');
    await a.commit();

    board.deleteColumn(a, drop);
    await a.commit();

    const b = await openDoc(t, 'B');
    expect(board.readColumns(a).map((c) => c.id)).toEqual([keep]);
    expect(board.readColumns(b).map((c) => c.id)).toEqual([keep]);
  });
});

describe('done column (coldone register)', () => {
  it('seeds To do / In progress / Done with Done flagged', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    board.seedDefaultColumns(a);
    const cols = board.readColumns(a);
    expect(cols.map((c) => c.title)).toEqual(['To do', 'In progress', 'Done']);
    expect(cols.map((c) => c.done)).toEqual([false, false, true]);
  });

  it('setColumnDone toggles the flag and converges', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const col = board.addColumn(a, 'Finished');
    board.setColumnDone(a, col, true);
    await a.commit();

    const b = await openDoc(t, 'B');
    expect(board.readColumns(b).find((c) => c.id === col)?.done).toBe(true);

    board.setColumnDone(a, col, false);
    await a.commit();
    await b.pull();
    expect(board.readColumns(b).find((c) => c.id === col)?.done).toBe(false);
  });
});
