import { describe, it, expect } from 'vitest';
import { parseSseFrames, extractChangedIds } from './events-stream';

// ── parseSseFrames ────────────────────────────────────────────────────────────

describe('parseSseFrames', () => {
  it('parses a single complete frame', () => {
    const { events, carry } = parseSseFrames('data: {"hello":1}\n\n', '');
    expect(events).toEqual(['{"hello":1}']);
    expect(carry).toBe('');
  });

  it('returns empty events with incomplete frame as carry', () => {
    const { events, carry } = parseSseFrames('data: partia', '');
    expect(events).toEqual([]);
    expect(carry).toBe('data: partia');
  });

  it('assembles frames split across chunks', () => {
    const { events: e1, carry: c1 } = parseSseFrames('data: {"a":1}\n', '');
    expect(e1).toEqual([]);
    const { events: e2, carry: c2 } = parseSseFrames('\n', c1);
    expect(e2).toEqual(['{"a":1}']);
    expect(c2).toBe('');
  });

  it('parses multiple frames from one chunk', () => {
    const chunk = 'data: one\n\ndata: two\n\n';
    const { events } = parseSseFrames(chunk, '');
    expect(events).toEqual(['one', 'two']);
  });

  it('skips event:, id:, and heartbeat comment lines', () => {
    const chunk = 'id: 123\nevent: update\ndata: payload\n: heartbeat\n\n';
    const { events } = parseSseFrames(chunk, '');
    expect(events).toEqual(['payload']);
  });

  it('normalises \\r\\n line endings', () => {
    const chunk = 'data: ok\r\n\r\n';
    const { events } = parseSseFrames(chunk, '');
    expect(events).toEqual(['ok']);
  });

  it('carries leftover across calls', () => {
    const { events: e1, carry: c1 } = parseSseFrames('data: start', '');
    const { events: e2 } = parseSseFrames('\n\n', c1);
    expect(e1).toEqual([]);
    expect(e2).toEqual(['start']);
  });
});

// ── extractChangedIds ─────────────────────────────────────────────────────────

describe('extractChangedIds', () => {
  it('extracts spaceId from sourceTopic', () => {
    const data = JSON.stringify({ sourceTopic: 'octovault.object.changed.sp-abc' });
    expect(extractChangedIds(data)).toEqual({ spaceId: 'sp-abc' });
  });

  it('extracts objectId from rawPayload.params (object form)', () => {
    const data = JSON.stringify({
      sourceTopic: 'octovault.object.changed.sp-abc',
      rawPayload: { params: { spaceId: 'sp-abc', objectId: 'obj-1' } },
    });
    expect(extractChangedIds(data)).toEqual({ spaceId: 'sp-abc', objectId: 'obj-1' });
  });

  it('extracts objectId from rawPayload.params (JSON string form)', () => {
    const data = JSON.stringify({
      sourceTopic: 'octovault.object.changed.sp-abc',
      rawPayload: JSON.stringify({ params: { spaceId: 'sp-abc', objectId: 'obj-2', nodeId: 'n-3' } }),
    });
    const ids = extractChangedIds(data);
    expect(ids.spaceId).toBe('sp-abc');
    expect(ids.objectId).toBe('obj-2');
    expect(ids.nodeId).toBe('n-3');
  });

  it('returns empty object for malformed JSON', () => {
    expect(extractChangedIds('not-json')).toEqual({});
  });

  it('returns empty object for empty string', () => {
    expect(extractChangedIds('')).toEqual({});
  });

  it('ignores unknown sourceTopic prefixes', () => {
    const data = JSON.stringify({ sourceTopic: 'other.topic.sp-xyz' });
    expect(extractChangedIds(data)).toEqual({});
  });
});
