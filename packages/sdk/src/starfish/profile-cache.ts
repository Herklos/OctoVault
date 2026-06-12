/**
 * Re-exports the shared octospaces-sdk profile cache (backed by the platform KV store).
 *
 * Note: cache key prefix changed from 'octovault.profile.v1.' to
 * 'octospaces.profile.v1.'. Acceptable under the dev-clean-break data migration.
 */
export { cacheProfile, loadCachedProfile } from '@drakkar.software/octospaces-sdk';
