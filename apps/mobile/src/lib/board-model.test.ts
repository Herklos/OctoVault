/**
 * board-model unit coverage — the column-management + done-column + undo
 * surface added for the kanban redesign. Exercises the PURE model over real
 * {@link WalDocument}s on an in-memory transport (same harness as wal.test.ts)
 * so every assertion is also a convergence check: anything a UI gesture writes
 * must survive a second device's pull.
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

import * as board from './board-model';

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

const KEY = 'spaces/s/objects/boards/b';

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
    expect(board.readBoard(a).columns.map((c) => c.id)).toEqual([c3, c1, c2]);
    expect(board.readBoard(b).columns.map((c) => c.id)).toEqual([c3, c1, c2]);
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

    const fa = board.readBoard(a);
    const fb = board.readBoard(b);
    expect(fa.columns.map((c) => c.title)).toEqual(fb.columns.map((c) => c.title));
    expect(fa.columns.find((c) => c.id === c1)?.title).toBe('Renamed');
  });

  it('clamps an out-of-range index instead of dropping the column', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const c1 = board.addColumn(a, 'One');
    const c2 = board.addColumn(a, 'Two');
    board.moveColumn(a, c1, 99);
    expect(board.readBoard(a).columns.map((c) => c.id)).toEqual([c2, c1]);
  });
});

describe('deleteColumn', () => {
  it('re-homes its cards to the target column, after its last card, in order', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const keep = board.addColumn(a, 'Keep');
    const drop = board.addColumn(a, 'Drop');
    board.addTask(a, keep, 'K1');
    board.addTask(a, drop, 'D1');
    board.addTask(a, drop, 'D2');
    await a.commit();

    board.deleteColumn(a, drop, { moveTasksTo: keep });
    await a.commit();

    const b = await openDoc(t, 'B');
    for (const d of [a, b]) {
      const folded = board.readBoard(d);
      expect(folded.columns.map((c) => c.title)).toEqual(['Keep']);
      expect(folded.tasksByColumn[keep]!.map((x) => x.title)).toEqual(['K1', 'D1', 'D2']);
      expect(folded.total).toBe(3);
    }
  });

  it('deletes its cards (and their registers) when no target is given', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const keep = board.addColumn(a, 'Keep');
    const drop = board.addColumn(a, 'Drop');
    board.addTask(a, drop, 'Gone');
    await a.commit();

    board.deleteColumn(a, drop);
    await a.commit();

    const b = await openDoc(t, 'B');
    const folded = board.readBoard(b);
    expect(folded.columns.map((c) => c.id)).toEqual([keep]);
    expect(folded.total).toBe(0);
  });
});

describe('done column (coldone register)', () => {
  it('seeds To do / In progress / Done with Done flagged', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    board.seedDefaultColumns(a);
    const folded = board.readBoard(a);
    expect(folded.columns.map((c) => c.title)).toEqual(['To do', 'In progress', 'Done']);
    expect(folded.columns.map((c) => c.done)).toEqual([false, false, true]);
  });

  it('derives done purely from column membership when a done column exists', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const todo = board.addColumn(a, 'To do');
    const done = board.addColumn(a, 'Done');
    board.setColumnDone(a, done, true);
    const task = board.addTask(a, todo, 'Ship');
    // Stale legacy status must NOT override the column once the flag exists —
    // otherwise a card dragged out of Done stays struck through.
    board.changeStatus(a, task, 'done');
    let folded = board.readBoard(a);
    expect(folded.tasksByColumn[todo]![0]!.done).toBe(false);
    expect(folded.done).toBe(0);

    board.moveTask(a, task, done, 1);
    await a.commit();
    const b = await openDoc(t, 'B');
    folded = board.readBoard(b);
    expect(folded.tasksByColumn[done]![0]!.done).toBe(true);
    expect(folded.done).toBe(1);
  });

  it('falls back to the legacy status register on boards without a done column', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const col = board.addColumn(a, 'Anything');
    const task = board.addTask(a, col, 'Old-style');
    board.changeStatus(a, task, 'done');
    const folded = board.readBoard(a);
    expect(folded.tasksByColumn[col]![0]!.done).toBe(true);
    expect(folded.done).toBe(1);
  });
});

describe('fractional moveTask + addTask order', () => {
  it('an explicit top order places the card first', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const col = board.addColumn(a, 'Col');
    board.addTask(a, col, 'First');
    const first = board.readBoard(a).tasksByColumn[col]![0]!;
    board.addTask(a, col, 'On top', board.orderBetween(undefined, first.order));
    expect(board.readBoard(a).tasksByColumn[col]!.map((x) => x.title)).toEqual(['On top', 'First']);
  });

  it('a between-siblings drop converges across devices', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const col = board.addColumn(a, 'Col');
    board.addTask(a, col, 'One');
    board.addTask(a, col, 'Two');
    const other = board.addColumn(a, 'Other');
    const moved = board.addTask(a, other, 'Moved');
    await a.commit();

    const [one, two] = board.readBoard(a).tasksByColumn[col]!;
    board.moveTask(a, moved, col, board.orderBetween(one!.order, two!.order));
    await a.commit();

    const b = await openDoc(t, 'B');
    expect(board.readBoard(b).tasksByColumn[col]!.map((x) => x.title)).toEqual(['One', 'Moved', 'Two']);
    expect(board.readBoard(b).tasksByColumn[other]).toEqual([]);
  });
});

describe('duplicateTask / restoreTask (card menu + undo toast)', () => {
  it('duplicates title, notes and status right below the source', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const col = board.addColumn(a, 'Col');
    const src = board.addTask(a, col, 'Original');
    board.updateTask(a, src, { notes: 'details' });
    board.addTask(a, col, 'After');
    await a.commit();

    const [source, after] = board.readBoard(a).tasksByColumn[col]!;
    board.duplicateTask(a, source!, board.orderBetween(source!.order, after!.order));
    await a.commit();

    const b = await openDoc(t, 'B');
    const folded = board.readBoard(b).tasksByColumn[col]!;
    expect(folded.map((x) => x.title)).toEqual(['Original', 'Original', 'After']);
    expect(folded[1]!.notes).toBe('details');
    expect(folded[1]!.id).not.toBe(source!.id);
  });

  it('restoreTask revives a deleted card with every register intact', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const col = board.addColumn(a, 'Col');
    const id = board.addTask(a, col, 'Keep me');
    board.updateTask(a, id, { notes: 'precious' });
    await a.commit();

    const snapshot = board.readBoard(a).tasksByColumn[col]![0]!;
    board.deleteTask(a, id);
    await a.commit();
    expect(board.readBoard(a).total).toBe(0);

    board.restoreTask(a, snapshot);
    await a.commit();

    const b = await openDoc(t, 'B');
    const revived = board.readBoard(b).tasksByColumn[col]![0]!;
    expect(revived.id).toBe(id);
    expect(revived.title).toBe('Keep me');
    expect(revived.notes).toBe('precious');
    expect(board.readBoard(b).total).toBe(1);
  });
});

describe('orphan tasks (stale column register)', () => {
  it('folds a task whose column vanished into the first column instead of hiding it', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const home = board.addColumn(a, 'Home');
    const doomed = board.addColumn(a, 'Doomed');
    const task = board.addTask(a, doomed, 'Orphan');
    await a.commit();

    const b = await openDoc(t, 'B');
    // Device B drops the column WITHOUT re-homing (it never saw the task land
    // there — e.g. the moveTask op raced the delete).
    const docB = b;
    docB.setField(`task:${task}:col`, 'no-such-column');
    board.deleteColumn(a, doomed, { moveTasksTo: home });
    await a.commit();
    await docB.commit();
    await a.pull();
    await docB.pull();

    for (const d of [a, docB]) {
      const folded = board.readBoard(d);
      expect(folded.tasksByColumn[home]!.some((x) => x.title === 'Orphan')).toBe(true);
      expect(folded.total).toBe(1);
    }
  });
});
