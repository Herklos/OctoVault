/**
 * Owner-side invite minting for ONE space, split private vs public:
 *  - PRIVATE → {@link inviteToSpace}: paste an invitee's join-request → an invite cap
 *    bundle (JSON) the invitee accepts on the Join screen. `canWrite` is implied true
 *    (the private model grants whole-space membership).
 *  - PUBLIC  → {@link createPublicInvite}: a read-only / read-write toggle → a
 *    self-sufficient invitation LINK (the credential rides the URL fragment).
 *
 * Both results are plain strings surfaced through a <CopyField>. The page owns the
 * inputs (the pasted request, the write toggle); this hook owns the async + errors.
 */
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { useSession } from './session-context';
import { useSpaces } from './use-spaces';
import { inviteToSpace } from '@drakkar.software/octovault-sdk';
import { createPublicInvite, isPublicSpaceId } from '@drakkar.software/octovault-sdk';
import { getWebBase } from '@drakkar.software/octovault-sdk';

/** The app's public web origin for invite links: the live origin on web, else the
 *  configured `WEB_BASE` (native has no `window`; empty → a host-less `/join#…`). */
function inviteOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return getWebBase();
}

export interface SpaceInviteState {
  isPublic: boolean;
  busy: boolean;
  error: string | null;
  /** The minted invite — a private cap bundle or a public link — or null until generated. */
  result: string | null;
  /** Private: mint an invite cap from a pasted join-request. */
  generatePrivateInvite: (joinRequestJson: string) => Promise<void>;
  /** Public: mint a read-only (false) or read/write (true) invitation link. */
  generatePublicInvite: (write: boolean) => Promise<void>;
  /** Clear the current result/error (e.g. when the input changes). */
  reset: () => void;
}

export function useSpaceInvite(spaceId: string): SpaceInviteState {
  const { session } = useSession();
  const { spaces } = useSpaces();
  const isPublic = isPublicSpaceId(spaceId) || spaces.find((s) => s.id === spaceId)?.type === 'public';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const generatePrivateInvite = useCallback(
    async (joinRequestJson: string) => {
      if (!session || busy) return;
      const req = joinRequestJson.trim();
      if (!req) {
        setError('Paste the invitee’s join request first.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const invite = await inviteToSpace(session, spaceId, req);
        setResult(invite);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not generate that invite.');
      } finally {
        setBusy(false);
      }
    },
    [session, busy, spaceId],
  );

  const generatePublicInvite = useCallback(
    async (write: boolean) => {
      if (!session || busy) return;
      const spaceName = spaces.find((s) => s.id === spaceId)?.name ?? 'Public space';
      setBusy(true);
      setError(null);
      try {
        const { link } = await createPublicInvite(session, spaceId, spaceName, write, inviteOrigin());
        setResult(link);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not generate that link.');
      } finally {
        setBusy(false);
      }
    },
    [session, busy, spaces, spaceId],
  );

  return { isPublic, busy, error, result, generatePrivateInvite, generatePublicInvite, reset };
}
