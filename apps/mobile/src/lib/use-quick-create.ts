/**
 * Quick page/board creation against the ACTIVE space — the one create flow
 * shared by every shell entry point (sidebar header `+`, Vault AppBar `+`,
 * desktop home rows, the global mod+N binding), so they all agree on the
 * created node's shape and on the editor handoff.
 *
 * Nodes are born UNTITLED — empty title, NO default emoji (the hero renders an
 * "Add icon" affordance instead of a forced 📄; list rows fall back to the
 * 'Untitled' display label) — then the editor opens with `focusTitle=1` so it
 * mounts editing an empty title: the Notion "new page drops you straight into
 * naming it" feel. Mirrors WorkObjects.createAndOpen and the palette's create
 * actions, so every entry point agrees on the created node's shape.
 */
import { useCallback } from 'react';
import { useRouter } from 'expo-router';

import { useSpaceObjects } from './space-objects-context';

export function useQuickCreate(): {
  newPage: () => void;
  newBoard: () => void;
  /** False until the active space's index store is writable (gates the controls). */
  ready: boolean;
} {
  const router = useRouter();
  const { spaceId, objects } = useSpaceObjects();
  const ready = objects.ready && !!spaceId;

  const newPage = useCallback(() => {
    if (!objects.ready || !spaceId) return;
    const id = objects.create({ type: 'page', title: '' });
    if (id) router.push({ pathname: '/work/page/[id]', params: { id, spaceId, label: 'Untitled', focusTitle: '1' } });
  }, [objects, spaceId, router]);

  const newBoard = useCallback(() => {
    if (!objects.ready || !spaceId) return;
    const id = objects.create({ type: 'board', title: '' });
    if (id) router.push({ pathname: '/work/board/[id]', params: { id, spaceId, label: 'Untitled', focusTitle: '1' } });
  }, [objects, spaceId, router]);

  return { newPage, newBoard, ready };
}
