# OctoVault

A universal (web + native) **Expo** app for an end-to-end-encrypted,
**Notion/Anytype-style** knowledge workspace — pages of nested blocks and kanban
boards — built on **Starfish** and its **WAL/CRDT** document primitive.

OctoVault was extracted from [OctoVault](https://github.com/drakkar-software/octovault)'s
"work" features and rebuilt so each page/board is a CRDT op-log
(`@drakkar.software/starfish-wal`): concurrent and offline edits converge with
full history, and a trusted snapshot gives fast cold-start. It reuses OctoVault's
Expo/monorepo setup, Starfish client + crypto stack (BIP-39 → Ed25519/Kyber,
per-space keyrings), theme system and UI primitives.

## Quick start

```bash
pnpm install
docker compose up -d nats     # local NATS for SSE live events (optional)
pnpm dev                      # local Starfish sync server + whistlers SSE bridge
pnpm web                      # run the app (web); pnpm ios / pnpm android for native
```

Point the app at a server with `EXPO_PUBLIC_STARFISH_URL` (default
`http://localhost:8787`).

## Layout

| Path | What |
|---|---|
| `apps/mobile` | Expo SDK 56 universal app (`@octovault/mobile`) |
| `apps/server` | Local Starfish sync server (`@octovault/server`) |
| `apps/desktop` | Electron shell over the Expo web build |
| `packages/tsconfig` | Shared TypeScript config |

## Architecture

- **Data layer** — `src/lib/starfish/wal/*` wires `starfish-wal`'s injected
  transport/encryptor/signer/snapshot interfaces onto the live Starfish client +
  space keyring + device key. `page-model.ts` / `board-model.ts` are pure
  projections + mutations over a `WalDocument`; `use-page` / `use-board` are the
  React hooks. See [`CLAUDE.md`](CLAUDE.md).
- **Tree** — the space object index (pages, boards, folders) stays union-merged
  (`use-objects`, `objindex`); WAL backs page/board content.

## Develop & test

```bash
pnpm typecheck
pnpm test            # includes src/lib/wal.test.ts (WAL convergence)
```

See [`CHANGELOG.md`](CHANGELOG.md) for status and what's next.
