/**
 * `WalSnapshotStore` over a regular LWW document at `<documentKey>__snapshot`.
 *
 * The snapshot is a normal (non-append) collection: we pull the current doc
 * (caching its `hash` for the next conflict-checked push) and push the
 * WAL-produced {@link WalSnapshotDoc} verbatim — it already carries its own
 * `producedBy` + author signature for the reader to verify.
 */
import type { StarfishClient } from '@drakkar.software/starfish-client';
import type { WalSnapshotDoc, WalSnapshotStore } from '@drakkar.software/starfish-wal';

export function createWalSnapshotStore(client: StarfishClient): WalSnapshotStore {
  const hashes = new Map<string, string | null>();
  return {
    async read(snapshotKey) {
      const res = await client.pull(`/pull/${snapshotKey}`).catch(() => null);
      hashes.set(snapshotKey, res?.hash ?? null);
      const data = res?.data as Partial<WalSnapshotDoc> | undefined;
      if (!data || typeof data.uptoTs !== 'number' || !data.state) return null;
      return data as WalSnapshotDoc;
    },
    async write(snapshotKey, doc) {
      // Refresh the baseHash right before the LWW push so a concurrent snapshot
      // from another writer doesn't 409 us; snapshots are infrequent so the extra
      // round-trip is cheap.
      let base = hashes.get(snapshotKey) ?? null;
      try {
        const cur = await client.pull(`/pull/${snapshotKey}`);
        base = cur.hash ?? null;
      } catch {
        base = base ?? null;
      }
      const res = await client.push(
        `/push/${snapshotKey}`,
        doc as unknown as Record<string, unknown>,
        base,
      );
      hashes.set(snapshotKey, res.hash ?? null);
    },
  };
}
