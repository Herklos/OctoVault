/**
 * Curated emoji shortcode table (GitHub/Slack style). Powers the composer's
 * `:shortcode:` autocomplete (type `:` + a name to insert the glyph) and the
 * visual icon picker (`components/ui/EmojiPicker`), which renders the same
 * table grouped by category.
 *
 * Deliberately a small, hand-picked set (no data dependency) — common smileys,
 * gestures, hearts, symbols and a few marine/theme picks. Several codes may map
 * to the same glyph as aliases (`+1`/`thumbsup`, `plus`/`heavy_plus_sign`), so
 * familiar names from either ecosystem resolve; the picker collapses aliases
 * into one cell while search still matches every name.
 */

/** A shortcode paired with the glyph it inserts. */
export interface EmojiMatch {
  /** The shortcode without surrounding colons (e.g. `octopus`). */
  code: string;
  /** The emoji glyph it expands to. */
  glyph: string;
}

/** A named group of glyphs — section data for the picker grid. */
export interface EmojiCategory {
  id: string;
  /** Section heading shown above the group in the picker. */
  label: string;
  /** Glyphs in curated order, aliases already collapsed (one cell per glyph). */
  emoji: EmojiMatch[];
}

// The categories were previously comment groups inside one flat record;
// formalizing them as data lets the picker render real sections while `EMOJI`
// below stays the same merged lookup the autocomplete has always consumed.
const CATEGORY_TABLES: { id: string; label: string; table: Record<string, string> }[] = [
  {
    id: 'smileys',
    label: 'Smileys & emotion',
    table: {
      smile: '😄', smiley: '😃', grin: '😁', laughing: '😆', joy: '😂', rofl: '🤣',
      sweat_smile: '😅', wink: '😉', blush: '😊', slight_smile: '🙂', upside_down: '🙃',
      heart_eyes: '😍', kissing_heart: '😘', thinking: '🤔', neutral_face: '😐',
      unamused: '😒', roll_eyes: '🙄', smirk: '😏', relieved: '😌', pensive: '😔',
      confused: '😕', cry: '😢', sob: '😭', fearful: '😨', weary: '😩', triumph: '😤',
      angry: '😠', rage: '😡', sleeping: '😴', sunglasses: '😎', nerd: '🤓',
      star_struck: '🤩', partying_face: '🥳', zany: '🤪', scream: '😱',
      exploding_head: '🤯', shushing: '🤫',
    },
  },
  {
    id: 'gestures',
    label: 'Gestures & body',
    table: {
      '+1': '👍', thumbsup: '👍', '-1': '👎', thumbsdown: '👎', ok_hand: '👌',
      fist: '👊', wave: '👋', raised_hands: '🙌', clap: '👏', pray: '🙏', muscle: '💪',
      v: '✌️', crossed_fingers: '🤞', handshake: '🤝', eyes: '👀', point_up: '☝️',
    },
  },
  {
    id: 'hearts',
    label: 'Hearts',
    table: {
      heart: '❤️', broken_heart: '💔', sparkling_heart: '💖', two_hearts: '💕',
      blue_heart: '💙', green_heart: '💚', purple_heart: '💜', yellow_heart: '💛',
      orange_heart: '🧡', black_heart: '🖤',
    },
  },
  {
    id: 'symbols',
    label: 'Symbols & marks',
    table: {
      fire: '🔥', sparkles: '✨', star: '⭐', star2: '🌟', zap: '⚡', boom: '💥',
      '100': '💯', tada: '🎉', confetti_ball: '🎊', balloon: '🎈', gift: '🎁',
      bell: '🔔', warning: '⚠️', check: '✅', white_check_mark: '✅',
      heavy_check_mark: '✔️', x: '❌', no_entry: '⛔', question: '❓', exclamation: '❗',
      plus: '➕', heavy_plus_sign: '➕', minus: '➖', heavy_minus_sign: '➖',
      bulb: '💡', lock: '🔒', key: '🔑', mag: '🔍', hourglass: '⏳', alarm_clock: '⏰',
      calendar: '📅', pushpin: '📌', paperclip: '📎', memo: '📝', link: '🔗',
    },
  },
  {
    id: 'objects',
    label: 'Objects',
    table: {
      rocket: '🚀', computer: '💻', iphone: '📱', email: '✉️', package: '📦', bug: '🐛',
      robot: '🤖', ghost: '👻', alien: '👽', poop: '💩', skull: '💀', clown: '🤡',
      coffee: '☕', beer: '🍺', pizza: '🍕', cake: '🎂', trophy: '🏆', medal: '🏅',
      moneybag: '💰', chart: '📈', hammer: '🔨', wrench: '🔧', gear: '⚙️',
    },
  },
  {
    id: 'marine',
    label: 'Marine & animals',
    table: {
      octopus: '🐙', whale: '🐳', fish: '🐟', tropical_fish: '🐠', dolphin: '🐬',
      shark: '🦈', crab: '🦀', shell: '🐚', ocean: '🌊', anchor: '⚓', ship: '🚢',
      dog: '🐶', cat: '🐱', unicorn: '🦄', turtle: '🐢', penguin: '🐧', owl: '🦉',
      snail: '🐌',
    },
  },
  {
    id: 'nature',
    label: 'Nature & weather',
    table: {
      sunny: '☀️', cloud: '☁️', rainbow: '🌈', snowflake: '❄️', droplet: '💧',
    },
  },
];

/** Flat shortcode → glyph lookup (every alias present) — the autocomplete table. */
export const EMOJI: Record<string, string> = Object.assign(
  {},
  ...CATEGORY_TABLES.map((c) => c.table),
) as Record<string, string>;

/** Keep the first-listed code per glyph; later aliases collapse into it. */
function dedupeByGlyph(entries: EmojiMatch[]): EmojiMatch[] {
  const seen = new Set<string>();
  const out: EmojiMatch[] = [];
  for (const e of entries) {
    if (seen.has(e.glyph)) continue;
    seen.add(e.glyph);
    out.push(e);
  }
  return out;
}

/** Picker sections: curated categories with aliases collapsed. */
export const EMOJI_CATEGORIES: EmojiCategory[] = CATEGORY_TABLES.map((c) => ({
  id: c.id,
  label: c.label,
  emoji: dedupeByGlyph(Object.entries(c.table).map(([code, glyph]) => ({ code, glyph }))),
}));

/** Every distinct glyph in curated order — the picker's "all" grid. */
export const EMOJI_LIST: EmojiMatch[] = EMOJI_CATEGORIES.flatMap((c) => c.emoji);

// Alias-inclusive list backing both matchers: search must hit every familiar
// name (`thumbsup` AND `+1`), even when the picker shows the glyph only once.
const LIST: EmojiMatch[] = Object.entries(EMOJI).map(([code, glyph]) => ({ code, glyph }));

// The `:query` token the caret sits at the end of: a colon at the start of the
// input or right after whitespace, then shortcode characters (no spaces). Anchored
// to `$` so it only fires at the caret. "10:30" doesn't match (colon glued to a
// digit, not start/space) and ":)" doesn't either (")" isn't a shortcode char).
const TOKEN_RE = /(?:^|\s):([a-z0-9_+-]*)$/i;

/**
 * Detect the active emoji shortcode token at the end of `textBeforeCaret`.
 * Returns the partial `query` (no leading colon) and `start`, the index of the
 * opening colon in the original text, or `null` when the caret isn't in a token.
 */
export function activeEmojiQuery(textBeforeCaret: string): { query: string; start: number } | null {
  const m = TOKEN_RE.exec(textBeforeCaret);
  if (!m) return null;
  const query = m[1];
  return { query, start: textBeforeCaret.length - query.length - 1 };
}

/**
 * Up to `limit` shortcodes matching `query` (case-insensitive). Prefix matches
 * rank above interior substring matches; ties keep table order. An empty query
 * yields nothing — we only suggest once the user commits to a name character.
 */
export function matchEmoji(query: string, limit = 8): EmojiMatch[] {
  const q = query.toLowerCase();
  if (!q) return [];
  const prefix: EmojiMatch[] = [];
  const substr: EmojiMatch[] = [];
  for (const e of LIST) {
    const i = e.code.indexOf(q);
    if (i === 0) prefix.push(e);
    else if (i > 0) substr.push(e);
  }
  return [...prefix, ...substr].slice(0, limit);
}

/**
 * Glyph search for the picker grid: ranks like {@link matchEmoji} (prefix over
 * interior substring, ties in table order) across EVERY alias, then collapses
 * aliases so each glyph appears once. Empty query yields nothing — the picker
 * shows the category sections instead.
 */
export function searchEmoji(query: string, limit = 64): EmojiMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const prefix: EmojiMatch[] = [];
  const substr: EmojiMatch[] = [];
  for (const e of LIST) {
    const i = e.code.indexOf(q);
    if (i === 0) prefix.push(e);
    else if (i > 0) substr.push(e);
  }
  return dedupeByGlyph([...prefix, ...substr]).slice(0, limit);
}
