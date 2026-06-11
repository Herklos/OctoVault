import { useCallback, useEffect, useRef } from 'react';

import { useProfile, type ProfileView } from './profile-context';

/**
 * Autosaving facade over {@link useProfile} for the /you screen. The rest of the
 * app saves inline edits implicitly (`AutosaveField`); the profile was the last
 * holdout with a dirty-tracked manual "Save" button in the AppBar. This hook
 * keeps ProfileProvider untouched and instead QUEUES a save whenever an edit is
 * committed, firing it on the render AFTER the draft state lands — the context's
 * `save()` closes over the current draft, so calling it in the same tick as
 * `setDraft` would persist the previous value.
 */
interface ProfileAutosave {
  profile: ProfileView | null;
  loading: boolean;
  saving: boolean;
  /** Commit a (debounced/blurred) display-name edit and autosave it. */
  commitName: (text: string) => void;
  /** Pick an avatar and autosave it (replaces the staged-draft + Save dance). */
  pickAvatar: () => Promise<void>;
  /** Remove the avatar and autosave the removal. */
  removeAvatar: () => void;
  avatarDraft: string | null;
  avatarError: string | null;
}

export function useProfileAutosave(): ProfileAutosave {
  const { profile, loading, saving, dirty, save, setDraft, avatarDraft, pickAvatar, removeAvatar, avatarError } =
    useProfile();
  const wantSave = useRef(false);

  // Runs every render on purpose: it's the cheapest way to observe "the draft
  // state I just queued has committed". Guarded so it only ever acts once per
  // queued edit, and never overlaps an in-flight save.
  useEffect(() => {
    if (!wantSave.current || saving) return;
    if (!dirty) {
      // The committed edit matched the persisted value (e.g. re-typed the same
      // name) — nothing to write.
      wantSave.current = false;
      return;
    }
    wantSave.current = false;
    void save();
  });

  const commitName = useCallback(
    (text: string) => {
      setDraft(text);
      wantSave.current = true;
    },
    [setDraft],
  );

  const pickAndSave = useCallback(async () => {
    await pickAvatar();
    // pickAvatar resolves after the draft is staged (or a cancel, which leaves
    // `dirty` false and makes the queued save a no-op).
    wantSave.current = true;
  }, [pickAvatar]);

  const removeAndSave = useCallback(() => {
    removeAvatar();
    wantSave.current = true;
  }, [removeAvatar]);

  return {
    profile,
    loading,
    saving,
    commitName,
    pickAvatar: pickAndSave,
    removeAvatar: removeAndSave,
    avatarDraft,
    avatarError,
  };
}
