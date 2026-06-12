/**
 * Re-exports the shared octospaces-sdk account-seal implementation.
 */
export {
  sealToSelf,
  unsealFromSelf,
  sealToRecipient,
  unsealFromRecipient,
} from '@drakkar.software/octospaces-sdk';
export type { SealedBlob } from '@drakkar.software/octospaces-sdk';
