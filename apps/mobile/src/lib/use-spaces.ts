import { useSpacesContext } from './spaces-context';

/**
 * The current identity's spaces (empty until the user creates or joins one).
 *
 * Thin pass-through over {@link useSpacesContext} (the registry is fetched once by
 * the provider). The chat-era per-space unread overlay was dropped — OctoVault's
 * spaces rail doesn't badge unread.
 */
export function useSpaces() {
  return useSpacesContext();
}
