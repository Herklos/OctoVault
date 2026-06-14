import { describe, it, expect } from "vitest";
import { buildWhistlersTopic, authorizeTopics } from "./events.js";
import type { RoleEnricher } from "@drakkar.software/starfish-server";

/**
 * Regression tests for events.ts topic derivation.
 *
 * B2 fix: events.ts previously derived the Whistlers topic from the OLD
 * `octovault.chat.changed.<spaceId>` subject. The server now publishes on
 * `octovault.object.changed.<spaceId>`. These tests lock in the correct string
 * so a future rename regression is caught at test time.
 */
describe("buildWhistlersTopic", () => {
  it("uses octovault.object.changed (NOT the old chat.changed)", () => {
    const topic = buildWhistlersTopic("sp-abc123");
    // Must contain 'object-changed', never 'chat-changed'.
    expect(topic).toContain("object-changed");
    expect(topic).not.toContain("chat-changed");
  });

  it("includes the space id in the topic", () => {
    const spaceId = "sp-abc123";
    const topic = buildWhistlersTopic(spaceId);
    expect(topic).toContain(spaceId);
  });

  it("produces the exact Whistlers topic format for a typical space id", () => {
    // Derived from: `octovault` namespace + sanitize(`octovault.object.changed.sp-abc123`)
    // sanitizeTopic replaces '.' with '-', so: octovault-octovault-object-changed-sp-abc123
    expect(buildWhistlersTopic("sp-abc123")).toBe(
      "octovault-octovault-object-changed-sp-abc123",
    );
  });

  it("sanitizes special chars in space ids (dots → dashes)", () => {
    // Edge case: a space id that contains dots or other special chars.
    const topic = buildWhistlersTopic("sp-test.room");
    expect(topic).toBe("octovault-octovault-object-changed-sp-test-room");
  });
});

/**
 * Unit tests for authorizeTopics — the membership gate + firehose-prevention
 * sentinel in the /events handler. Uses a mock enricher so no cap-cert crypto
 * is needed; the handler delegates to this helper so these tests cover the
 * security-critical authorization logic end-to-end.
 */
describe("authorizeTopics", () => {
  /** Build a mock enricher that grants space:member for the listed space ids. */
  function mockEnricher(memberSpaceIds: string[]): RoleEnricher {
    return async (_ctx, { spaceId }) =>
      memberSpaceIds.includes(spaceId) ? ["space:member"] : [];
  }

  it("returns __none__ sentinel when candidates list is empty (firehose prevention)", async () => {
    const enricher = mockEnricher([]);
    const topics = await authorizeTopics("user-1", [], enricher);
    expect(topics).toEqual(["__none__"]);
  });

  it("returns __none__ sentinel when the caller is not a member of any candidate space", async () => {
    const enricher = mockEnricher([]);                // member of nothing
    const topics = await authorizeTopics("user-1", ["sp-a", "sp-b"], enricher);
    expect(topics).toEqual(["__none__"]);
  });

  it("returns the correct Whistlers topic for a single authorized space", async () => {
    const enricher = mockEnricher(["sp-abc123"]);
    const topics = await authorizeTopics("user-1", ["sp-abc123"], enricher);
    expect(topics).toEqual([buildWhistlersTopic("sp-abc123")]);
  });

  it("filters out non-member spaces and returns only authorized topics", async () => {
    // sp-member: authorized; sp-stranger: not a member → dropped
    const enricher = mockEnricher(["sp-member"]);
    const topics = await authorizeTopics("user-1", ["sp-member", "sp-stranger"], enricher);
    expect(topics).toEqual([buildWhistlersTopic("sp-member")]);
    expect(topics).not.toContain(buildWhistlersTopic("sp-stranger"));
  });
});
