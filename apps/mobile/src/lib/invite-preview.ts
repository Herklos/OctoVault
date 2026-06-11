/**
 * Parse an invite (pasted text or a `#fragment` deep link) into a PREVIEW the
 * join screen can show on a consent card — name, type, identifying fingerprint —
 * WITHOUT joining. Notion never silently adds you to a workspace; neither do we:
 * `decodePublicInvite`/JSON-parsing here is pure and local, and the actual
 * `joinPublicSpace`/`acceptSpaceInvite` call only runs after the user confirms.
 */
import { decodePublicInvite, type PublicInviteToken } from './starfish/pubspace';

export type InvitePreview =
  | {
      kind: 'public';
      spaceName: string;
      /** Read/write link vs read-only. */
      write: boolean;
      token: PublicInviteToken;
    }
  | {
      kind: 'private';
      spaceName: string;
      spaceId: string;
      /** Short hex tail of the issuing owner's signing key — the thing to
       *  cross-check with the person who sent the invite. */
      issuerKey: string | null;
      /** The raw cap-bundle JSON, passed to `acceptSpaceInvite` on consent. */
      inviteJson: string;
    };

/** Shape of the private invite bundle minted by `inviteToSpace` (members.ts). */
interface PrivateInviteShape {
  spaceId?: string;
  spaceName?: string;
  cap?: { kind?: string; iss?: string };
}

/**
 * Classify + decode an invite. Accepts a public invitation link (token in a `#…`
 * fragment), a bare public fragment, or a private cap-bundle JSON. Throws a
 * human-readable Error for malformed input (safe to surface verbatim).
 */
export function previewInvite(raw: string): InvitePreview {
  const text = raw.trim();
  if (!text) throw new Error('Paste an invite link or code first.');

  // Public invites carry their credential in a URL fragment; the token itself
  // names the space, so no server round-trip is needed for the preview.
  if (text.includes('#')) {
    const token = decodePublicInvite(text.slice(text.indexOf('#')));
    return { kind: 'public', spaceName: token.spaceName, write: token.write, token };
  }

  let parsed: PrivateInviteShape;
  try {
    parsed = JSON.parse(text) as PrivateInviteShape;
  } catch {
    throw new Error('That doesn’t look like an invite. Paste the full invite code or link.');
  }
  if (!parsed?.spaceId || parsed.cap?.kind !== 'member') {
    throw new Error('That is not a valid space invite.');
  }
  const iss = parsed.cap?.iss;
  return {
    kind: 'private',
    spaceName: parsed.spaceName?.trim() || `space-${parsed.spaceId.slice(-6)}`,
    spaceId: parsed.spaceId,
    issuerKey: typeof iss === 'string' && iss.length >= 8 ? `${iss.slice(0, 8)}…${iss.slice(-8)}` : null,
    inviteJson: text,
  };
}
