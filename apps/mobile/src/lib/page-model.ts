/**
 * Page-as-blocks model on a {@link WalDocument} (the Notion-style core).
 *
 * One page = one WAL document holding:
 *  - an RGA list **`order`** of block ids (ordering + insert/delete; reorder via
 *    the reconcile `setList`, which keeps unchanged ids and only diffs the move);
 *  - per block, a char-RGA text list **`text:{id}`** so two people editing the
 *    same block converge per character (`setText`);
 *  - per block, LWW registers **`type:{id}`** and **`checked:{id}`** for the
 *    block kind and the to-do state.
 *
 * Pure functions over a WalDocument: no React, no network — unit-testable with a
 * fake transport. The `use-page` hook owns commit/pull; these only build ops.
 */
import type { Json, WalDocument } from '@drakkar.software/starfish-wal';

import { randomId } from './ids';

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'subheading'
  | 'todo'
  | 'bulleted'
  | 'numbered'
  | 'toggle'
  | 'quote'
  | 'code'
  | 'divider';

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  /** Only meaningful for `type === 'todo'`. */
  checked?: boolean;
}

export interface NewBlock {
  type?: BlockType;
  text?: string;
  checked?: boolean;
}

const ORDER = 'order';
const typeReg = (id: string) => `type:${id}`;
const checkedReg = (id: string) => `checked:${id}`;
const textList = (id: string) => `text:${id}`;

function orderOf(doc: WalDocument): string[] {
  const v = doc.materialize()[ORDER];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Project the WAL document into an ordered, de-duplicated list of blocks. */
export function readBlocks(doc: WalDocument): Block[] {
  const state = doc.materialize();
  const order = Array.isArray(state[ORDER]) ? (state[ORDER] as Json[]) : [];
  const seen = new Set<string>();
  const blocks: Block[] = [];
  for (const raw of order) {
    if (typeof raw !== 'string' || seen.has(raw)) continue; // dedup concurrent reorders
    seen.add(raw);
    const type = (state[typeReg(raw)] as BlockType | undefined) ?? 'paragraph';
    const checkedVal = state[checkedReg(raw)];
    blocks.push({
      id: raw,
      type,
      text: doc.text(textList(raw)),
      checked: typeof checkedVal === 'boolean' ? checkedVal : undefined,
    });
  }
  return blocks;
}

/** Insert a new block at `index` (clamped). Returns the new block id. */
export function insertBlock(doc: WalDocument, index: number, init: NewBlock = {}): string {
  const id = randomId();
  doc.setField(typeReg(id), init.type ?? 'paragraph');
  if (init.text) doc.setText(textList(id), init.text);
  if (init.checked !== undefined) doc.setField(checkedReg(id), init.checked);
  const order = orderOf(doc);
  const at = Math.max(0, Math.min(index, order.length));
  doc.setList(ORDER, [...order.slice(0, at), id, ...order.slice(at)]);
  return id;
}

/** Append a block to the end. Returns the new block id. */
export function appendBlock(doc: WalDocument, init: NewBlock = {}): string {
  return insertBlock(doc, orderOf(doc).length, init);
}

/** Replace a block's body text (character-level CRDT merge). */
export function setBlockText(doc: WalDocument, id: string, text: string): void {
  doc.setText(textList(id), text);
}

export function setBlockType(doc: WalDocument, id: string, type: BlockType): void {
  doc.setField(typeReg(id), type);
}

export function setBlockChecked(doc: WalDocument, id: string, checked: boolean): void {
  doc.setField(checkedReg(id), checked);
}

/** Remove a block: drop it from `order`, clear its text, tombstone its props. */
export function removeBlock(doc: WalDocument, id: string): void {
  doc.setList(ORDER, orderOf(doc).filter((x) => x !== id));
  doc.setText(textList(id), '');
  doc.deleteField(typeReg(id));
  doc.deleteField(checkedReg(id));
}

/** Move a block to `toIndex` via a minimal reconcile of the order list. */
export function moveBlock(doc: WalDocument, id: string, toIndex: number): void {
  const order = orderOf(doc).filter((x) => x !== id);
  const at = Math.max(0, Math.min(toIndex, order.length));
  order.splice(at, 0, id);
  doc.setList(ORDER, order);
}
