# 🐙 OctoVault

**End-to-end-encrypted knowledge management with an editorial soul. Notes, pages, and boards — everything sealed, searchable, and yours alone.**

OctoVault is a Notion/Anytype-style app with a warm, editorial "Ink & Pearl" identity.
One codebase ships to **iOS, Android, web, and desktop** — and every page, document,
block and board is sealed with real end-to-end encryption before it ever leaves your
device. The server syncs ciphertext it can't read.

> [!NOTE]
> **OctoVault is a proof of concept.** It exists to show what you can build on
> top of [**Starfish**](https://github.com/Drakkar-Software/Starfish) — the
> end-to-end-encrypted sync engine that powers identities, capabilities,
> keyrings and live sync here. Treat it as a reference app and a demo, not a
> production-ready product (yet).

---

## ✨ Why OctoVault

- 🔒 **Real E2EE, not a checkbox.** Onboarding turns a BIP-39 seed phrase into
  Ed25519 + Kyber keys (kept in your device's secure storage). Every page, block,
  and board is sealed per-space with space keyrings. The backend only ever sees
  ciphertext.
- 📝 **Notion-grade editorial power.** Nested blocks with text, headings, lists,
  todos, code, callouts, quotes. Drag to reorder, nest infinitely. One editor for
  pages and one for boards — both built on a WAL/CRDT foundation for real live
  collaboration.
- 🎯 **Kanban boards out of the box.** Visual task organization with columns,
  drag-drop cards, and per-card properties. Built on the same WAL/CRDT primitives
  as pages, so sync is instant and conflict-free.
- 🌍 **Truly universal.** One Expo codebase → native iOS & Android, the web, and
  an Electron desktop app. No "mobile vs. web" fork.
- ⚡ **Live by default.** REST for sync, SSE for the firehose — changes, presence
  and activity stream in over a NATS-backed gateway.
- 🎨 **A theme with a point of view.** Editorial serif (Newsreader) + clean sans
  (Spline Sans), warm pearl paper, octopus-ink indigo accent. Light and dark,
  every constant from a single source.
- 🔑 **Multi-device, multi-account, no passwords.** Hold several spaces and
  switch live; pair a new device from your seed (passkeys gate sensitive
  enrollment), or sign in with a **NIP-07** Nostr extension.
- 📴 **Offline-first.** Pages and boards are served from a local pull cache, so
  the app opens and reads instantly even with no connection — an offline banner
  shows when you're disconnected.
- 🔍 **Instant full-text search.** Search across every page, block, board and
  document in your vault in real time — no indexing delays.

## 📚 What you can do

- **Spaces & folders** — organize knowledge by project, area, or topic. Public or
  private spaces with permission-scoped member keys.
- **Pages & nested blocks** — Notion-style pages with text, headings, lists, todos,
  code, callouts, quotes, toggles and more. Drag to reorder, nest as deep as you
  need. All edits sync live across devices.
- **Kanban boards** — visual task organization with columns and cards. Move cards
  between columns, add properties (assignee, status, due date), and filter by any
  property. Built on the same CRDT foundation as pages.
- **Inline objects** — mention pages, references to other documents, @-mentions to
  members. Cross-linking builds a knowledge graph in your vault.
- **Rich inline formatting** — **bold**, *italic*, `code`, ~~strikethrough~~,
  `links`, and more. Preserved end-to-end encrypted.
- **Local attachments** — images, files, and media embedded in pages and sealed
  client-side before upload. Every blob bound to its location so a hostile server
  can't swap or relocate.
- **Real-time collaboration** — multiple devices edit the same page simultaneously.
  Edits merge conflict-free via CRDT; full history preserved.
- **Mobile + desktop workflows** — capture quick notes on your phone, deep-work on
  desktop. One vault, all devices, always in sync.
- **Smart sync** — WAL (Write-Ahead Log) + CRDT foundation means even concurrent
  offline edits converge correctly when you reconnect, no merge conflicts.

## 🔒 Security & encryption

OctoVault is **end-to-end encrypted by design**: plaintext exists only on your
devices. The server is treated as untrusted infrastructure — it stores and
relays opaque ciphertext, and never holds a key that could open it.

- **Your seed is the master key.** A 12-word BIP-39 recovery phrase
  (128 bits of entropy) is stretched with **Argon2id** into your root identity:
  an **Ed25519** signing keypair and a **Kyber/ML-KEM** key-encapsulation
  keypair.
- **Per-space keyrings seal every document.** Each space has one keyring whose
  CEK seals all pages, blocks, and boards with **AEAD (AES-GCM)**.
- **Capabilities, not accounts.** Every request is signed by your device key and
  authorized against a scoped capability certificate (cap-cert).
- **Encrypted at rest, everywhere.** On native, keys live in the OS secure store.
  On web, seeds are never stored in cleartext — sealed under a random Vault Master
  Key, wrapped by a PIN and optionally a WebAuthn passkey.

> The full technical deep-dive is below in the
> [Encryption model](#encryption-model) section.

## 🚀 Quick start

```bash
pnpm install
pnpm infra:up   # NATS in Docker
pnpm dev        # backend: Starfish :8787 + Whistlers SSE :8080
pnpm web        # the app, in your browser at :8081
```

That's it — open `localhost:8081` and create your first vault.

> Want native or desktop instead of web? `pnpm ios` · `pnpm android` · `pnpm desktop`.

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

Contributions are welcome. Please open an issue first to discuss the change, or
read [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) for codebase guidelines.

## Support & questions

- **Bugs?** Open an issue.
- **Questions?** Reach out to `paul@drakkar.software`.

---

**Built with 🐙 by [Drakkar Software](https://drakkar.software).**
