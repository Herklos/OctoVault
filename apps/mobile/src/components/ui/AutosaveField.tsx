import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { NativeSyntheticEvent, StyleProp, TextInputKeyPressEventData, TextInputSelectionChangeEventData, ViewStyle } from 'react-native';

import { motion, type as typeScale } from '@/theme';
import { useAutosave } from '@/lib/use-autosave';

import { TextField } from './TextField';

/** react-native-web forwards the keydown event, so the modifier/composition flags
 *  and `preventDefault` live on it even though RN's type only promises `key`. */
type WebKeyEvent = NativeSyntheticEvent<TextInputKeyPressEventData> & {
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  preventDefault?: () => void;
  nativeEvent: TextInputKeyPressEventData & { isComposing?: boolean };
};

export interface FieldSelection {
  start: number;
  end: number;
}

/** Modifier snapshot handed to {@link AutosaveFieldProps.onKeyDownCapture}. */
export interface KeyMods {
  shift: boolean;
  alt: boolean;
  /** ⌘ on macOS / Ctrl elsewhere — the app's "mod". */
  mod: boolean;
}

interface AutosaveFieldProps {
  /** Seed text, read once on mount (see {@link useAutosave}). */
  initialText: string;
  /** Persist the committed text (debounced while typing, flushed on blur/close). `final`
   *  is true on the blur/unmount flush — branch on it to do heavier work (e.g. split)
   *  only then. */
  onCommit: (text: string, opts: { final: boolean }) => void;
  /** Leave edit mode (the caller unmounts this field, which triggers a final flush). */
  onClose?: () => void;
  /** Idle debounce; defaults to {@link motion.autosaveDoc}. Pass {@link motion.autosaveLog}
   *  for append-log-backed fields. */
  debounceMs?: number;
  /** Empty value is a real commit (docs delete on empty); titles leave this false. */
  commitEmpty?: boolean;
  /** Per-keystroke notification of the live value (uncommitted). Optional and
   *  side-effect-free by default — used by the doc editor to detect the "/" slash
   *  command and start-of-line Markdown shortcuts as the user types. */
  onChange?: (text: string) => void;
  /** Pressing Backspace while the field is ALREADY empty deletes the block
   *  (Notion-style) instead of doing nothing — the doc editor wires this to remove
   *  the block and focus the previous one. No-op when unset. */
  onDeleteEmpty?: () => void;
  /** Live caret/selection mirror — fired on every selection move (after the
   *  internal tracking ref updates, so callers may also keep their own ref). */
  onSelectionChange?: (sel: FieldSelection) => void;
  /** Caret placement applied ONCE on mount (e.g. the seam offset after a block
   *  merge, or end-of-text). Held as a controlled `selection` until the platform
   *  reports it applied, then released so the user owns the caret again. */
  initialSelection?: FieldSelection;
  /**
   * Enter-to-split (the Notion block motion). When set, plain Enter no longer
   * closes/newlines: the value is split at the caret, the HEAD is committed
   * immediately (so the later unmount flush is a no-op and can't resurrect the
   * pre-split text), and `onEnter(head, tail)` lets the owner create the
   * continuation block. Web: Shift+Enter still inserts a newline in multiline
   * fields. Native: multiline fields split on the '\n' arriving in
   * `onChangeText`; single-line fields split via the return key
   * (`submitBehavior:'submit'` keeps the keyboard up for list entry).
   */
  onEnter?: (head: string, tail: string) => void;
  /** Backspace with the caret at offset 0 of a NON-empty field — the block-merge
   *  hook. Receives the live (possibly uncommitted) value so the owner can merge
   *  exactly what's on screen. The key event is consumed when set. */
  onBackspaceAtStart?: (liveText: string) => void;
  /** ArrowUp at the very start / ArrowDown at the very end (single-line: any
   *  offset, since the caret has nowhere to travel) — cross-block caret travel.
   *  Return true to consume the key (i.e. there WAS a neighbour to move to). */
  onArrowBoundary?: (dir: 'up' | 'down') => boolean;
  /** Tab / Shift+Tab (web) — block indent/outdent. Consumes the key when set,
   *  so the field doesn't lose DOM focus to the browser's tab order. */
  onTab?: (shift: boolean) => void;
  /** First-chance key routing (web): called before EVERY other key behaviour;
   *  return true to consume (preventDefault + stop). The doc editor uses it to
   *  steer ArrowUp/Down/Enter/Esc into the open slash menu while the field —
   *  deliberately — keeps DOM focus. */
  onKeyDownCapture?: (key: string, mods: KeyMods) => boolean;
  /** Fired after an Enter/return-key close of a single-line field WITHOUT
   *  `onEnter` (a title submit) — never on blur/Escape, so "rename then jump to
   *  the body" doesn't also fire when the user just clicks away. */
  onSubmit?: () => void;
  multiline?: boolean;
  /** Web only. When true, plain Enter inserts a newline and Shift+Enter splits
   *  into a new block — the opposite of the default. Useful for paragraph/quote/
   *  code blocks where Enter-to-newline feels more natural. */
  newlineOnEnter?: boolean;
  /** Render the value in JetBrains Mono (code blocks). See {@link TextField}. */
  mono?: boolean;
  /** Render the editor at a larger type-scale step (e.g. "display" for an inline
   *  title) so it matches the rendered text it replaces. See {@link TextField}. */
  textVariant?: keyof typeof typeScale;
  /** Borderless seamless surface (see {@link TextField} `plain`) — the doc editor. */
  plain?: boolean;
  /** Grow with content instead of scrolling inside a fixed box (see {@link TextField}). */
  autoGrow?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  minHeight?: number;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Inline editor with no Save/Cancel — edits autosave (see {@link useAutosave}).
 * Replaces {@link MessageEditor} wherever editing should feel like a live document
 * rather than an explicit commit (doc blocks, project card/column titles).
 *
 * Exit gestures: blur flushes + closes; on web Escape closes (a single-line field
 * also closes on Enter unless `onEnter` turns Enter into a block split). On native
 * a single-line field submits via the keyboard's return key.
 *
 * The block-editor key hooks (`onEnter` / `onBackspaceAtStart` /
 * `onArrowBoundary` / `onTab` / `onKeyDownCapture`) are all optional and inert
 * when unset, so title/board/settings call sites are untouched. Caret position is
 * tracked through `onSelectionChange` into a ref — RN's `onKeyPress` carries no
 * caret info, so the ref is the only cross-platform way to know "Backspace AT
 * OFFSET 0" from "Backspace anywhere".
 */
export function AutosaveField({
  initialText,
  onCommit,
  onClose,
  debounceMs = motion.autosaveDoc,
  commitEmpty = false,
  onChange,
  onDeleteEmpty,
  onSelectionChange,
  initialSelection,
  onEnter,
  onBackspaceAtStart,
  onArrowBoundary,
  onTab,
  onKeyDownCapture,
  onSubmit,
  multiline = false,
  newlineOnEnter = false,
  mono = false,
  textVariant,
  plain = false,
  autoGrow = false,
  placeholder,
  autoFocus = true,
  minHeight,
  accessibilityLabel,
  containerStyle,
}: AutosaveFieldProps) {
  const autosave = useAutosave({ initialText, onCommit, debounceMs, commitEmpty });

  // Caret tracker — seeded at end-of-seed-text (where autofocus usually lands)
  // and corrected by the first real selection event.
  const selRef = useRef<FieldSelection>(
    initialSelection ?? { start: initialText.length, end: initialText.length },
  );

  // `initialSelection` is applied as a CONTROLLED selection only until the
  // platform echoes it back (or the user types / a settle timer fires) — holding
  // it longer would pin the caret and fight the user; releasing it instantly
  // would lose the race against the focus event's own caret placement.
  const [pendingSel, setPendingSel] = useState<FieldSelection | null>(initialSelection ?? null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!pendingSel) return;
    settleTimer.current = setTimeout(() => setPendingSel(null), motion.slow);
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
    // Arm once per mount: initialSelection is a mount-time seed, never live-updated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    autosave.flush();
    onClose?.();
  };

  /**
   * Enter-to-split: settle the field on the HEAD (value + immediate final commit,
   * so the unmount flush sees value === committed and no-ops — the pre-split text
   * can never be flushed over the head), then hand the tail to the owner.
   */
  const splitAtCaret = () => {
    const value = autosave.value;
    const sel = selRef.current;
    const start = Math.max(0, Math.min(sel.start, value.length));
    const end = Math.max(start, Math.min(sel.end, value.length));
    const head = value.slice(0, start);
    const tail = value.slice(end);
    autosave.onChangeText(head);
    autosave.flush();
    onEnter?.(head, tail);
  };

  // Per-keystroke: update the autosave value (debounced commit) AND surface the
  // live text to the optional `onChange` so the doc editor can react to a "/" or a
  // start-of-line Markdown prefix as it's typed. On native, a '\n' arriving in a
  // multiline field IS the Enter key (no preventDefault exists there) — peel it
  // off and treat it as a split instead of committing a stray newline.
  const onChangeText = (text: string) => {
    if (pendingSel) setPendingSel(null);
    if (onEnter && multiline && Platform.OS !== 'web' && !newlineOnEnter) {
      const nl = text.indexOf('\n');
      if (nl >= 0) {
        // The incoming buffer already CONTAINS the newline, so split on its own
        // coordinates (not the caret ref): settle on the head, commit it (the
        // unmount flush then no-ops), and hand the tail to the owner.
        const head = text.slice(0, nl);
        const tail = text.slice(nl + 1);
        autosave.onChangeText(head);
        autosave.flush();
        onEnter(head, tail);
        return;
      }
    }
    autosave.onChangeText(text);
    onChange?.(text);
  };

  const handleSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const sel = e.nativeEvent.selection;
    selRef.current = { start: sel.start, end: sel.end };
    // The platform echoed the controlled selection back — release control.
    if (pendingSel && sel.start === pendingSel.start && sel.end === pendingSel.end) setPendingSel(null);
    onSelectionChange?.(selRef.current);
  };

  // Key handling. Order matters: capture routing (slash menu) first, then the
  // structural Backspace behaviours (both platforms — RN fires onKeyPress for
  // Backspace), then web-only navigation (Escape/Enter/Tab/Arrows, which native
  // soft keyboards never emit).
  const onKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const ev = e as WebKeyEvent;
    const key = ev.nativeEvent.key;

    if (
      Platform.OS === 'web' &&
      onKeyDownCapture &&
      onKeyDownCapture(key, { shift: !!ev.shiftKey, alt: !!ev.altKey, mod: !!ev.metaKey || !!ev.ctrlKey })
    ) {
      ev.preventDefault?.();
      return;
    }

    if (key === 'Backspace') {
      if (onDeleteEmpty && autosave.value === '') {
        ev.preventDefault?.();
        onDeleteEmpty();
        return;
      }
      // At offset 0 the native edit buffer has nothing to erase, so even where
      // preventDefault doesn't exist (native) this can't double-delete a char.
      if (onBackspaceAtStart && autosave.value !== '' && selRef.current.start === 0 && selRef.current.end === 0) {
        ev.preventDefault?.();
        onBackspaceAtStart(autosave.value);
        return;
      }
    }

    if (Platform.OS !== 'web') return;

    if (key === 'Escape') {
      ev.preventDefault?.();
      close();
      return;
    }
    if (key === 'Tab' && onTab) {
      ev.preventDefault?.();
      onTab(!!ev.shiftKey);
      return;
    }
    if (key === 'Enter' && !ev.nativeEvent.isComposing) {
      // newlineOnEnter: Shift+Enter splits, plain Enter is a natural newline.
      // default:        plain Enter splits, Shift+Enter is a natural newline.
      const isSplitKey = newlineOnEnter ? ev.shiftKey : !ev.shiftKey;
      if (isSplitKey && onEnter) {
        ev.preventDefault?.();
        splitAtCaret();
        return;
      }
      if (!ev.shiftKey && !multiline) {
        ev.preventDefault?.();
        close();
        onSubmit?.();
        return;
      }
    }
    if ((key === 'ArrowUp' || key === 'ArrowDown') && onArrowBoundary && !ev.shiftKey) {
      const len = autosave.value.length;
      const sel = selRef.current;
      // Single-line fields have no vertical travel, so any offset is a boundary;
      // multiline approximates "first/last line" with offset 0 / end-of-text.
      const atBoundary =
        key === 'ArrowUp' ? !multiline || (sel.start === 0 && sel.end === 0) : !multiline || (sel.start >= len && sel.end >= len);
      if (atBoundary && onArrowBoundary(key === 'ArrowUp' ? 'up' : 'down')) {
        ev.preventDefault?.();
        return;
      }
    }
  };

  return (
    <TextField
      value={autosave.value}
      onChangeText={onChangeText}
      onBlur={close}
      multiline={multiline}
      mono={mono}
      {...(textVariant ? { textVariant } : {})}
      plain={plain}
      autoGrow={autoGrow}
      {...(minHeight !== undefined ? { minHeight } : {})}
      autoFocus={autoFocus}
      placeholder={placeholder}
      accessibilityLabel={accessibilityLabel}
      containerStyle={containerStyle}
      onKeyPress={onKeyPress}
      onSelectionChange={handleSelectionChange}
      {...(pendingSel ? { selection: pendingSel } : {})}
      {...(Platform.OS !== 'web' && !multiline
        ? {
            onSubmitEditing: () => {
              if (onEnter) splitAtCaret();
              else {
                close();
                onSubmit?.();
              }
            },
            // Keep the keyboard up across an Enter-split (continuous list entry);
            // a plain submit (titles) may blur as before.
            ...(onEnter ? { submitBehavior: 'submit' as const } : {}),
          }
        : {})}
    />
  );
}
