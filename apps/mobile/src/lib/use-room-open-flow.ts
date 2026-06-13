/**
 * Shared space-open effect for {@link ./use-merge-doc} (merge-doc) and
 * append-only content hooks. Resolves the crypto context for a space:
 *  - E2EE space: opens the space keyring encryptor (cached per space; offline
 *    from the SDK pull cache) and its doc client.
 *  - Plaintext space: `encryptor` is null; client is the member cap client.
 * Builds on {@link useSpaceOpenState} for the opening/error/offline flags + reconnect.
 *
 * Reachability is NOT reported here — building the encryptor may have used the
 * cache (offline); the caller reports it from its first fresh pull.
 */
import { useEffect, useState } from 'react';
import type { Encryptor, StarfishClient } from '@drakkar.software/starfish-client';

import { getMemberCap } from '@drakkar.software/octovault-sdk';
import { getSpaceEncryptor } from '@drakkar.software/octovault-sdk';
import { useSpaceRegistryActions } from './space-registry-context';
import { useSession } from './session-context';
import { useSpaceOpenState } from './use-space-open';

export interface RoomOpenFlow {
  encryptor: Encryptor | null;
  client: StarfishClient | null;
  opening: boolean;
  openError: string | null;
  offline: boolean;
  reload: () => void;
}

export function useSpaceOpen(opts: {
  docId: string;
  spaceId: string;
  enabled: boolean;
}): RoomOpenFlow {
  const { docId, spaceId, enabled } = opts;
  const { session } = useSession();
  const { ensure: ensureRegistry } = useSpaceRegistryActions();
  const [encryptor, setEncryptor] = useState<Encryptor | null>(null);
  const [client, setClient] = useState<StarfishClient | null>(null);
  const { opening, openError, offline, reloadNonce, reload, beginOpen, finishOpening, failOpen } =
    useSpaceOpenState();

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset doc crypto/open state before reopening when doc or session changes
    setEncryptor(null);
    setClient(null);
    beginOpen();
    if (!enabled || !session) return;
    (async () => {
      try {
        const reg = getMemberCap(spaceId) ? null : await ensureRegistry(spaceId);
        const { encryptor: enc, client: docClient } = await getSpaceEncryptor(spaceId, session, reg);
        if (!cancelled) {
          setEncryptor(enc);
          setClient(docClient);
          // NOTE: no openReached() — building the encryptor may have used the cached
          // keyring (offline). Reachability is reported from the caller's first fresh pull.
          finishOpening();
        }
      } catch (e) {
        if (!cancelled) failOpen(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, session, docId, spaceId, ensureRegistry, reloadNonce, beginOpen, finishOpening, failOpen]);

  return { encryptor, client, opening, openError, offline, reload };
}

/** @deprecated Use {@link useSpaceOpen} */
export const useRoomOpen = useSpaceOpen;
