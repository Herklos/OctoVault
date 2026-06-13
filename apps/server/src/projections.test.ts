import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPubdirProjection } from "./projections.js";

// Minimal store double.
function makeStore(indexJson: string | null = null) {
  return {
    data: new Map<string, string>(),
    getString: vi.fn(async (key: string) => {
      if (key.endsWith("objects/_index")) return indexJson;
      return null;
    }),
    put: vi.fn(async (key: string, body: string) => {
      // just record what was written
    }),
  };
}

// Minimal NATS double: a subscription that lets us push messages manually.
function makeNc() {
  let handler: ((msg: { data: Uint8Array }) => void) | null = null;
  return {
    nc: {
      subscribe: vi.fn((_subject: string) => {
        // Return an async-iterable controlled by the test.
        let resolve: (value: IteratorResult<{ data: Uint8Array }>) => void;
        const queue: { data: Uint8Array }[] = [];
        let waiting = false;
        return {
          [Symbol.asyncIterator]() {
            return {
              next: () =>
                new Promise<IteratorResult<{ data: Uint8Array }>>((res) => {
                  if (queue.length > 0) {
                    res({ value: queue.shift()!, done: false });
                  } else {
                    waiting = true;
                    resolve = res;
                  }
                }),
            };
          },
        };
      }),
    },
    /** Push a fake NATS message to the subscription. */
    push(params: Record<string, unknown>) {
      // Get the iterable returned by subscribe.
      handler?.({ data: new TextEncoder().encode(JSON.stringify({ params })) });
    },
  };
}

describe("createPubdirProjection", () => {
  it("is a no-op when nc is null", () => {
    const store = makeStore();
    createPubdirProjection(store, null);
    expect(store.getString).not.toHaveBeenCalled();
    expect(store.put).not.toHaveBeenCalled();
  });

  it("subscribes to the correct NATS wildcard subject", () => {
    const store = makeStore();
    const sub = vi.fn(() => ({ [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }) }));
    createPubdirProjection(store, { subscribe: sub } as any);
    expect(sub).toHaveBeenCalledWith("octovault.object.changed.>");
  });

  it("writes only public nodes to _pubdir", async () => {
    const index = {
      v: 2,
      objects: [
        { id: "n1", type: "page", title: "Public page", access: "public" },
        { id: "n2", type: "page", title: "Private page", access: "space" },
        { id: "n3", type: "folder", access: "invite" },
        { id: "n4", type: "page", access: "public", archived: true },
      ],
      updatedAt: 1000,
    };
    const store = makeStore(JSON.stringify(index));

    // Intercept the async iterator to deliver one message then hang.
    const spaceId = "sp-abc123";
    const payload = { params: { spaceId } };
    const msgData = new TextEncoder().encode(JSON.stringify(payload));
    let delivered = false;
    const sub = vi.fn(() => ({
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (!delivered) {
            delivered = true;
            return Promise.resolve({ value: { data: msgData }, done: false as const });
          }
          return new Promise<never>(() => {}); // hang after first message
        },
      }),
    }));

    createPubdirProjection(store, { subscribe: sub } as any);

    // Give the async loop a tick to process the first message.
    await new Promise((r) => setTimeout(r, 10));

    expect(store.getString).toHaveBeenCalledWith(`spaces/${spaceId}/objects/_index`);
    expect(store.put).toHaveBeenCalledOnce();

    const [putKey, putBody] = store.put.mock.calls[0];
    expect(putKey).toBe(`spaces/${spaceId}/objects/_pubdir`);

    const written = JSON.parse(putBody) as { v: number; objects: { id: string }[] };
    expect(written.v).toBe(1);
    // Only the two public nodes (n1 + n4); n2 (space) and n3 (invite) excluded.
    expect(written.objects.map((n) => n.id).sort()).toEqual(["n1", "n4"]);
  });

  it("skips the space when _index is absent", async () => {
    const store = makeStore(null); // getString returns null
    const spaceId = "sp-missing";
    const msgData = new TextEncoder().encode(JSON.stringify({ params: { spaceId } }));
    let delivered = false;
    const sub = vi.fn(() => ({
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (!delivered) {
            delivered = true;
            return Promise.resolve({ value: { data: msgData }, done: false as const });
          }
          return new Promise<never>(() => {});
        },
      }),
    }));

    createPubdirProjection(store, { subscribe: sub } as any);
    await new Promise((r) => setTimeout(r, 10));

    expect(store.put).not.toHaveBeenCalled();
  });

  it("skips messages with no spaceId in params", async () => {
    const store = makeStore("{}");
    const msgData = new TextEncoder().encode(JSON.stringify({ params: {} }));
    let delivered = false;
    const sub = vi.fn(() => ({
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (!delivered) {
            delivered = true;
            return Promise.resolve({ value: { data: msgData }, done: false as const });
          }
          return new Promise<never>(() => {});
        },
      }),
    }));

    createPubdirProjection(store, { subscribe: sub } as any);
    await new Promise((r) => setTimeout(r, 10));

    expect(store.put).not.toHaveBeenCalled();
  });

  it("skips malformed JSON payloads without throwing", async () => {
    const store = makeStore("{}");
    const msgData = new TextEncoder().encode("not json");
    let delivered = false;
    const sub = vi.fn(() => ({
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (!delivered) {
            delivered = true;
            return Promise.resolve({ value: { data: msgData }, done: false as const });
          }
          return new Promise<never>(() => {});
        },
      }),
    }));

    createPubdirProjection(store, { subscribe: sub } as any);
    await new Promise((r) => setTimeout(r, 10));

    expect(store.put).not.toHaveBeenCalled();
  });

  it("writes an empty objects array when no nodes are public", async () => {
    const index = {
      v: 2,
      objects: [
        { id: "n1", type: "page", access: "space" },
        { id: "n2", type: "folder", access: "invite" },
      ],
      updatedAt: 1000,
    };
    const store = makeStore(JSON.stringify(index));
    const spaceId = "sp-nopub";
    const msgData = new TextEncoder().encode(JSON.stringify({ params: { spaceId } }));
    let delivered = false;
    const sub = vi.fn(() => ({
      [Symbol.asyncIterator]: () => ({
        next: () => {
          if (!delivered) {
            delivered = true;
            return Promise.resolve({ value: { data: msgData }, done: false as const });
          }
          return new Promise<never>(() => {});
        },
      }),
    }));

    createPubdirProjection(store, { subscribe: sub } as any);
    await new Promise((r) => setTimeout(r, 10));

    expect(store.put).toHaveBeenCalledOnce();
    const written = JSON.parse(store.put.mock.calls[0][1]) as { objects: unknown[] };
    expect(written.objects).toEqual([]);
  });
});
