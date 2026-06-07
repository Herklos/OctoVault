import { useCallback, useMemo } from 'react';

import { isPublicSpaceId } from './starfish/pubspace';
import { pageLogName } from './starfish/paths';
import { useSession } from './session-context';
import { useRoomOpen } from './use-room-open-flow';
import { useRoomLiveSync } from './use-room-live-sync';
import { useWalDoc } from './use-wal-doc';
import * as page from './page-model';
import type { Block, BlockType, NewBlock } from './page-model';

export type { Block, BlockType, NewBlock } from './page-model';

export interface PageHook {
  blocks: Block[];
  ready: boolean;
  opening: boolean;
  openError: string | null;
  offline: boolean;
  reload: () => void;
  /** Returns the new block id (or undefined before the doc is open). */
  appendBlock: (init?: NewBlock) => string | undefined;
  insertBlock: (index: number, init?: NewBlock) => string | undefined;
  setBlockText: (id: string, text: string) => void;
  setBlockType: (id: string, type: BlockType) => void;
  setBlockChecked: (id: string, checked: boolean) => void;
  removeBlock: (id: string) => void;
  moveBlock: (id: string, toIndex: number) => void;
}

/**
 * One `page` Object's block content, backed by a {@link WalDocument} (CRDT op-log).
 * The page title/emoji live on the index NODE ({@link useObjects}); this hook owns
 * the blocks. Concurrent edits converge (per-block char-RGA text). v1 is private
 * (E2EE) spaces only — public/plaintext pages are a deferred follow-up.
 */
export function usePage(spaceId: string, pageId: string, opts: { enabled?: boolean } = {}): PageHook {
  const { session } = useSession();
  const enabled = (opts.enabled ?? true) && !!spaceId && !!pageId && !isPublicSpaceId(spaceId);

  const { encryptor, client, opening, openError, offline, reload: reopenSpace } = useRoomOpen({
    roomId: pageId,
    spaceId,
    isPublic: false,
    enabled,
    initializeRoom: false,
  });

  const { doc, ready, version, touch, pull, reload: reloadDoc } = useWalDoc({
    client,
    encryptor,
    documentKey: pageLogName(spaceId, pageId),
    edPubHex: session?.keys.edPub,
    edPrivHex: session?.keys.edPriv,
    enabled: enabled && !!client && !!encryptor,
  });

  // Live cross-device updates: focus-pull (+ poll while SSE is down) folds new ops.
  useRoomLiveSync({ roomId: pageId, ready, pull, skipFirstFocus: true, firstFocusKey: pageId });

  // `version` is the recompute trigger — the WalDocument is mutated in place.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const blocks = useMemo<Block[]>(() => (doc ? page.readBlocks(doc) : []), [doc, version]);

  const mut = useCallback(
    <T,>(fn: (d: NonNullable<typeof doc>) => T): T | undefined => {
      if (!doc) return undefined;
      const r = fn(doc);
      touch();
      return r;
    },
    [doc, touch],
  );

  return {
    blocks,
    ready,
    opening: enabled ? opening : false,
    openError,
    offline,
    reload: () => {
      reopenSpace();
      reloadDoc();
    },
    appendBlock: (init) => mut((d) => page.appendBlock(d, init)),
    insertBlock: (index, init) => mut((d) => page.insertBlock(d, index, init)),
    setBlockText: (id, text) => mut((d) => page.setBlockText(d, id, text)),
    setBlockType: (id, type) => mut((d) => page.setBlockType(d, id, type)),
    setBlockChecked: (id, checked) => mut((d) => page.setBlockChecked(d, id, checked)),
    removeBlock: (id) => mut((d) => page.removeBlock(d, id)),
    moveBlock: (id, toIndex) => mut((d) => page.moveBlock(d, id, toIndex)),
  };
}
