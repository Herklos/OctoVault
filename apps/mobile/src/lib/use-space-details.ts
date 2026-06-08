/**
 * Editable details (name + image) for ONE space, plus its derived type/role flags.
 * Modeled on {@link useProfile}'s draft/dirty/save/pickAvatar shape, but persisted to
 * the SPACE's shared identity rather than the user's profile.
 *
 * Two persistence branches (the data layer is split private vs public):
 *  - PRIVATE → the space's `_rooms` access-record doc via {@link writeRooms} (owner-
 *    gated server-side; threads owner+members through so a meta edit never drops them).
 *  - PUBLIC  → the plaintext `pubspaces/.../_rooms` doc via {@link updatePublicSpaceMeta}.
 * Both are OWNER-ONLY writes (the server gates them), so a member's Save is a no-op —
 * the page gates the editable fields + Save on {@link isOwner}.
 *
 * `image` reuses the avatar data-URI contract (Space.image is the same shape as a
 * profile avatar — see avatar-image / types.ts), so it goes through the same
 * {@link pickAndProcessAvatar} picker.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Space } from '@/lib/types';

import { pickAndProcessAvatar } from './avatar-image';
import { useSession } from './session-context';
import { useSpaces } from './use-spaces';
import { isPublicSpaceId, updatePublicSpaceMeta } from './starfish/pubspace';
import { broadcastSpaceMeta, readRooms, writeRooms } from './starfish/registry';

export interface SpaceDetails {
  /** The space record (from the user's `_spaces` list), or null until it loads. */
  space: Space | null;
  isOwner: boolean;
  isPublic: boolean;
  /** Editable name draft; mirrors the loaded name until the user edits it. */
  draftName: string;
  setDraftName: (v: string) => void;
  /** Staged image draft (data URI), or null to render the monogram. */
  image: string | null;
  pickImage: () => Promise<void>;
  removeImage: () => void;
  /** True when the draft name or image differs from the persisted value. */
  dirty: boolean;
  saveName: () => Promise<void>;
  saving: boolean;
  error: string | null;
}

export function useSpaceDetails(spaceId: string): SpaceDetails {
  const { session } = useSession();
  const { spaces } = useSpaces();
  const space = useMemo(() => spaces.find((s) => s.id === spaceId) ?? null, [spaces, spaceId]);
  const isPublic = isPublicSpaceId(spaceId) || space?.type === 'public';

  // The signed-in identity owns this space when its userId is the owner. A public
  // space records the owner inline (`ownerId`); a private space the user CREATED has
  // no separate owner field on its `_spaces` entry, so the `_rooms.owner` is the
  // source of truth — fetched below.
  const [owner, setOwner] = useState<string | null>(space?.ownerId ?? null);

  const [name, setName] = useState(space?.name ?? '');
  const [draftName, setDraftNameState] = useState(space?.name ?? '');
  const [image, setImageState] = useState<string | null>(space?.image ?? null);
  const [imageBase, setImageBase] = useState<string | null>(space?.image ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards the draft/image against being clobbered by an async (re)load mid-edit.
  const editedName = useRef(false);
  const editedImage = useRef(false);

  // Load the persisted name/image + owner from the space's `_rooms` access record (the
  // shared, authoritative identity). For a private space this also resolves ownership.
  useEffect(() => {
    if (!session || !spaceId) return;
    let cancelled = false;
    (async () => {
      try {
        if (isPublic) {
          // The public `_rooms` lives under the OWNER's path. We can only read it via the
          // owner's account client (i.e. when we ARE the owner). The `_spaces` entry
          // already carries name/image/ownerId for a joiner, so fall back to those.
          if (space?.ownerId) setOwner(space.ownerId);
        } else {
          const { owner: ownr, name: sharedName, image: sharedImage } = await readRooms(
            session.accountClient,
            spaceId,
          );
          if (cancelled) return;
          setOwner(ownr);
          if (!editedName.current && sharedName) {
            setName(sharedName);
            setDraftNameState(sharedName);
          }
          if (!editedImage.current) {
            setImageState(sharedImage);
            setImageBase(sharedImage);
          }
        }
      } catch (e) {
        if (!cancelled) console.error('[useSpaceDetails] failed to read space access record', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, spaceId, isPublic, space?.ownerId]);

  // Adopt the loaded space record into local state unless the user is mid-edit.
  useEffect(() => {
    if (space && !editedName.current) {
      setName(space.name);
      setDraftNameState(space.name);
    }
  }, [space]);
  useEffect(() => {
    if (space && !editedImage.current) {
      setImageState(space.image ?? null);
      setImageBase(space.image ?? null);
    }
  }, [space]);

  const isOwner = !!session && !!owner && owner === session.userId;

  const setDraftName = useCallback((v: string) => {
    editedName.current = true;
    setDraftNameState(v);
  }, []);

  const pickImage = useCallback(async () => {
    setError(null);
    try {
      const uri = await pickAndProcessAvatar();
      if (uri == null) return; // cancelled
      editedImage.current = true;
      setImageState(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that image.');
    }
  }, []);

  const removeImage = useCallback(() => {
    setError(null);
    editedImage.current = true;
    setImageState(null);
  }, []);

  const trimmed = draftName.trim();
  const nameDirty = trimmed.length > 0 && trimmed !== name;
  const imageDirty = (image ?? null) !== (imageBase ?? null);
  const dirty = nameDirty || imageDirty;

  const saveName = useCallback(async () => {
    if (!session || !space || !isOwner || saving) return;
    const nextName = draftName.trim() || name;
    setSaving(true);
    setError(null);
    try {
      if (isPublic) {
        await updatePublicSpaceMeta(session, spaceId, { name: nextName, image });
      } else {
        // Re-read the access record for the freshest owner/members/hash, then rewrite it
        // with the new shared name/image (owner-gated). Threads owner+members through so
        // the meta edit never drops the roster.
        const { owner: ownr, members, hash } = await readRooms(session.accountClient, spaceId);
        await writeRooms(session.accountClient, spaceId, ownr ?? session.userId, members, hash, {
          name: nextName,
          image,
        });
      }
      // Fan the new identity out so the live rail/header adopt it WITHOUT re-reading the
      // user's `_spaces` doc — neither writeRooms nor updatePublicSpaceMeta touches that
      // doc, so a refresh here would re-read the stale name/image and revert the save.
      // The private member path self-heals via reconcileSpaceMeta on the next space open.
      broadcastSpaceMeta(spaceId, { name: nextName, short: nextName.slice(0, 2).toUpperCase(), image: image ?? undefined });
      setName(nextName);
      setDraftNameState(nextName);
      setImageBase(image);
      editedName.current = false;
      editedImage.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the space.');
    } finally {
      setSaving(false);
    }
  }, [session, space, isOwner, saving, draftName, name, isPublic, spaceId, image]);

  return {
    space,
    isOwner,
    isPublic,
    draftName,
    setDraftName,
    image,
    pickImage,
    removeImage,
    dirty,
    saveName,
    saving,
    error,
  };
}
