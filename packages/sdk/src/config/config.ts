/**
 * OctoVault SDK — sync server configuration.
 *
 * The SDK is platform-agnostic and never reads `process.env` directly.
 * At boot, the app calls {@link configureOctoVault} with the env-derived values;
 * all SDK modules call the getter functions below instead of importing the env vars.
 *
 * Mirror of OctoChat's `configureOctoChat` / `getSyncBase` DI pattern.
 */

interface OctoVaultConfig {
  syncBase: string;
  syncNamespace: string | undefined;
  syncPrefix: string;
  eventsUrl: string;
  webBase: string;
}

let _config: OctoVaultConfig = {
  syncBase: 'http://localhost:8787',
  syncNamespace: undefined,
  syncPrefix: '',
  eventsUrl: 'http://localhost:8787/events',
  webBase: '',
};

/**
 * Configure the SDK with the sync server's coordinates. Call once at app boot
 * (before any other SDK function), passing the env-derived values.
 */
export function configureOctoVault(config: Partial<OctoVaultConfig>): void {
  _config = { ..._config, ...config };
}

/** Base URL of the Starfish sync server, e.g. `https://sync.example.com`. */
export function getSyncBase(): string {
  return _config.syncBase;
}

/** Starfish namespace name (undefined for a root-mounted local dev server). */
export function getSyncNamespace(): string | undefined {
  return _config.syncNamespace;
}

/**
 * Namespaced path prefix (`/v1/<namespace>`, or '') for raw requests that live
 * outside the StarfishClient (SSE `GET /events`, raw profile GET).
 */
export function getSyncPrefix(): string {
  return _config.syncPrefix;
}

/** SSE event endpoint URL. */
export function getEventsUrl(): string {
  return _config.eventsUrl;
}

/** Public origin of the web app, for invite link generation. */
export function getWebBase(): string {
  return _config.webBase;
}
