/**
 * Public-space access shims — NO-OPS.
 *
 * The pubspace subsystem has been removed in favour of per-node access:'public'.
 * These shims preserve the old API surface so existing callers compile while
 * being gradually migrated away to `getSpaceAccessEntry`/`saveSpaceAccessEntry`
 * (for link-based joins) or removed entirely.
 *
 * @deprecated All exports in this file are no-ops and should be removed.
 */

export interface PubspaceAccess {
  ownerId: string;
  cap: unknown;
  key: string;
  write: boolean;
}

export type AccessMap = Record<string, PubspaceAccess>;

/** @deprecated No-op — pubspace subsystem removed. */
export async function hydratePubspaceCaps(_userId: string): Promise<void> { /* no-op */ }

/** @deprecated No-op — pubspace subsystem removed. */
export function mergePubspaceAccess(_entries: AccessMap): void { /* no-op */ }

/** @deprecated Returns empty object — pubspace subsystem removed. */
export function localPubspaceEntries(): AccessMap { return {}; }

/** @deprecated Returns null — pubspace subsystem removed. */
export function getPubspaceAccess(_spaceId: string): PubspaceAccess | null { return null; }

/** @deprecated No-op — pubspace subsystem removed. */
export function savePubspaceAccess(_spaceId: string, _access: PubspaceAccess): void { /* no-op */ }

/** @deprecated No-op — pubspace subsystem removed. */
export function removePubspaceAccess(_spaceId: string): void { /* no-op */ }

/** @deprecated No-op — pubspace subsystem removed. */
export function clearPubspaceCaps(): void { /* no-op */ }
