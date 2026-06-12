/**
 * Per-identity AI feature preferences, persisted to the platform KV store
 * (localStorage on web, AsyncStorage on native). Kept as a module-level snapshot
 * so React consumers subscribe via {@link AiSettingsProvider}
 * (`useSyncExternalStore`).
 *
 * Today the only setting is the master enable toggle — model-management and
 * specific feature flags land alongside the Agents/AI backend in a later pass.
 */
import { kvGet, kvSet } from './config/kv';

export interface AiSettings {
  /** Master switch for AI agents & suggestions. Off by default until the user
   *  explicitly opts in — respects that on-device model availability is unknown
   *  at first launch. */
  enabled: boolean;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: false,
};

const settingsKey = (userId: string) => `octovault.ai.${userId}`;

let snapshot: AiSettings = DEFAULT_AI_SETTINGS;
const listeners = new Set<() => void>();

/** The live settings — synchronous read. */
export function getAiSettings(): AiSettings {
  return snapshot;
}

/** Subscribe to snapshot changes (drives `useSyncExternalStore`). */
export function subscribeAiSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Replace the live snapshot and notify React consumers. */
export function setAiSettings(next: AiSettings): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Reset to defaults on sign-out so a fresh session never inherits the prior one's. */
export function resetAiSettings(): void {
  setAiSettings(DEFAULT_AI_SETTINGS);
}

/** Tolerant parse: any missing/garbage field falls back to its default. */
function coerce(raw: unknown): AiSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_AI_SETTINGS;
  const r = raw as Partial<Record<keyof AiSettings, unknown>>;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_AI_SETTINGS.enabled,
  };
}

/** Read this identity's persisted settings (does NOT mutate the snapshot). */
export async function loadAiSettings(userId: string): Promise<AiSettings> {
  const raw = await kvGet(settingsKey(userId));
  if (!raw) return DEFAULT_AI_SETTINGS;
  try {
    return coerce(JSON.parse(raw));
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

/** Merge a patch into the live snapshot and persist it for the identity. */
export async function saveAiSettings(
  userId: string,
  patch: Partial<AiSettings>,
): Promise<void> {
  const next = { ...snapshot, ...patch };
  setAiSettings(next);
  await kvSet(settingsKey(userId), JSON.stringify(next));
}
