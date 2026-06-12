// @drakkar.software/octovault-sdk
// Pure, React-free logic for OctoVault: crypto/identity, Starfish sync, WAL/CRDT
// document models, data registries, pure helpers.

// ── Config / DI seams ─────────────────────────────────────────────────────────
export * from './config/config';
export * from './config/kv';

// ── Domain types ──────────────────────────────────────────────────────────────
export type { IconName } from './domain/icon-name';
export type { TextVariant } from './domain/text-variant';
export * from './domain/types';
// domain/object-types: re-export everything EXCEPT PropKind/EditorKind which
// conflict with the same names in starfish/object-types-store. Consumers that
// need both can import directly from the sub-modules.
export type {
  PropKind, EditorKind,
  PropOption, PropField, TypeDescriptor, ObjectDescriptor, CreatableTypeEntry, TypeRegistry,
} from './domain/object-types';
export {
  objectDescriptor, iconForNode, isContainerType, showsInWorkTree,
  isOpenableObjectType, isFindableType, contentKindOf, creatableTypes,
  defaultProps, makeRegistry, BUILTIN_REGISTRY, routeForNode, objectLink,
} from './domain/object-types';
export * from './domain/ids';
export * from './domain/errors';

// ── Format helpers ────────────────────────────────────────────────────────────
export * from './format/format';
export * from './format/emoji';
export * from './format/relative-time';

// ── Search / misc ─────────────────────────────────────────────────────────────
export * from './search-match';
export * from './legal';

// ── User-preferences ─────────────────────────────────────────────────────────
export * from './mutes';
export * from './reads';
export * from './quick-reactions-settings';
export * from './ai-settings';

// ── Starfish in-memory state ──────────────────────────────────────────────────
export * from './spaces-prime';
export * from './invite-preview';
export * from './live-sync-bus';

// ── Blocks (editor vocabulary) ────────────────────────────────────────────────
export * from './blocks';

// ── Content models (WAL/CRDT) ─────────────────────────────────────────────────
export * from './object-content-model';
export * from './page-content';
export * from './board-content';
export * from './task-model';

// ── Starfish sync layer ───────────────────────────────────────────────────────
export * from './starfish/client';
export * from './starfish/identity';
export * from './starfish/pairing';
export * from './starfish/space-encryptor';
export * from './starfish/members';
export * from './starfish/member-caps';
export * from './starfish/object-index';
export * from './starfish/registry';

// Objects / object tree
export * from './starfish/objects';

// User-defined types store — re-export PropKind/EditorKind under aliases to avoid
// shadowing the same names in domain/object-types (both unions are identical, but
// TypeScript requires exactly one name per barrel entry).
export type {
  ContentKind,
  SelectOption,
  FieldDef,
  TypeDef,
  TypesDoc,
} from './starfish/object-types-store';
export type {
  PropKind as StoresPropKind,
  EditorKind as StoresEditorKind,
} from './starfish/object-types-store';
export {
  EMPTY_TYPES_DOC,
  addType, patchType,
  addField, patchField, removeField, reorderFields,
  archiveType,
} from './starfish/object-types-store';

// Blob uploads
export * from './starfish/object-blobs';

// Public spaces
export * from './starfish/pubspace';
export * from './starfish/pubspace-caps';

// Attachments / crypto helpers
export * from './starfish/attachments';
export * from './starfish/account-seal';
export * from './starfish/base64';
export * from './starfish/fetch-timeout';

// Paths / scopes
export * from './starfish/paths';

// Session / cache
export * from './starfish/session-restore';
export * from './starfish/profile-cache';
export * from './starfish/pull-cache';

// Stream bots
export * from './starfish/stream-bots';

// WAL document factory
export * from './starfish/wal/index';

// Storage types (platform-agnostic; implementations live in ./platform)
export type {
  DerivedIdentity, PersistedSession, Vault, UnlockMethod,
  PasskeyEnrollment, SeedLock, VaultLoad,
} from './starfish/storage-types';
