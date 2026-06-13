import type { NatsConnection } from "@nats-io/transport-node";

interface Store {
  getString(key: string): Promise<string | null>;
  put(key: string, body: string): Promise<void>;
}

interface ObjectNode {
  id: string;
  access?: string;
  [key: string]: unknown;
}

/**
 * Subscribes to all space-change events and maintains a world-readable `_pubdir`
 * doc for each space — a filtered snapshot of the plaintext object index containing
 * only nodes with `access: 'public'`. Anonymous clients read this to discover public
 * content without needing a member cap.
 *
 * Writes bypass role gating (server-trusted store.put), so the `pubdir` collection
 * carries `writeRoles: []` (no client writes). Runs as a background async loop; any
 * per-space error is logged and skipped without killing the subscriber.
 */
export function createPubdirProjection(store: Store, nc: NatsConnection | null): void {
  if (!nc) return;

  const sub = nc.subscribe("octovault.object.changed.>");
  void (async () => {
    for await (const msg of sub) {
      let spaceId: string | undefined;
      try {
        const payload = JSON.parse(new TextDecoder().decode(msg.data)) as {
          params?: { spaceId?: string };
        };
        spaceId = payload.params?.spaceId;
      } catch {
        continue;
      }
      if (!spaceId) continue;
      try {
        const raw = await store.getString(`spaces/${spaceId}/objects/_index`);
        if (!raw) continue;
        const index = JSON.parse(raw) as { objects?: ObjectNode[] };
        const publicNodes = (index.objects ?? []).filter((n) => n.access === "public");
        await store.put(
          `spaces/${spaceId}/objects/_pubdir`,
          JSON.stringify({ v: 1, objects: publicNodes, updatedAt: Date.now() }),
        );
      } catch (e) {
        console.error(`[pubdir] rebuild failed for space ${spaceId}:`, e);
      }
    }
  })();
}
