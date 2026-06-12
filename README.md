<div align="center">
  <img src="logo.png" alt="OctoVault" width="200" />
</div>

# OctoVault

**Encrypted knowledge at vault-speed.** Pages, boards, search — all sealed end-to-end. One codebase. iOS, Android, web, desktop. Built on [**Starfish**](https://github.com/Drakkar-Software/Starfish).

> [!NOTE]
> **Reference app & proof of concept** — shows what real E2EE sync can do. Not production-ready (yet).

---

## Core features

**🔒 Real E2EE** — BIP-39 seed → Ed25519 + Kyber keys in secure storage. Pages, blocks, boards sealed per-space. Server sees ciphertext only.

**📝 Notion-grade editing** — Nested blocks (text, headings, lists, todos, code, callouts). Drag to reorder. CRDT-backed live collaboration, conflict-free.

**🎯 Kanban + boards** — Columns, drag-drop cards, properties (assignee, status, due date). Same CRDT foundation as pages. Instant sync.

**🌍 One codebase, all platforms** — Expo SDK 56 → iOS, Android, web, Electron. No "mobile vs. web" fork.

**⚡ Live by default** — REST pull + SSE firehose. Presence, activity, changes streamed via NATS.

**🎨 Design-forward** — Newsreader (editorial serif) + Spline Sans (clean body). Warm pearl, octopus-ink indigo. Light & dark, one source of truth.

**🔑 No passwords** — Seed-based. Multi-device pairing via QR + PIN. NIP-07 Nostr sign-in. Hold multiple spaces, switch live.

**📴 Offline-first** — Pages & boards served from local cache. App opens & reads instantly, no connection needed.

**🔍 Instant search** — Full-text across pages, blocks, boards, documents. Real-time, no indexing lag.

## What you build with it

**Spaces & folders** — organize by project, area, topic. Public/private with member key scopes.

**Pages** — Notion-style nested blocks. Text, headings, lists, todos, code, callouts, quotes. Drag to reorder, nest infinitely. Live sync across devices.

**Boards** — Kanban columns + cards. Drag between columns, add properties, filter. CRDT foundation = instant conflict-free sync.

**Cross-linking** — Mention pages, reference documents, @-mention members. Builds a knowledge graph inside your vault.

**Rich formatting** — **bold**, *italic*, `code`, ~~strikethrough~~, links. All encrypted end-to-end.

**Attachments** — Images, files, media embedded & sealed client-side before upload. Storage path bound into the seal's AAD — no hostile swaps.

**Real-time collab** — Multiple devices edit the same page. Edits merge conflict-free. Full history preserved.

**Offline + sync** — WAL/CRDT means concurrent offline edits converge correctly when you reconnect. No merge conflicts.

## 🔒 Encryption by design

Plaintext lives on your devices only. The server is untrusted — stores & relays opaque ciphertext, never holds a key.

**Your seed is everything** — 12-word BIP-39 (128 bits entropy) stretched via Argon2id into your root identity: Ed25519 signing key + Kyber/ML-KEM key-encapsulation pair.

**Per-space keyrings** — Each space has one keyring whose CEK seals all pages, blocks, boards via AEAD (AES-GCM).

**Capabilities, not accounts** — Every request signed by your device key & authorized via scoped cap-cert. No server-side passwords or sessions.

**Sealed at rest everywhere** — Native: keys in OS secure store. Web: seeds sealed under random Vault Master Key, wrapped by PIN + optional WebAuthn passkey.

> Full technical model: [Encryption model](#encryption-model) section below.

## ⚡ Get started in 4 commands

```bash
pnpm install
pnpm infra:up          # NATS in Docker
pnpm dev               # Starfish :8787 + Whistlers SSE :8080
pnpm web               # App at localhost:8081
```

Create your first vault. Done.

**Native?** `pnpm ios` · `pnpm android` · `pnpm desktop`

---

# 🛠️ Developer guide

Everything below is the nuts-and-bolts reference: prerequisites, the full dev
loop, ports, commands and project layout.

## Prerequisites

- **Node.js** ≥ 20 (tested on 24)
- **pnpm** 10 — `npm i -g pnpm`
- **Docker** (or OrbStack) — for NATS

## Install

```
pnpm install
```

## Dev setup

Three services need to run. Open two terminals:

**Terminal 1 — infrastructure + backend**

```
pnpm infra:up   # start NATS in Docker (detached)
pnpm dev        # Starfish server :8787 + Whistlers SSE :8080
```

**Terminal 2 — frontend**

```
pnpm web        # Expo web :8081
# or
pnpm ios        # Expo iOS simulator
pnpm android    # Expo Android emulator
pnpm desktop    # Electron wrapper
```

> **Whistlers restart.** `pnpm dev` starts Whistlers once — it does not watch
> for config changes. If you edit `infra/whistlers.config.json` or bump the
> `@drakkar.software/whistlers` package, kill and re-run `pnpm dev`.

## Ports

| Service | Port | What |
|---|---|---|
| Expo / Metro | 8081 | Mobile/web app (dev) |
| Starfish server | 8787 | Sync API + `/events` SSE proxy |
| Whistlers | 8080 | Internal NATS→SSE gateway |
| NATS | 4222 | Message bus (Docker) |

## All commands

| Command | What |
|---|---|
| `pnpm infra:up` | Start NATS (Docker, detached) |
| `pnpm infra:down` | Stop all Docker services |
| `pnpm dev` | Starfish server + Whistlers (concurrently) |
| `pnpm web` | Expo web |
| `pnpm ios` | Expo iOS |
| `pnpm android` | Expo Android |
| `pnpm desktop` | Electron wrapper |
| `pnpm typecheck` | TypeScript check all workspaces |
| `pnpm test` | Run tests |

## Structure

```
apps/
  mobile/    — Expo SDK 56 universal app (@octovault/mobile)
  server/    — Hono Starfish server (@octovault/server)
  desktop/   — Electron wrapper (optional)
packages/
  tsconfig/  — shared TypeScript base config
```

## Architecture

The app is built on Starfish, a **WAL/CRDT** sync engine:

- **Pages & blocks** (`src/lib/page-model.ts`) are pure projections over a
  `WalDocument` — an RGA (Replicated Growable Array) for block order, per-block
  char-RGA for text, and LWW (Last-Writer-Wins) registers for properties.
  All edits are CRDT ops; they merge conflict-free even if concurrent.
- **Boards** (`src/lib/board-model.ts`) use RGA lists for columns and cards,
  with per-card LWW registers for properties.
- **Live sync** happens via REST pull + SSE firehose: a `/pull` fetches the
  WAL op-log since your last cursor, and `/events` streams new ops in real time.
- **The object tree** (`src/lib/use-objects`) stays on Starfish's proven
  union-merge engine (spaces, pages, folders); WAL backs **page and board
  content only**.
- **Crypto** is injected into Starfish's transport, signer, and encryptor
  interfaces (`src/lib/starfish/wal/*`).

### Key files

- `src/lib/starfish/wal/` — live wiring of `starfish-wal`: transport, encryptor,
  signer, snapshot store.
- `src/lib/page-model.ts` / `board-model.ts` — pure CRDT projections + mutations.
- `src/lib/use-page.ts` / `use-board.ts` — React hooks owning the open→pull→commit
  lifecycle.
- `src/components/work/PageView.tsx` / `BoardView.tsx` — the editors.
- `src/theme.ts` — design tokens (single source of truth).

See [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) for full design rules and conventions.

## Encryption model

The full encrypted sync layer lives in the Starfish SDK; the app supplies only
platform adapters under `src/lib/starfish/*`. Threat model: the server and transport
are **untrusted** — they see ciphertext, signed request envelopes and capability
scopes, never plaintext or private keys.

### Identity & keys

- A 12-word **BIP-39** mnemonic (128-bit entropy) is the only master secret.
- Each device holds an **Ed25519** keypair (request signing) and a **Kyber/ML-KEM**
  keypair (key encapsulation for space keyring recipients).

### Authorization: capability certificates

- No server-side passwords or sessions. Every request is signed by the device
  Ed25519 key.
- Access is gated by **scoped cap-certs**: a device cap and a **member cap** per
  joined space. The server authorizes a request only if a presented cap proves the
  scope.

### Document & attachment sealing

- One **keyring per space** covers every page and board. Its CEK seals all
  content with **AEAD (AES-GCM)** before it leaves the client.
- Attachments are stored as opaque blobs; pages keep only small references. The
  blob's storage path is bound into the seal's **AAD**.
- **Key rotation / epochs:** inviting a member rotates the keyring epoch. Members
  see content from their epoch forward.

### Device pairing

- The existing device seals the bundle with the user **PIN** (Argon2id → AES-GCM),
  and publishes it to a public rendezvous keyed by a 16-byte CSPRNG nonce.
- The QR payload is `nonce.rootEdPub`. The new device opens the blob with the PIN
  and pins the bundle to the QR-supplied root pubkey.

### At-rest storage

- **Native:** keys persist in `expo-secure-store` (Keychain / Keystore).
- **Web:** `localStorage` holds only an AEAD envelope. All accounts live in one
  `Vault` sealed under a random **Vault Master Key (VMK)** via AES-GCM; the VMK is
  wrapped by the PIN (Argon2id-stretched) and optionally a **WebAuthn passkey** PRF
  secret.

---

## Licensing

OctoVault is **MIT-licensed**. Starfish and supporting infrastructure are
licensed separately — refer to their repositories for terms.

## Contributing

Contributions welcome. Open an issue first to discuss, or read [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) for guidelines.

## Questions? Bugs?

- 🐛 [Open an issue](https://github.com/Drakkar-Software/OctoVault/issues)
- 💬 `paul@drakkar.software`

---

**Built with 🐙 by [Drakkar Software](https://drakkar.software).**
