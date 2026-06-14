import type { ObjectNode } from '@drakkar.software/octovault-sdk';

/**
 * For invite nodes, strip title/emoji from the index patch before it's applied
 * to the plaintext objindex (privacy: title hidden in the shared index). The
 * real title is preserved in the WAL content — the owner sees it when the node
 * is open. Invite creation already strips via createNode→serializeForIndex;
 * this keeps renames consistent.
 */
export function stripInviteIndexFields(
  id: string,
  patch: { title?: string; emoji?: string },
  nodes: ObjectNode[],
): { title?: string; emoji?: string } {
  const node = nodes.find((n) => n.id === id);
  if (node?.access !== 'invite') return patch;
  const stripped: { title?: string; emoji?: string } = {};
  if (patch.title !== undefined) stripped.title = '';
  return stripped;
}
