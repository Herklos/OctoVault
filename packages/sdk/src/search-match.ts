/**
 * Pure title matcher + ranker for Quick Find / Search. No React, no I/O —
 * unit-tested in `search-match.test.ts`.
 *
 * Relevance is tiered the way a human reads a match, strongest first:
 *
 *   1. PREFIX        — the title starts with the query ("not" → "Notes").
 *   2. WORD boundary — some word starts with the query ("pa" → "New page").
 *   3. SUBSTRING     — the query appears mid-word ("page" → "Homepage").
 *   4. FUZZY         — the query is a subsequence ("rdm" → "Roadmap").
 *
 * Within a tier, earlier and tighter matches in shorter titles score higher;
 * tier gaps are wider than any intra-tier penalty, so a fuzzy hit can never
 * outrank a real substring. Ties (same score) fall back to `updatedAt` DESC in
 * {@link rankResults} — between two pages named "Notes", the one touched last
 * is almost always the one wanted.
 *
 * Matching is case- and diacritic-insensitive via a per-UTF-16-unit fold that
 * PRESERVES STRING LENGTH, so the returned ranges index straight into the
 * ORIGINAL title for highlight rendering.
 */

/** Half-open [start, end) span into the original title. */
export interface MatchRange {
  start: number;
  end: number;
}

export interface TitleMatch {
  score: number;
  ranges: MatchRange[];
}

// Tier bases. Gaps (1000) exceed the max intra-tier penalty (≤900), keeping
// tiers strictly ordered no matter the inputs.
const TIER_PREFIX = 4000;
const TIER_WORD = 3000;
const TIER_SUBSTRING = 2000;
const TIER_FUZZY = 1000;

/**
 * Lowercase + strip diacritics WITHOUT changing length: each UTF-16 unit maps
 * to exactly one folded unit (NFD base char, first lowercase unit). Surrogate
 * halves pass through unchanged — they can't match an ASCII query, which is
 * exactly right for emoji-bearing titles.
 */
function fold(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const base = s[i]!.normalize('NFD')[0]!;
    const lower = base.toLowerCase();
    // Some locale-specific lowercasings expand (e.g. 'İ' → 'i̇'); keep unit 0.
    out += lower.length === 1 ? lower : lower[0]!;
  }
  return out;
}

/** A word starts where the previous folded char is not alphanumeric. */
function isWordStart(folded: string, i: number): boolean {
  if (i === 0) return true;
  return !/[a-z0-9]/.test(folded[i - 1]!);
}

/** Penalty helpers — clamped so they can never cross a tier gap. */
const startPenalty = (i: number) => Math.min(i * 8, 600);
const lengthPenalty = (titleLen: number, queryLen: number) => Math.min(Math.max(titleLen - queryLen, 0), 100);

/**
 * Match one title against a query. Returns `null` for an empty query or a
 * miss. Ranges cover every highlighted span (one for contiguous tiers, several
 * merged runs for fuzzy).
 */
export function matchTitle(query: string, title: string): TitleMatch | null {
  const q = fold(query.trim());
  if (!q) return null;
  const t = fold(title);

  // One pass over every occurrence: the FIRST occurrence drives the substring
  // tier; the first WORD-START occurrence (anywhere) upgrades to the word tier.
  let first = -1;
  let wordAt = -1;
  for (let i = t.indexOf(q); i !== -1; i = t.indexOf(q, i + 1)) {
    if (first === -1) first = i;
    if (isWordStart(t, i)) {
      wordAt = i;
      break;
    }
  }

  if (first === 0) {
    return { score: TIER_PREFIX - lengthPenalty(t.length, q.length), ranges: [{ start: 0, end: q.length }] };
  }
  if (wordAt !== -1) {
    return {
      score: TIER_WORD - startPenalty(wordAt) - lengthPenalty(t.length, q.length),
      ranges: [{ start: wordAt, end: wordAt + q.length }],
    };
  }
  if (first !== -1) {
    return {
      score: TIER_SUBSTRING - startPenalty(first) - lengthPenalty(t.length, q.length),
      ranges: [{ start: first, end: first + q.length }],
    };
  }

  // Fuzzy subsequence (greedy left-to-right). Whitespace in the query is
  // skipped so "new pg" can still reach "New page". Adjacent hits merge into
  // one range so the highlight reads as runs, not confetti.
  const chars = q.replace(/\s+/g, '');
  if (!chars) return null;
  const ranges: MatchRange[] = [];
  let from = 0;
  for (let ci = 0; ci < chars.length; ci++) {
    const at = t.indexOf(chars[ci]!, from);
    if (at === -1) return null;
    const last = ranges[ranges.length - 1];
    if (last && last.end === at) last.end = at + 1;
    else ranges.push({ start: at, end: at + 1 });
    from = at + 1;
  }
  const firstHit = ranges[0]!.start;
  const spread = ranges[ranges.length - 1]!.end - firstHit - chars.length;
  // Tight clusters near the start win; a subsequence scattered across a long
  // title barely registers (but still beats nothing).
  const score = TIER_FUZZY - Math.min(spread * 8, 600) - Math.min(firstHit * 2, 200) - lengthPenalty(t.length, chars.length);
  return { score, ranges };
}

export interface RankedResult<T> {
  item: T;
  score: number;
  ranges: MatchRange[];
}

/**
 * Rank a candidate list against a query: score every title, drop misses, sort
 * by score DESC then `updatedAt` DESC (recency breaks ties), cap at `limit`.
 */
export function rankResults<T extends { title: string; updatedAt: number }>(
  query: string,
  items: readonly T[],
  limit = 50,
): RankedResult<T>[] {
  const out: RankedResult<T>[] = [];
  for (const item of items) {
    const m = matchTitle(query, item.title);
    if (m) out.push({ item, score: m.score, ranges: m.ranges });
  }
  out.sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt);
  return out.slice(0, limit);
}
