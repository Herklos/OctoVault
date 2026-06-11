/**
 * Global keyboard-shortcut layer — the desktop-web keyboard contract every
 * surface binds through (`mod+k` quick-find, `mod+n` new page, `mod+\` sidebar).
 *
 * Web-only by construction: native has no system keyboard chrome to hang
 * bindings off, so everything here collapses to a no-op there (the same
 * degradation pattern as `useHover` / `focus.ts`). The registry is a
 * MODULE-LEVEL singleton rather than context state: bindings register from
 * anywhere in the tree (including overlays mounted in their own RN `Modal`
 * windows, which sit OUTSIDE the provider's React subtree on native), and a
 * singleton keeps mount order irrelevant while several wave-1 surfaces wire up
 * in parallel. {@link ShortcutProvider} stays the public mounting contract — it
 * owns the window listener's lifetime.
 *
 * Scopes form a stack: bindings fire only when their scope is the TOP of the
 * stack, so an open overlay (e.g. the command palette pushing its own scope)
 * automatically silences the global layer underneath instead of every consumer
 * guarding "is a modal open?" itself. The base scope is `'global'`.
 *
 * Keystrokes are ignored while a text input / contenteditable is focused unless
 * the binding opts in (`allowInInput`) — `mod+k` must work mid-typing, but a
 * bare `n` shortcut must never fire while the user writes the word "note".
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

/** `mod` resolves to ⌘ on macOS and Ctrl everywhere else (the Notion convention). */
function isMacLike(): boolean {
  if (!isWeb || typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? navigator.userAgent ?? '');
}

export interface ShortcutOptions {
  /** Only fire while this scope is on TOP of the scope stack. Default `'global'`. */
  scope?: string;
  /** Gate without unregistering (e.g. "only when a doc is open"). Default true. */
  enabled?: boolean;
  /** Also fire while a TextInput/textarea/contenteditable holds focus. */
  allowInInput?: boolean;
}

interface ParsedBinding {
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string;
}

interface Entry {
  parsed: ParsedBinding;
  scope: string;
  allowInInput: boolean;
  /** Live refs so re-renders never re-register (and stale closures never fire). */
  handler: React.RefObject<(e: KeyboardEvent) => void>;
  enabled: React.RefObject<boolean>;
}

/** Aliases accepted in binding strings, normalized to `KeyboardEvent.key` names. */
const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  return: 'enter',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  spacebar: 'space',
};

function parseBinding(binding: string): ParsedBinding {
  const parsed: ParsedBinding = { mod: false, ctrl: false, alt: false, shift: false, meta: false, key: '' };
  // `split('+')` would eat a literal `+` key; tokenize manually so `mod++` works.
  let token = '';
  const tokens: string[] = [];
  for (let i = 0; i < binding.length; i++) {
    const c = binding[i]!;
    if (c === '+' && token.length > 0) {
      tokens.push(token);
      token = '';
    } else {
      token += c;
    }
  }
  if (token) tokens.push(token);
  for (const raw of tokens) {
    const t = raw.toLowerCase();
    if (t === 'mod') parsed.mod = true;
    else if (t === 'ctrl' || t === 'control') parsed.ctrl = true;
    else if (t === 'alt' || t === 'option') parsed.alt = true;
    else if (t === 'shift') parsed.shift = true;
    else if (t === 'meta' || t === 'cmd') parsed.meta = true;
    else parsed.key = KEY_ALIASES[t] ?? t;
  }
  return parsed;
}

/** Normalize an event's key to the binding vocabulary (lowercase, ' ' → 'space'). */
function eventKey(e: KeyboardEvent): string {
  return e.key === ' ' ? 'space' : e.key.toLowerCase();
}

function matches(e: KeyboardEvent, b: ParsedBinding): boolean {
  const mac = isMacLike();
  const wantMeta = b.meta || (b.mod && mac);
  const wantCtrl = b.ctrl || (b.mod && !mac);
  if (e.metaKey !== wantMeta || e.ctrlKey !== wantCtrl) return false;
  if (e.altKey !== b.alt || e.shiftKey !== b.shift) return false;
  return eventKey(e) === b.key;
}

/** True when the keystroke would otherwise type into something. */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as (HTMLElement & { isContentEditable?: boolean }) | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

// ── The singleton registry ──────────────────────────────────────────────────

const entries = new Set<Entry>();
/** Base scope is always present; overlays push/pop on top. */
const scopeStack: string[] = ['global'];

function currentScope(): string {
  return scopeStack[scopeStack.length - 1]!;
}

function onKeyDown(e: KeyboardEvent): void {
  // Browser autorepeat must not machine-gun actions like "new page".
  if (e.repeat) return;
  const editable = isEditableTarget(e.target);
  const scope = currentScope();
  // Last registered wins (the innermost mounted consumer) — matches React's
  // intuition that the most recently mounted surface is the most specific.
  let winner: Entry | null = null;
  for (const entry of entries) {
    if (entry.scope !== scope) continue;
    if (entry.enabled.current === false) continue;
    if (editable && !entry.allowInInput) continue;
    if (matches(e, entry.parsed)) winner = entry;
  }
  if (!winner) return;
  e.preventDefault();
  e.stopPropagation();
  winner.handler.current(e);
}

// One window listener for the whole app, owned by however many providers are
// mounted (refcounted so a duplicated mount in dev/strict-mode stays safe).
let listenerRefs = 0;
function acquireListener(): () => void {
  if (!isWeb || typeof window === 'undefined') return () => {};
  if (listenerRefs === 0) window.addEventListener('keydown', onKeyDown);
  listenerRefs++;
  return () => {
    listenerRefs--;
    if (listenerRefs === 0) window.removeEventListener('keydown', onKeyDown);
  };
}

/**
 * Mounts the app-wide keydown listener (web; renders children untouched on
 * native). Mounted once in `AppFrame`.
 */
export function ShortcutProvider({ children }: { children: ReactNode }) {
  useEffect(() => acquireListener(), []);
  return <>{children}</>;
}

/**
 * Bind a keyboard shortcut for this component's lifetime.
 *
 *     useShortcut('mod+k', () => toggleQuickFind(), { allowInInput: true });
 *
 * No-op on native. The handler is read through a ref, so an inline closure is
 * fine — only `binding` / `scope` / `allowInInput` changes re-register.
 */
export function useShortcut(binding: string, handler: (e: KeyboardEvent) => void, opts: ShortcutOptions = {}): void {
  const handlerRef = useRef(handler);
  const enabledRef = useRef(opts.enabled ?? true);
  handlerRef.current = handler;
  enabledRef.current = opts.enabled ?? true;
  const { scope = 'global', allowInInput = false } = opts;

  useEffect(() => {
    if (!isWeb) return;
    const entry: Entry = { parsed: parseBinding(binding), scope, allowInInput, handler: handlerRef, enabled: enabledRef };
    entries.add(entry);
    // The listener must exist even if a consumer mounts before/without the
    // provider (overlay Modals sit outside its subtree on native trees).
    const release = acquireListener();
    return () => {
      entries.delete(entry);
      release();
    };
  }, [binding, scope, allowInInput]);
}

/**
 * Push a scope onto the stack while `active` — bindings registered under this
 * scope become live and EVERYTHING below (including `'global'`) goes quiet.
 * An overlay calls this with its open state so it never has to disable the
 * shell's shortcuts one by one.
 */
export function useShortcutScope(name: string, active = true): void {
  useEffect(() => {
    if (!isWeb || !active) return;
    scopeStack.push(name);
    return () => {
      // Remove OUR pushed frame wherever it sits — overlapping overlays may
      // close out of order, and splicing (vs pop) keeps the others intact.
      const i = scopeStack.lastIndexOf(name);
      if (i > 0) scopeStack.splice(i, 1);
    };
  }, [name, active]);
}

/** Display glyphs per platform — Mac collapses to symbol runs ('⌘K'), others join with '+'. */
const MAC_MODS: Record<string, string> = { mod: '⌘', meta: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧' };
const PC_MODS: Record<string, string> = { mod: 'Ctrl', meta: 'Win', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift' };
const KEY_GLYPHS: Record<string, string> = {
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  enter: '↵',
  escape: 'Esc',
  backspace: '⌫',
  space: 'Space',
};

/**
 * Human caption for a binding, e.g. `formatShortcut('mod+k')` → `'⌘K'` on a
 * Mac and `'Ctrl+K'` elsewhere. Returns `''` on native, where no chrome shows
 * shortcut hints — callers can pass the result straight to a Menu/Tooltip
 * `shortcut` prop and it disappears there.
 */
export function formatShortcut(binding: string): string {
  if (!isWeb) return '';
  const b = parseBinding(binding);
  const mac = isMacLike();
  const mods = mac ? MAC_MODS : PC_MODS;
  const parts: string[] = [];
  if (b.ctrl) parts.push(mods.ctrl!);
  if (b.alt) parts.push(mods.alt!);
  if (b.shift) parts.push(mods.shift!);
  if (b.meta) parts.push(mods.meta!);
  if (b.mod) parts.push(mods.mod!);
  if (b.key) parts.push(KEY_GLYPHS[b.key] ?? (b.key.length === 1 ? b.key.toUpperCase() : b.key));
  return parts.join(mac ? '' : '+');
}
