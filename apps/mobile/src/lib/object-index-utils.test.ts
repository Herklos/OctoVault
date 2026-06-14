import { describe, it, expect } from 'vitest';
import { stripInviteIndexFields } from './object-index-utils';
import type { ObjectNode } from '@drakkar.software/octovault-sdk';

function node(id: string, access?: 'space' | 'invite' | 'public'): ObjectNode {
  return { id, access, title: 'T', parentId: null, order: 0, enc: true, updatedAt: 1 } as ObjectNode;
}

describe('stripInviteIndexFields', () => {
  it('passes patch through for space nodes', () => {
    const nodes = [node('n1', 'space')];
    const patch = { title: 'Secret', emoji: '🔒' };
    expect(stripInviteIndexFields('n1', patch, nodes)).toEqual(patch);
  });

  it('strips title and drops emoji for invite nodes', () => {
    const nodes = [node('n1', 'invite')];
    expect(stripInviteIndexFields('n1', { title: 'Secret', emoji: '🔒' }, nodes)).toEqual({ title: '' });
  });

  it('strips title but not an absent emoji for invite nodes', () => {
    const nodes = [node('n1', 'invite')];
    expect(stripInviteIndexFields('n1', { title: 'Secret' }, nodes)).toEqual({ title: '' });
  });

  it('keeps emoji-only patch empty (no title to strip) for invite nodes', () => {
    const nodes = [node('n1', 'invite')];
    expect(stripInviteIndexFields('n1', { emoji: '🔒' }, nodes)).toEqual({});
  });

  it('passes patch through when id not found', () => {
    const nodes = [node('n1', 'invite')];
    const patch = { title: 'X' };
    expect(stripInviteIndexFields('missing', patch, nodes)).toEqual(patch);
  });

  it('passes patch through when access is undefined (defaults to space)', () => {
    const nodes = [node('n1', undefined)];
    const patch = { title: 'X', emoji: '📄' };
    expect(stripInviteIndexFields('n1', patch, nodes)).toEqual(patch);
  });

  it('passes patch through for public nodes (only invite nodes are stripped)', () => {
    const nodes = [node('n1', 'public')];
    const patch = { title: 'Public Title', emoji: '🌐' };
    expect(stripInviteIndexFields('n1', patch, nodes)).toEqual(patch);
  });
});
