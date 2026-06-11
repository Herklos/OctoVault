import { describe, expect, it } from 'vitest';

import { matchTitle, rankResults } from './search-match';

const node = (title: string, updatedAt = 0) => ({ title, updatedAt });

describe('matchTitle tiers', () => {
  it('returns null for an empty / whitespace query', () => {
    expect(matchTitle('', 'Notes')).toBeNull();
    expect(matchTitle('   ', 'Notes')).toBeNull();
  });

  it('returns null on a miss', () => {
    expect(matchTitle('xyz', 'Notes')).toBeNull();
  });

  it('orders prefix > word-boundary > substring > fuzzy', () => {
    const prefix = matchTitle('not', 'Notes')!;
    const word = matchTitle('not', 'Meeting notes')!;
    const substr = matchTitle('not', 'Keynote slides')!;
    const fuzzy = matchTitle('nts', 'Notes')!;
    expect(prefix.score).toBeGreaterThan(word.score);
    expect(word.score).toBeGreaterThan(substr.score);
    expect(substr.score).toBeGreaterThan(fuzzy.score);
  });

  it('a word-boundary hit beats an earlier mid-word hit (tiers, not position, dominate)', () => {
    // "page" sits mid-word at index 4 in "Homepage", but at a word start in "New page".
    const word = matchTitle('page', 'New page')!;
    const substr = matchTitle('page', 'Homepage')!;
    expect(word.score).toBeGreaterThan(substr.score);
  });

  it('intra-tier: earlier matches in shorter titles score higher', () => {
    const early = matchTitle('plan', 'Q1 plan')!;
    const late = matchTitle('plan', 'Q1 marketing and launch plan')!;
    expect(early.score).toBeGreaterThan(late.score);
  });
});

describe('matchTitle ranges', () => {
  it('prefix range covers the query at the start', () => {
    expect(matchTitle('note', 'Notes')!.ranges).toEqual([{ start: 0, end: 4 }]);
  });

  it('substring/word range indexes into the original title', () => {
    expect(matchTitle('notes', 'Meeting notes')!.ranges).toEqual([{ start: 8, end: 13 }]);
  });

  it('fuzzy emits one range per matched run, merging adjacent hits', () => {
    // r(0), d(3), p(6) in "roadmap" — three scattered single-char runs.
    expect(matchTitle('rdp', 'Roadmap')!.ranges).toEqual([
      { start: 0, end: 1 },
      { start: 3, end: 4 },
      { start: 6, end: 7 },
    ]);
    // r(0), then d(3)+m(4) adjacent — the d/m hits merge into one run.
    expect(matchTitle('rdm', 'Roadmap')!.ranges).toEqual([
      { start: 0, end: 1 },
      { start: 3, end: 5 },
    ]);
    // "road" is contiguous — a single merged run, not four.
    expect(matchTitle('road', 'Roadmap')!.ranges).toEqual([{ start: 0, end: 4 }]);
  });

  it('fuzzy skips whitespace in the query', () => {
    expect(matchTitle('new pg', 'New page')).not.toBeNull();
  });
});

describe('matchTitle folding', () => {
  it('is case-insensitive', () => {
    expect(matchTitle('NOTES', 'notes')!.ranges).toEqual([{ start: 0, end: 5 }]);
  });

  it('is diacritic-insensitive with ranges still indexing the original', () => {
    const m = matchTitle('cafe', 'Café plans')!;
    expect(m.ranges).toEqual([{ start: 0, end: 4 }]);
    expect('Café plans'.slice(0, 4)).toBe('Café');
  });

  it('does not choke on emoji-bearing titles', () => {
    const m = matchTitle('plan', '🐙 Plans')!;
    // '🐙' is 2 UTF-16 units + a space → the word starts at unit index 3.
    expect(m.ranges).toEqual([{ start: 3, end: 7 }]);
  });
});

describe('rankResults', () => {
  it('drops misses and sorts by score', () => {
    const items = [node('Homepage'), node('Groceries'), node('New page'), node('Pages index')];
    const ranked = rankResults('page', items);
    expect(ranked.map((r) => r.item.title)).toEqual(['Pages index', 'New page', 'Homepage']);
  });

  it('breaks score ties by updatedAt DESC', () => {
    const stale = node('Notes', 1000);
    const fresh = node('Notes', 9000);
    const ranked = rankResults('notes', [stale, fresh]);
    expect(ranked[0]!.item).toBe(fresh);
    expect(ranked[1]!.item).toBe(stale);
  });

  it('caps at limit', () => {
    const items = Array.from({ length: 80 }, (_, i) => node(`Note ${i}`, i));
    expect(rankResults('note', items, 50)).toHaveLength(50);
  });
});
