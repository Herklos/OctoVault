/**
 * Re-exports the shared octospaces-sdk object-tree model.
 *
 * Changes from the old vault objects.ts:
 *  - `ObjectNode.automation` / `.props` moved to `node.meta.automation` / `node.meta.props`.
 *    Use the vault-specific helpers in `objects-ext.ts`: `propsOf(node)`, `automationOf(node)`,
 *    `setProps(...)`, `clearProp(...)`, `addVaultObject(...)`.
 *  - `NewObjectInput` no longer has `automation` or `props` — pass them via `meta`.
 *  - `patchObject` no longer accepts `automation` — patch `meta` directly.
 *  - `addObject` now accepts `access` / `enc` / `meta` fields.
 */
export {
  buildTree,
  breadcrumbs,
  ancestors,
  subtreeIds,
  nextOrder,
  addObject,
  patchObject,
  reparentObject,
  reorderObjects,
  archiveObject,
} from '@drakkar.software/octospaces-sdk';
export type { ObjectTreeNode, NewObjectInput } from '@drakkar.software/octospaces-sdk';
