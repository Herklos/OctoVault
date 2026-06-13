/**
 * Generic content hook for any object with WAL-backed content.
 *
 * Collapses `usePage`/`useBoard` into a single lifecycle owner:
 *  open → pull → commit.
 *
 * Hook-order stability: `useWalDoc` is called unconditionally every render with
 * an `enabled` gate. When a future content kind (`'merge'`) is added, its hook
 * will likewise be called unconditionally with its own `enabled` flag so React
 * never sees a different number of hooks per render regardless of which content
 * kind the object currently has.
 */
import { useCallback } from 'react';
import type { WalDocument } from '@drakkar.software/starfish-wal';

import { objLogName } from '@drakkar.software/octovault-sdk';
import { useSession } from './session-context';
import { useSpaceOpen } from './use-room-open-flow';
import { useDocLiveSync } from './use-doc-live-sync';
import { useWalDoc } from './use-wal-doc';
import type { ObjectContentKind } from '@drakkar.software/octovault-sdk';

export interface ObjectContentHandle {
  /** WAL document — non-null once open (contentKind === 'append'). */
  walDoc: WalDocument | null;
  contentKind: ObjectContentKind;
  ready: boolean;
  version: number;
  /** Bump version + debounce-commit. Call after any WAL mutation. */
  touch: () => void;
  pull: () => void;
  opening: boolean;
  openError: string | null;
  offline: boolean;
  reload: () => void;
}

/**
 * Open a single object's WAL content doc, expose the shared lifecycle state,
 * and wire live cross-device sync. Compose this in `usePage`/`useBoard` wrappers
 * to add model-specific read/mutate ops on top.
 */
export function useObjectContent(
  spaceId: string,
  objectId: string,
  contentKind: ObjectContentKind,
  opts: { enabled?: boolean } = {},
): ObjectContentHandle {
  const { session } = useSession();
  const base = (opts.enabled ?? true) && !!spaceId && !!objectId;
  const walEnabled = base && contentKind === 'append';

  const { encryptor, client, opening: roomOpening, openError: roomOpenError, offline, reload: reopenSpace } = useSpaceOpen({
    docId: objectId,
    spaceId,
    enabled: base,
  });

  // Always call useWalDoc (even when walEnabled=false) for stable hook order.
  const { doc: walDoc, ready, version, touch, pull, reload: reloadDoc, opening: walOpening, openError: walOpenError } = useWalDoc({
    client,
    encryptor,
    documentKey: objLogName(spaceId, objectId),
    edPubHex: session?.keys.edPub,
    edPrivHex: session?.keys.edPriv,
    enabled: walEnabled && !!client && !!encryptor,
  });

  // Live cross-device sync (focus-pull + SSE poll).
  useDocLiveSync({ docId: objectId, ready, pull, skipFirstFocus: true, firstFocusKey: objectId });

  const reload = useCallback(() => {
    reopenSpace();
    reloadDoc();
  }, [reopenSpace, reloadDoc]);

  return {
    walDoc,
    contentKind,
    ready,
    version,
    touch,
    pull,
    opening: base ? (roomOpening || walOpening) : false,
    openError: roomOpenError ?? walOpenError,
    offline,
    reload,
  };
}
