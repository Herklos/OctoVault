import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Hardware-keyboard input for the PIN pads (web only). The app-lock PIN exists
 * ONLY on web (native restores from the OS keystore), so the platform where the
 * PIN lives daily is exactly the one with a keyboard — yet `PinPad` is a grid of
 * Pressables. This hook makes every PIN surface (unlock, lock setup, seed-backup
 * re-auth, device pairing) fully keyboard-operable: digit keys (top row AND
 * numpad), Backspace/Delete, Enter, and pasting a whole PIN.
 *
 * Logic-in-lib per house rules: consumers keep their existing `onDigit`/`onDelete`
 * handlers and just call `usePinKeys({...})` beside the `<PinPad/>`. Native is a
 * no-op (no window, no key events for these controls).
 */
interface PinKeyOptions {
  /** Same handler the on-screen `PinPad` digits call. */
  onDigit: (digit: string) => void;
  /** Backspace/Delete — mirrors the pad's delete key. */
  onDelete: () => void;
  /** Enter — optional early submit (e.g. confirm a complete entry). */
  onSubmit?: () => void;
  /** Pause listening (while an unlock is in flight, or on a non-PIN stage). */
  enabled?: boolean;
}

/** True when the key event is headed for a real text input — leave it alone. */
function targetIsEditable(target: EventTarget | null): boolean {
  const el = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!el) return false;
  const tag = el.tagName?.toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || !!el.isContentEditable;
}

export function usePinKeys({ onDigit, onDelete, onSubmit, enabled = true }: PinKeyOptions): void {
  // Latest handlers behind a ref so the listeners bind once per `enabled` flip
  // instead of churning on every parent render (handlers are usually inline).
  const handlers = useRef({ onDigit, onDelete, onSubmit });
  handlers.current = { onDigit, onDelete, onSubmit };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (targetIsEditable(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave shortcuts alone
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handlers.current.onDigit(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handlers.current.onDelete();
      } else if (e.key === 'Enter' && handlers.current.onSubmit) {
        e.preventDefault();
        handlers.current.onSubmit();
      }
    };

    // Pasting a PIN (e.g. from a password manager) feeds its digits in order —
    // the consumer's own length cap decides how many stick.
    const onPaste = (e: ClipboardEvent) => {
      if (targetIsEditable(e.target)) return;
      const digits = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
      if (!digits) return;
      e.preventDefault();
      for (const d of digits) handlers.current.onDigit(d);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
    };
  }, [enabled]);
}
