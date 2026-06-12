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

import * as page from './page-content';
import { continuationType, filterBlockTypes, listOrdinals, mdShortcut } from './blocks';

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

const KEY = 'spaces/s/objects/pages/p';

async function openDoc(transport: WalTransport, nonce: string) {
  const doc = new WalDocument({
    documentKey: KEY,
    transport,
    signer: signer(),
    encryptor: noopEncryptor,
    sessionNonce: nonce,
  });
  await doc.open();
  return doc;
}

describe('page-model structure registers (indent / collapsed / ref)', () => {
  it('round-trips indent, collapsed and ref across devices', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const tog = page.appendBlock(a, { type: 'toggle', text: 'More' });
    const child = page.appendBlock(a, { text: 'hidden detail', indent: 1 });
    const link = page.appendBlock(a, { type: 'page', ref: 'obj-123' });
    page.setBlockCollapsed(a, tog, true);
    await a.commit();

    const b = await openDoc(t, 'B');
    const blocks = page.readBlocks(b);
    expect(blocks.find((x) => x.id === tog)).toMatchObject({ type: 'toggle', collapsed: true });
    expect(blocks.find((x) => x.id === child)).toMatchObject({ indent: 1 });
    expect(blocks.find((x) => x.id === link)).toMatchObject({ type: 'page', ref: 'obj-123' });
  });

  it('setBlockIndent clamps to ≥ 0 and clears the register at 0', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const id = page.appendBlock(a, { text: 'x', indent: 2 });
    page.setBlockIndent(a, id, -3);
    expect(page.readBlocks(a)[0]!.indent).toBeUndefined();
  });

  it('visibleBlocks hides only the collapsed toggle’s deeper run (nested toggles too)', () => {
    const mk = (id: string, type: page.BlockType, indent?: number, collapsed?: boolean): page.Block => ({
      id,
      type,
      text: id,
      indent,
      collapsed,
    });
    const blocks = [
      mk('a', 'paragraph'),
      mk('t1', 'toggle', 0, true),
      mk('b', 'paragraph', 1), // hidden under t1
      mk('t2', 'toggle', 1, false), // hidden under t1 even though itself open
      mk('c', 'paragraph', 2), // hidden under t1
      mk('d', 'paragraph', 0), // back at root → visible
      mk('t3', 'toggle', 0, false),
      mk('e', 'paragraph', 1), // open toggle → visible
    ];
    expect(page.visibleBlocks(blocks).map((x) => x.id)).toEqual(['a', 't1', 'd', 't3', 'e']);
  });
});

describe('page-model split / merge / duplicate / restore', () => {
  it('splitBlock keeps the head, inserts the tail right below, and converges', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    page.appendBlock(a, { type: 'heading', text: 'Title' });
    const id = page.appendBlock(a, { type: 'todo', text: 'buy milk', indent: 1 });
    const nid = page.splitBlock(a, id, 'buy ', { type: 'todo', text: 'milk', indent: 1 });
    expect(nid).toBeTruthy();
    await a.commit();

    const b = await openDoc(t, 'B');
    const blocks = page.readBlocks(b);
    expect(blocks.map((x) => x.text)).toEqual(['Title', 'buy ', 'milk']);
    expect(blocks[2]).toMatchObject({ type: 'todo', indent: 1 });
  });

  it('splitBlock returns null for a block no longer in the order', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const id = page.appendBlock(a, { text: 'x' });
    page.removeBlock(a, id);
    expect(page.splitBlock(a, id, 'x', {})).toBeNull();
  });

  it('mergeBlockIntoPrevious joins texts at the seam and honors the live override', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    page.appendBlock(a, { text: 'Hello ' });
    const id = page.appendBlock(a, { text: 'stale' });
    // The editor's field holds newer text than the last commit — merge must use it.
    const res = page.mergeBlockIntoPrevious(a, id, 'world');
    expect(res).toMatchObject({ offset: 6 });
    await a.commit();

    const b = await openDoc(t, 'B');
    const blocks = page.readBlocks(b);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.text).toBe('Hello world');
  });

  it('mergeBlockIntoPrevious returns null at the top of the document', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const id = page.appendBlock(a, { text: 'first' });
    expect(page.mergeBlockIntoPrevious(a, id)).toBeNull();
  });

  it('duplicateBlock copies type/text/checked/indent below the source', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    const id = page.appendBlock(a, { type: 'todo', text: 'done thing', checked: true, indent: 2 });
    page.appendBlock(a, { text: 'tail' });
    const copy = page.duplicateBlock(a, id);
    const blocks = page.readBlocks(a);
    expect(blocks.map((x) => x.id)).toEqual([id, copy, blocks[2]!.id]);
    expect(blocks[1]).toMatchObject({ type: 'todo', text: 'done thing', checked: true, indent: 2 });
  });

  it('restoreBlock revives a removed block at its old index with the SAME id', async () => {
    const t = new FakeTransport();
    const a = await openDoc(t, 'A');
    page.appendBlock(a, { text: 'one' });
    const id = page.appendBlock(a, { type: 'quote', text: 'two', indent: 1 });
    page.appendBlock(a, { text: 'three' });
    const snapshot = page.readBlocks(a).find((x) => x.id === id)!;
    page.removeBlock(a, id);
    page.restoreBlock(a, 1, snapshot);
    await a.commit();

    const b = await openDoc(t, 'B');
    const blocks = page.readBlocks(b);
    expect(blocks.map((x) => x.text)).toEqual(['one', 'two', 'three']);
    expect(blocks[1]).toMatchObject({ id, type: 'quote', indent: 1 });
  });
});

describe('blocks.ts typing helpers', () => {
  it('mdShortcut matches prefixes (not exact text) and keeps the remainder', () => {
    expect(mdShortcut('# Title')).toMatchObject({ type: 'heading', rest: 'Title' });
    expect(mdShortcut('## ')).toMatchObject({ type: 'subheading', rest: '' });
    expect(mdShortcut('- milk')).toMatchObject({ type: 'bulleted', rest: 'milk' });
    expect(mdShortcut('* milk')).toMatchObject({ type: 'bulleted', rest: 'milk' });
    expect(mdShortcut('[] task')).toMatchObject({ type: 'todo', rest: 'task' });
    expect(mdShortcut('[x] done')).toMatchObject({ type: 'todo', rest: 'done', checked: true });
    expect(mdShortcut('> wisdom')).toMatchObject({ type: 'quote', rest: 'wisdom' });
    expect(mdShortcut('```')).toMatchObject({ type: 'code', rest: '' });
    expect(mdShortcut('``` js')).toMatchObject({ type: 'code', rest: 'js' });
    expect(mdShortcut('---')).toMatchObject({ type: 'divider', rest: '' });
    expect(mdShortcut('#nope')).toBeUndefined();
    expect(mdShortcut('plain text')).toBeUndefined();
  });

  it('mdShortcut numbers any ordinal ("1. " / "12) ")', () => {
    expect(mdShortcut('1. first')).toMatchObject({ type: 'numbered', rest: 'first' });
    expect(mdShortcut('12) later')).toMatchObject({ type: 'numbered', rest: 'later' });
    expect(mdShortcut('1.x')).toBeUndefined();
  });

  it('continuationType continues lists and resets headers/quotes to paragraph', () => {
    expect(continuationType('todo')).toBe('todo');
    expect(continuationType('bulleted')).toBe('bulleted');
    expect(continuationType('numbered')).toBe('numbered');
    expect(continuationType('toggle')).toBe('toggle');
    expect(continuationType('heading')).toBe('paragraph');
    expect(continuationType('quote')).toBe('paragraph');
    expect(continuationType('paragraph')).toBe('paragraph');
  });

  it('filterBlockTypes matches labels and keyword aliases, keeping menu order', () => {
    expect(filterBlockTypes('').length).toBeGreaterThan(8);
    expect(filterBlockTypes('h2').map((d) => d.type)).toEqual(['subheading']);
    expect(filterBlockTypes('head').map((d) => d.type)).toEqual(['heading', 'subheading']);
    expect(filterBlockTypes('check')[0]!.type).toBe('todo');
    expect(filterBlockTypes('zzz')).toEqual([]);
  });

  it('listOrdinals restarts after a break at the same level but not across nesting', () => {
    const mk = (id: string, type: page.BlockType, indent?: number) => ({ id, type, indent });
    const blocks = [
      mk('h', 'heading'),
      mk('n1', 'numbered'),
      mk('n2', 'numbered'),
      mk('nested', 'paragraph', 1), // nested under n2 — must NOT break the level-0 run
      mk('n3', 'numbered'),
      mk('p', 'paragraph'), // breaks the run
      mk('m1', 'numbered'),
    ];
    const ord = listOrdinals(blocks);
    expect([ord.get('n1'), ord.get('n2'), ord.get('n3'), ord.get('m1')]).toEqual([1, 2, 3, 1]);
    expect(ord.get('h')).toBeUndefined();
  });
});
