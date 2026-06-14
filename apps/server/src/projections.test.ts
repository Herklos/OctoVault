import { describe, it, expect } from "vitest";
import { extractPublicNodes, projectObjIndexPublic } from "./projections.js";
import type { WriteEvent } from "@drakkar.software/starfish-protocol";

// ── extractPublicNodes ────────────────────────────────────────────────────────

describe("extractPublicNodes", () => {
  it("returns empty array for nullish / non-object input", () => {
    expect(extractPublicNodes(null)).toEqual([]);
    expect(extractPublicNodes(undefined)).toEqual([]);
    expect(extractPublicNodes("not-an-object")).toEqual([]);
  });

  it("returns empty array when objects field is missing or non-array", () => {
    expect(extractPublicNodes({})).toEqual([]);
    expect(extractPublicNodes({ objects: "not-array" })).toEqual([]);
    expect(extractPublicNodes({ objects: null })).toEqual([]);
  });

  it("extracts only public non-archived nodes", () => {
    const body = {
      objects: [
        { id: "n1", title: "Public Page", type: "page", access: "public", updatedAt: 1000 },
        { id: "n2", title: "Space Page", type: "page", access: "space", updatedAt: 2000 },
        { id: "n3", title: "Invite Page", type: "page", access: "invite", updatedAt: 3000 },
      ],
    };
    const result = extractPublicNodes(body);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "n1", title: "Public Page", type: "page", updatedAt: 1000 });
  });

  it("excludes archived public nodes", () => {
    const body = {
      objects: [
        { id: "n1", title: "Archived", type: "page", access: "public", archived: true, updatedAt: 1000 },
        { id: "n2", title: "Live", type: "page", access: "public", archived: false, updatedAt: 2000 },
      ],
    };
    const result = extractPublicNodes(body);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("n2");
  });

  it("includes optional emoji when present, omits when absent", () => {
    const body = {
      objects: [
        { id: "n1", title: "Board", type: "board", access: "public", emoji: "📋", updatedAt: 1000 },
        { id: "n2", title: "Page", type: "page", access: "public", updatedAt: 2000 },
      ],
    };
    const result = extractPublicNodes(body);
    expect(result).toHaveLength(2);
    expect(result[0].emoji).toBe("📋");
    expect(result[1].emoji).toBeUndefined();
  });

  it("nodes with no access field (absent → not public) are excluded", () => {
    const body = {
      objects: [{ id: "n1", title: "No access", type: "page", updatedAt: 1000 }],
    };
    expect(extractPublicNodes(body)).toHaveLength(0);
  });

  it("handles empty objects array", () => {
    expect(extractPublicNodes({ objects: [] })).toEqual([]);
  });

  it("handles multiple public nodes across types", () => {
    const body = {
      objects: [
        { id: "n1", title: "Page", type: "page", access: "public", updatedAt: 100 },
        { id: "n2", title: "Board", type: "board", access: "public", updatedAt: 200 },
        { id: "n3", title: "Task", type: "task", access: "public", updatedAt: 300 },
      ],
    };
    const result = extractPublicNodes(body);
    expect(result).toHaveLength(3);
    expect(result.map((n) => n.type)).toEqual(["page", "board", "task"]);
  });
});

// ── projectObjIndexPublic ─────────────────────────────────────────────────────

function makeEvent(
  spaceId: string | undefined,
  body: unknown,
  ts = 9000,
): WriteEvent {
  return { params: { spaceId }, body, timestamp: ts } as unknown as WriteEvent;
}

describe("projectObjIndexPublic", () => {
  it("returns null when spaceId is missing", () => {
    expect(projectObjIndexPublic(makeEvent(undefined, {}))).toBeNull();
  });

  it("returns remove op when no public nodes remain", () => {
    const op = projectObjIndexPublic(
      makeEvent("sp-1", { objects: [{ id: "n1", type: "page", access: "space" }] }),
    );
    expect(op).toMatchObject({ id: "sp-1", remove: true });
  });

  it("returns remove op when all public nodes are archived", () => {
    const op = projectObjIndexPublic(
      makeEvent("sp-1", {
        objects: [{ id: "n1", type: "page", access: "public", archived: true }],
      }),
    );
    expect(op).toMatchObject({ id: "sp-1", remove: true });
  });

  it("returns set op with nodes + ts when public nodes exist", () => {
    const op = projectObjIndexPublic(
      makeEvent(
        "sp-1",
        { objects: [{ id: "n1", title: "Pub", type: "page", access: "public", updatedAt: 100 }] },
        5000,
      ),
    ) as { id: string; value: { nodes: unknown[]; ts: number } };
    expect(op.id).toBe("sp-1");
    expect(op.value.ts).toBe(5000);
    expect(op.value.nodes).toHaveLength(1);
  });

  it("returns remove op when body is empty", () => {
    const op = projectObjIndexPublic(makeEvent("sp-1", {}));
    expect(op).toMatchObject({ id: "sp-1", remove: true });
  });
});
