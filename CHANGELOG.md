# Changelog

## 0.1.0

Initial OctoVault scaffold — a Notion/Anytype-style, end-to-end-encrypted
knowledge app built on Starfish, extracted from OctoChat's "work" features and
rebuilt on the Starfish **WAL/CRDT** primitive.

### Added

- **Monorepo + Expo app** scaffolded from OctoChat: pnpm workspace
  (`nodeLinker: hoisted`), Expo SDK 56 universal app (`@octovault/mobile`), local
  Starfish sync server (`@octovault/server`), Electron shell (`@octovault/desktop`),
  shared `@octovault/tsconfig`. Theme system, UI primitives, and the Starfish
  client/crypto stack (BIP-39 → Ed25519/Kyber, per-space keyrings) carried over.
- **WAL/CRDT data layer** on `@drakkar.software/starfish-wal@3.0.0-alpha.21`:
  - `src/lib/starfish/wal/*` — live adapters wiring the package's injected
    `WalTransport` / `WalEncryptor` / `WalSigner` / `WalSnapshotStore` interfaces
    onto `StarfishClient` (`append` + `AppendLogCursor`), the space keyring
    encryptor, the device Ed25519 signer, and a sibling `__snapshot` LWW doc;
    plus a `createWalDocument` factory.
  - `src/lib/page-model.ts` — Notion-style pages as nested typed blocks (RGA
    `order` + per-block character-RGA text + LWW prop registers).
  - `src/lib/board-model.ts` — kanban boards (column/task RGA lists + per-task
    LWW registers), replacing the append-fold project log.
  - `src/lib/use-wal-doc.ts`, `use-page.ts`, `use-board.ts` — React hooks owning
    the WAL open→pull→commit lifecycle (the WAL counterpart of `use-merge-doc`).
  - `src/lib/wal.test.ts` — convergence tests: concurrent block/text edits and
    board task moves converge across two replicas; delegated sealing round-trips;
    a fresh reader cold-starts from a trusted snapshot.
- **Server collections** for the WAL documents: `pagelog`/`boardlog` (append-only
  `by_timestamp`, `requireAuthorSignature`, no TTL) + `pagesnap`/`boardsnap`
  (LWW snapshots), replacing OctoChat's `objdoc`/`objlog`.

### Notes / next

- The object **tree** index stays on the union-merge engine; WAL backs page/board
  **content**.
- v1 ships private (E2EE) spaces; public/plaintext WAL mirrors are deferred.
- **Workspace UI wired to WAL:** a Notion-style block editor (`PageView`) and kanban
  (`BoardView`) on `usePage`/`useBoard`; `page`/`board`/`folder` object types;
  `/work/page/[id]` + `/work/board/[id]` routes; the workspace surface
  (`WorkObjects`/`WorkEmpty`) creates + opens pages/boards; a Vault-first tab bar
  (chat hidden on web via `href: null`, behind Vault on native) with onboarding
  landing on the Vault. The old merge-doc/append-fold work code (DocView,
  ProjectBoard, use-doc, use-project, doc-block, project-board) was removed.
- **Desktop shell + chat excision:** the wide-screen `AppFrame` now renders a
  workspace `WorkspaceNav` (spaces rail + page/board tree) instead of the chat room
  sidebar; the inherited chat screens, components, libs, React contexts, automations
  and push subsystems were removed and the root layout slimmed to
  Session/Spaces/RoomsRegistry/Profile. OctoVault is a focused workspace app
  (typecheck clean; 116 tests pass).
- **Infra:** the `octovault` namespace is registered in the sync `server.py` as a
  REST sync router, reusing octochat's generic role enrichers/resolver
  (`apps/octovault/`).
- Remaining (minor): re-add live SSE for the workspace (the `room-events-bus` is
  retained but its events feeder was removed — focus-pull + polling cover live
  updates meanwhile); prune now-unused npm deps (firebase/notifee/notifications);
  optional public-space (plaintext) WAL page/board mirrors.
