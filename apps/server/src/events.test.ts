import { describe, it, expect } from "vitest";
import { buildWhistlersTopic } from "./events.js";

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
