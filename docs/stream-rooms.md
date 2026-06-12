# Automation nodes & bot integrations

> **Migration note:** Stream rooms (`type:'room', subtype:'stream'`) were removed in
> the octospaces-sdk migration. Bot/feed integrations now use `type:'automation'`
> ObjectNodes with config stored in `node.meta.automation`. See below.

An **automation node** is an ObjectNode (`type: 'automation'`) whose WAL op-log
receives signed append operations from an external process (bot, webhook, CI job,
sensor) with **no pull → merge → push** cycle. Posting is a single authenticated
`append` to the `objlog` collection — the only difference from a regular page is
that the author is a bot identity rather than an interactive user.

- **Type:** `type: 'automation'` (a first-class ObjectNode type, not a room subtype).
- **Config:** stored in `node.meta.automation` (an `AutomationMeta` object):
  - `providerId` — FK into the built-in provider catalog (`'rss'`, `'http'`, …).
  - `params` — non-secret provider params (URLs, locations, etc.).
  - `intervalMin` — scheduled-fetch cadence in minutes; `0` = commands-only.
  - `onOpen` — fire on every room open / background check, bypassing the timer.
  - `enabled` — off → ticker skips, `onCommand` ignores; the node still renders.
  - `credential` — bot write credential SEALED to the minting account key.
  - `runOnDeviceId` — the elected device id for this automation.
  - `lastRunAt` / `lastFetchHash` / `lastError` — execution state.
- **Encryption follows the node** — set `enc: true` on the ObjectNode to seal the
  log with the space keyring; `enc: false` (default) for plaintext automation feeds.
- **Access follows the node** — `access: 'space'` (default), `'invite'`, or `'public'`
  on the ObjectNode.

The storage contract for automation content is the same as any page:

| Collection | Storage path | Enc. | Read / Write roles |
|---|---|---|---|
| `objlog` | `spaces/{spaceId}/objects/logs/{objectId}` | `delegated` (if enc) | `space:member` / `space:member` |
| `objsnap` | `spaces/{spaceId}/objects/logs/{objectId}__snapshot` | `none` | `space:member` / `space:member` |

Both are queued to `octovault.object.changed.<spaceId>`, so an append fires the
same per-space SSE notification a page write does — viewers see bot posts live.

## The element format (what the app renders)

An automation log carries the same tagged envelope as a regular page WAL log:

```jsonc
// t = 'msg' | 'reaction' | 'edit';  e = the payload
{ "t": "msg",      "e": { "id": "…", "authorId": "<hex userId>", "ts": 1716, "text": "Build #42 passed ✅" } }
{ "t": "reaction", "e": { "id": "…", "msgId": "…", "emoji": "🎉", "userId": "…", "kind": "add", "ts": 1716 } }
{ "t": "edit",     "e": { "id": "…", "msgId": "…", "userId": "…", "kind": "edit", "text": "…", "ts": 1716 } }
```

A bot that only posts messages sends `{ t: 'msg', e: { … } }`. `authorId` is the
display author; set it to the bot's own user id (`sha256(edPub)[:32]`, hex).

The server wraps each append as `{ ts, data }`; for E2EE nodes `data` is the sealed
envelope; for plaintext nodes it is the envelope verbatim.

## Bot credentials

Use `openStreamBotCredential` (`packages/sdk/src/starfish/stream-bots.ts`) to unseal
an existing automation node's bot write credential. The credential is a Starfish
member cap sealed to the minting account key, recovered on any device with the same
seed.

Creating new bot credentials (`createStreamBotCredential`) has been removed along
with the public-stream / audience-cap model. New automation integrations should use
`inviteToSpace` or `inviteToNode` to mint a scoped member cap and seal it with
`sealToSelf` before storing it in `node.meta.automation.credential`.

## Creating an automation node

```ts
import { createNode } from '@drakkar.software/octospaces-sdk';
import { sealToSelf } from '@drakkar.software/octospaces-sdk';

// 1. Mint a bot identity (or reuse an existing device key)
const botKeys = await generateDeviceKeys();
const botUserId = userIdFromEdPub(botKeys.edPub);

// 2. Mint a member cap scoped to the space (so the bot can append to objlog)
const { cap } = await inviteToSpace(session, spaceId, botUserId);

// 3. Seal the credential to your own account key
const credential = await sealToSelf(session.keys, JSON.stringify({ cap, botKeys }));

// 4. Create the automation node
await createNode(session, spaceId, {
  type: 'automation',
  title: 'RSS Feed',
  access: 'space',
  enc: false,
  meta: {
    automation: {
      providerId: 'rss',
      params: { url: 'https://example.com/feed.xml' },
      intervalMin: 30,
      enabled: true,
      credential,
      runOnDeviceId: session.deviceId,
      lastRunAt: null,
      lastError: null,
    },
  },
});
```
