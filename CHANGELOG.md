# Changelog

## 0.3.0 — "Everything is an ObjectType"

A complete unification of the content layer: pages, boards, tasks, files, images
and custom types all become first-class **Objects** backed by one generic engine.

### Architecture — generic object storage

- **Unified storage paths**: replaced type-specific `objects/pages/{id}` /
  `objects/boards/{id}` collections with a single family — `objects/logs/{id}`
  (append/WAL) + `objects/logs/{id}__snapshot`, `objects/docs/{id}` (merge),
  `objects/blobs/{id}` (raw bytes), `types/_index` (custom type registry). Updated
  the local Starfish server (`apps/server/src/config.ts`) and the Infra
  `drakkar_sync` Python mirror in lockstep.
- **Single object route**: collapsed `/work/page/[id]` and `/work/board/[id]` into
  one `/work/object/[id]`. The editor (`page`, `board`, `file`, `record`, `none`)
  is resolved at runtime from the `TypeRegistry` descriptor — no more route
  ternaries.
- **Generic content engine** (`object-content-model.ts`, `use-object-content.ts`):
  schema-driven ops over a `WalDocument`; `use-page`/`use-board` are now thin
  wrappers composing it with `page-content.ts`/`board-content.ts`.

### Features — Anytype-style object model

- **Files & images as first-class objects**: sealed-blob upload pipeline
  (`objects/blobs/{id}`), `FileObjectView` (download/share or inline image),
  `image`/`file` in-page ref-blocks insertable via `/` commands and `BlockTypeMenu`.
- **Board as a view over task-objects**: board content doc holds only column
  definitions; tasks are promoted to first-class objects (`parentId === boardId`,
  `type === 'task'`) projected by `task-model.ts`. Opening a task navigates to its
  object route as a mini-page + `TaskPropsStrip`.
- **User-defined types** (Phase G): a per-space `types/_index` union-merged doc
  stores `TypeDef`s (icon, label, color, field schema, editor kind). `makeRegistry`
  overlays custom types on built-ins. UI: `space/[id]/types/*` routes with
  `TypeList`, `TypeEditor`, `FieldEditor`, `IconPicker`, `ColorPicker`,
  `PropertyField`, and `PropertyPanel`. Custom-type objects degrade to the GENERIC
  editor rather than crashing.
- **Registry-driven create menus**: `creatableTypes()` from the live registry feeds
  a `CreateTypeMenu` at every "+" surface; hardcoded page/board markup removed.
- **De-typed UI**: `showsInWorkTree`, `isOpenableObjectType`, `isFindableType`
  predicates replace every `type==='page'||'board'` filter across the tree, Trash,
  quick-find and command palette.

### SDK extraction — `@drakkar.software/octovault-sdk`

All pure lib logic (crypto/identity, Starfish sync, WAL/CRDT models, domain types,
paths, object-types) lifted into `packages/sdk/src` as a headless, React-free
package (`@drakkar.software/octovault-sdk`). Metro resolves it from raw TypeScript
source via a custom alias in `metro.config.js`; the app imports all SDK symbols from
the single barrel.

### Bug fix — WAL open errors now surfaced

Pages (including brand-new ones) were silently un-editable: `transport.pull` threw
on the initial pull of a never-written log (404), `useWalDoc` swallowed the
rejection with no signal, and `useObjectContent` only plumbed `openError` from the
space open — leaving the editor disabled with no feedback.

- `transport.ts`: tolerate `404` on `cursor.pull()` (empty starting state for a new
  object); rethrow `403` and all other errors.
- `useWalDoc`: added `opening: boolean` + `openError: string | null` to
  `WalDocHandle`; the `.catch` now captures `String(e)` instead of discarding it.
- `useObjectContent`: merges WAL `opening`/`openError` with room-open state so the
  existing `PageView`/`BoardView` Callout and "Opening…" indicator react to WAL
  failures.

### Other

- **EAS Update wiring**: `expo-updates` wired to EAS Update with `appVersion`
  runtime policy; `eas.json` profiles for development/preview/production channels.
  Added AI and notification settings screens.
- Deep-link host updated to `vault.drakkar.software`; duplicate `app.json` entries
  fixed.
- Agents tab added to sidebar; DM spaces filtered from the workspace tree; profile
  button restricted to Vault and Agents tabs on mobile.
- Logo mark switched from inline SVG to `apps/mobile/assets/images/logo-512.png`.
- `@drakkar.software/starfish-*` bumped to `3.0.0-alpha.27` across all workspaces.

## 0.2.0 — "Ink & Pearl" design overhaul

A ground-up visual identity for OctoVault plus six workspace improvements.

### Identity

- **New "Ink & Pearl" theme** in `src/theme.ts`: a light-first, editorial
  knowledge-app look — warm pearl paper, near-black ink, a single octopus-ink
  indigo accent (`#5847c9`), and a flat document canvas (`editorCanvas`) that drops
  the old raised-card/depth metaphor for the editor surface.
- **New typography**: Newsreader (editorial serif — display & section titles) over
  Spline Sans (quiet grotesk body), with JetBrains Mono for labels/keys. Added a
  larger `pageTitle` type step for Notion-style hero titles.
- **Categorical color system**: an 8-color `swatches` set (gray → pink, each with
  `bg`/`text`/`border`/`solid`) + `swatch()` helper for tags, kanban accents and
  colored callouts. Added a `statusColor()` helper for the kanban lifecycle.
- Brand wordmark is now **OctoVault** (accent on "Vault"); onboarding copy reframed
  for a knowledge vault.

### Workspace

- **Shared object-index store** (`SpaceObjectsProvider`): one store per active space
  consumed by the sidebar, the Vault tab and the page/board detail routes — so a
  rename refreshes the tree, breadcrumb and header **instantly** (fixes stale names).
  Detail-route headers now show the live object name; `ObjectActions` no longer
  seeds a stale/empty title.
- **Folders** in the workspace tree: a "New folder" control, folders render as
  toggle-only containers (no content route), and a hover **+** on any row creates a
  child page inside it.
- **Inline title editing** on wide screens: click a page/board title to edit it in
  place at full `pageTitle` size — no bottom sheet (`TextField`/`AutosaveField` gained
  a `textVariant` prop; the kebab sheet remains for phones, emoji and archive).
- **Notion-style block editor** (`PageView`): the dashed bottom "Add block" button and
  the type-cycle chip are gone. New affordances — a left-gutter hover **+** that
  inserts a block below, a gutter **grip** that opens a `BlockTypeMenu` to change the
  type, click-the-empty-area-to-start-writing, a slash (`/`) command menu, and
  Markdown shortcuts (`# `, `- `, `[] `, `> `, ` ``` `…). Block presentation moved to
  `lib/blocks.ts`; the doc surface is now flat.
- **Space details page** (`app/space/[id]`): rename + image, members roster
  (private), invites (private cap / public read-only/read-write link) and a danger
  zone (leave). New `lib/use-space-details`/`use-space-members`/`use-space-invite`
  hooks and `registry.leaveSpace`/`removeSpaceMember` helpers surface the invite/rename
  capabilities that previously had no UI. Reachable from the sidebar header and a
  Vault-tab gear.

### Fixes & housekeeping

- Fixed a web hydration error from nested `<button>`s in the object tree (tree rows
  no longer nest the disclosure/add controls inside the row button).
- **Full rebrand to the OctoVault name** across every user-facing string, comment,
  log tag, storage namespace, the passkey relying-party name, the Electron bridge and
  docs. Reset `apps/mobile/CLAUDE.md` to describe the knowledge app.

## 0.1.0 — Initial scaffold

A Notion/Anytype-style, end-to-end-encrypted knowledge app built on Starfish and
the **WAL/CRDT** primitive.

### Added

- **Monorepo + Expo app**: pnpm workspace (`nodeLinker: hoisted`), Expo SDK 56
  universal app (`@octovault/mobile`), local Starfish sync server
  (`@octovault/server`), Electron shell (`@octovault/desktop`), shared
  `@octovault/tsconfig`. Theme system, UI primitives, and the Starfish client/crypto
  stack (BIP-39 → Ed25519/Kyber, per-space keyrings).
- **WAL/CRDT data layer** on `@drakkar.software/starfish-wal@3.0.0-alpha.21`:
  - `src/lib/starfish/wal/*` — live adapters wiring the package's injected
    `WalTransport` / `WalEncryptor` / `WalSigner` / `WalSnapshotStore` interfaces
    onto `StarfishClient` (`append` + `AppendLogCursor`), the space keyring
    encryptor, the device Ed25519 signer, and a sibling `__snapshot` LWW doc; plus a
    `createWalDocument` factory.
  - `src/lib/page-model.ts` — Notion-style pages as nested typed blocks (RGA `order`
    + per-block character-RGA text + LWW prop registers).
  - `src/lib/board-model.ts` — kanban boards (column/task RGA lists + per-task LWW
    registers).
  - `src/lib/use-wal-doc.ts`, `use-page.ts`, `use-board.ts` — hooks owning the WAL
    open→pull→commit lifecycle.
  - `src/lib/wal.test.ts` — convergence tests across two replicas, delegated sealing
    round-trips, and cold-start from a trusted snapshot.
- **Server collections** for the WAL documents: `pagelog`/`boardlog` (append-only,
  signed, no TTL) + `pagesnap`/`boardsnap` (LWW snapshots).

### Notes

- The object **tree** index uses the union-merge engine; WAL backs page/board
  **content**.
- v1 ships private (E2EE) spaces; public/plaintext WAL mirrors are deferred.
