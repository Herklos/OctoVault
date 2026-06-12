/**
 * Re-exports the shared octospaces-sdk device pairing implementation.
 *
 * Note: PAIR_PREFIX changed from 'octovault-pair:' to 'octospaces-pair:'.
 * Existing QR pairings will no longer be recognized — acceptable under the
 * dev-clean-break data migration.
 */
export {
  startDevicePairing,
  completeDevicePairing,
  PAIR_PREFIX,
} from '@drakkar.software/octospaces-sdk';
export type { PairResult } from '@drakkar.software/octospaces-sdk';
