/**
 * Bot / integration write credentials for automation stream rooms.
 *
 * `openStreamBotCredential` opens a stored (sealed) bot credential from an
 * automation node's `meta.automation.credential` field.
 *
 * NOTE: `createStreamBotCredential` relied on the removed pubstream/public-link
 * model. New automation bots are enrolled as node members via `inviteToNode` and
 * receive a standard member cap; this module only provides the credential-open
 * helper needed at runtime.
 */
import { unsealFromSelf, type SealedBlob } from './account-seal';
import type { Session } from './identity';

export interface StreamBotCredential {
  /** The public-link fragment (an audience cap) — the bot's `parsePublicLink` input.
   *  Carries no private key; the bot signs with its own generated key. */
  token: string;
  /** Full append endpoint the bot POSTs to (already namespace-prefixed). */
  endpoint: string;
  /** The path+query the bot must sign (what `redeemPublicLink` binds the signature to). */
  signPath: string;
  /** Absolute expiry (unix seconds) of the credential, if a TTL was set. */
  expiresAt?: number;
}

/** Open a stored automation bot credential. Current rooms store it SEALED to the owner
 *  key (`mintSealedCredential`) — unseal with the seed. A LEGACY room (created before
 *  the seal) stored the credential in the clear; detect that by its `token` and return
 *  it as-is so the automation keeps working until the owner rotates (which re-seals).
 *  No new exposure: a legacy credential was already plaintext in the synced doc. */
export async function openStreamBotCredential(
  session: Session,
  stored: SealedBlob | StreamBotCredential,
): Promise<StreamBotCredential> {
  if (typeof (stored as Partial<StreamBotCredential>).token === 'string') return stored as StreamBotCredential;
  return JSON.parse(await unsealFromSelf(session, stored as SealedBlob)) as StreamBotCredential;
}
