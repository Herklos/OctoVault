import { useCallback } from 'react';

import { typesIndexName, typesIndexPull, typesIndexPush } from '@drakkar.software/octovault-sdk';
import * as store from '@drakkar.software/octovault-sdk';
import type { TypesDoc } from '@drakkar.software/octovault-sdk';
import { useMergeDoc } from './use-merge-doc';

export type { TypeDef, FieldDef, SelectOption, PropKind, EditorKind, ContentKind } from '@drakkar.software/octovault-sdk';

export interface ObjectTypesHook {
  types: store.TypeDef[];
  ready: boolean;
  pull: () => void;
  addType: (def: Omit<store.TypeDef, 'id'>) => string;
  patchType: (id: string, patch: Partial<Omit<store.TypeDef, 'id' | 'fields'>>) => void;
  addField: (typeId: string, field: store.FieldDef) => void;
  patchField: (typeId: string, fieldKey: string, patch: Partial<store.FieldDef>) => void;
  removeField: (typeId: string, fieldKey: string) => void;
  reorderFields: (typeId: string, keys: string[]) => void;
  archiveType: (id: string) => void;
}

export function useObjectTypes(spaceId: string, opts: { enabled?: boolean } = {}): ObjectTypesHook {
  const enabled = !!spaceId && (opts.enabled ?? true);

  const { doc, ready, apply, pull } = useMergeDoc({
    spaceId,
    openId: spaceId,
    enabled,
    storeKey: `typeindex:${spaceId}`,
    privatePaths: () => ({ pull: typesIndexPull(spaceId), push: typesIndexPush(spaceId) }),
  });

  const d = (doc as TypesDoc | null) ?? store.EMPTY_TYPES_DOC;
  const types = (d.types ?? []).filter((t) => !t.archived);

  const mut = useCallback(
    (fn: (cur: TypesDoc) => TypesDoc) => {
      apply((cur) => fn((cur as unknown as TypesDoc | null) ?? store.EMPTY_TYPES_DOC) as unknown as Record<string, unknown>);
    },
    [apply],
  );

  return {
    types,
    ready,
    pull,
    addType: (def) => {
      let newId = '';
      mut((cur) => {
        const { doc: next, id } = store.addType(cur, def);
        newId = id;
        return next;
      });
      return newId;
    },
    patchType: (id, patch) => mut((cur) => store.patchType(cur, id, patch)),
    addField: (typeId, field) => mut((cur) => store.addField(cur, typeId, field)),
    patchField: (typeId, key, patch) => mut((cur) => store.patchField(cur, typeId, key, patch)),
    removeField: (typeId, key) => mut((cur) => store.removeField(cur, typeId, key)),
    reorderFields: (typeId, keys) => mut((cur) => store.reorderFields(cur, typeId, keys)),
    archiveType: (id) => mut((cur) => store.archiveType(cur, id)),
  };
}
