/**
 * Re-exports the shared octospaces-sdk object-index helpers.
 *
 * The object index is now PLAINTEXT (encryption: 'none'). For `invite` nodes
 * the title/emoji are stripped before storage; the real values come from the
 * node's content doc.
 */
export {
  pushIndexSeed,
  seedSpaceObjectIndex,
  updateObjectIndex,
  readObjectTree,
} from '@drakkar.software/octospaces-sdk';
