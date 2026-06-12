/**
 * Re-exports the shared octospaces-sdk pull cache (backed by the platform KV store).
 *
 * Note: cache key prefix changed from 'octovault.pullcache.' to the octospaces
 * default. Acceptable under the dev-clean-break data migration.
 */
export { pullCache, PULL_CACHE_MAX_AGE_MS } from '@drakkar.software/octospaces-sdk';
