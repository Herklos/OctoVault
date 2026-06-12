/**
 * Shared space-open effect for {@link ./use-merge-doc} (merge-doc) and
 * append-only content hooks. Both resolve the same crypto context the same way:
 *  - PUBLIC space: no keyring/encryptor — authorize with the invite cap (joiner) or the
 *    account cap (owner) via {@link publicSpaceAuth} and build a plain client.
 *  - PRIVATE space (E2EE): open the space keyring encryptor (cached per space; offline
 *    from the SDK pull cache) and its doc client.
 * Builds on {@link useSpaceOpenState} for the opening/error/offline flags + reconnect.
 *
 * Reachability is NOT reported here — building the encryptor may have used the
 * cache (offline); the caller reports it from its first fresh pull.
 */
import { useEffect, useState } from 'react';
import type { Encryptor, StarfishClient } from '@drakkar.software/starfish-client';

import { makeClient } from '@drakkar.software/octovault-sdk';
import { getMemberCap } from '@drakkar.software/octovault-sdk';
import { getSpaceEncryptor } from '@drakkar.software/octovault-sdk';
import { publicSpaceAuth } from '@drakkar.software/octovault-sdk';
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
  isPublic: boolean;
  enabled: boolean;
}): RoomOpenFlow {
  const { docId, spaceId, isPublic, enabled } = opts;
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
        if (isPublic) {
          // Public space: no keyring, no encryptor. Authorize with the invite cap
          // (joiner) or the account cap (owner) — see publicSpaceAuth.
          const auth = publicSpaceAuth(session, spaceId);
          if (!cancelled) {
            setEncryptor(null);
            setClient(makeClient(auth.cap, auth.signingKey));
            finishOpening(); // public open did no network call — proves no reachability
          }
          return;
        }
        // PRIVATE: the keyring is space-wide (cached per space; see getSpaceEncryptor),
        // the doc is per-node. With no stored member cap we need the registry owner
        // for the owner-vs-no-access decision — read it once via the SHARED registry
        // rather than a private `readSpaceAccess`, so the doc screen and sidebar don't
        // each pull it.
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
  }, [enabled, session, docId, spaceId, isPublic, ensureRegistry, reloadNonce, beginOpen, finishOpening, failOpen]);

  return { encryptor, client, opening, openError, offline, reload };
}

/** @deprecated Use {@link useSpaceOpen} */
export const useRoomOpen = useSpaceOpen;
