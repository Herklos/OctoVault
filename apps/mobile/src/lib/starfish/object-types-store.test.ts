import { describe, expect, it } from 'vitest';
import * as store from './object-types-store';

const emptyDef = (): Omit<store.TypeDef, 'id'> => ({
  label: 'Widget',
  icon: 'layers',
  editorKind: 'record',
  contentKind: 'none',
  fields: [],
  creatable: true,
  archived: false,
});

describe('addType', () => {
  it('appends a new TypeDef with a generated id', () => {
    const { doc, id } = store.addType(store.EMPTY_TYPES_DOC, emptyDef());
    expect(id).toBeTruthy();
    expect(doc.types).toHaveLength(1);
    expect(doc.types[0]!.id).toBe(id);
    expect(doc.types[0]!.label).toBe('Widget');
  });

  it('does not mutate the original doc', () => {
    const original = store.EMPTY_TYPES_DOC;
    store.addType(original, emptyDef());
    expect(original.types).toHaveLength(0);
  });
});

describe('patchType', () => {
  it('updates the matching type by id', () => {
    const { doc: d1, id } = store.addType(store.EMPTY_TYPES_DOC, emptyDef());
    const d2 = store.patchType(d1, id, { label: 'Changed' });
    expect(d2.types[0]!.label).toBe('Changed');
  });

  it('leaves other types untouched', () => {
    const { doc: d1 } = store.addType(store.EMPTY_TYPES_DOC, emptyDef());
    const { doc: d2, id: id2 } = store.addType(d1, { ...emptyDef(), label: 'Other' });
    const d3 = store.patchType(d2, id2, { label: 'Modified' });
    expect(d3.types[0]!.label).toBe('Widget');
    expect(d3.types[1]!.label).toBe('Modified');
  });

  it('ignores unknown ids', () => {
    const { doc: d1 } = store.addType(store.EMPTY_TYPES_DOC, emptyDef());
    const d2 = store.patchType(d1, 'nope', { label: 'x' });
    expect(d2.types[0]!.label).toBe('Widget');
  });
});

describe('addField', () => {
  it('appends a field to the target type', () => {
    const { doc: d1, id } = store.addType(store.EMPTY_TYPES_DOC, emptyDef());
    const d2 = store.addField(d1, id, { key: 'status', label: 'Status', kind: 'select' });
    expect(d2.types[0]!.fields).toHaveLength(1);
    expect(d2.types[0]!.fields[0]!.key).toBe('status');
  });
});

describe('patchField', () => {
  it('updates a field by key', () => {
    const { doc: d1, id } = store.addType(store.EMPTY_TYPES_DOC, emptyDef());
    const d2 = store.addField(d1, id, { key: 'name', label: 'Name', kind: 'text' });
    const d3 = store.patchField(d2, id, 'name', { label: 'Full Name' });
    expect(d3.types[0]!.fields[0]!.label).toBe('Full Name');
    expect(d3.types[0]!.fields[0]!.kind).toBe('text');
  });
});

describe('removeField', () => {
  it('removes the field with the given key', () => {
    const { doc: d1, id } = store.addType(store.EMPTY_TYPES_DOC, emptyDef());
    const d2 = store.addField(d1, id, { key: 'f1', label: 'F1', kind: 'text' });
    const d3 = store.addField(d2, id, { key: 'f2', label: 'F2', kind: 'number' });
    const d4 = store.removeField(d3, id, 'f1');
    expect(d4.types[0]!.fields).toHaveLength(1);
    expect(d4.types[0]!.fields[0]!.key).toBe('f2');
  });
});

describe('reorderFields', () => {
  it('reorders fields by key list', () => {
    const { doc: d1, id } = store.addType(store.EMPTY_TYPES_DOC, emptyDef());
    const d2 = store.addField(d1, id, { key: 'a', label: 'A', kind: 'text' });
    const d3 = store.addField(d2, id, { key: 'b', label: 'B', kind: 'text' });
    const d4 = store.addField(d3, id, { key: 'c', label: 'C', kind: 'text' });
    const d5 = store.reorderFields(d4, id, ['c', 'a', 'b']);
    expect(d5.types[0]!.fields.map((f) => f.key)).toEqual(['c', 'a', 'b']);
  });

  it('appends fields not in the key list after the ordered ones', () => {
    const { doc: d1, id } = store.addType(store.EMPTY_TYPES_DOC, emptyDef());
    const d2 = store.addField(d1, id, { key: 'a', label: 'A', kind: 'text' });
    const d3 = store.addField(d2, id, { key: 'b', label: 'B', kind: 'text' });
    const d4 = store.reorderFields(d3, id, ['b']);
    expect(d4.types[0]!.fields.map((f) => f.key)).toEqual(['b', 'a']);
  });
});

describe('archiveType', () => {
  it('sets archived: true on the type', () => {
    const { doc: d1, id } = store.addType(store.EMPTY_TYPES_DOC, emptyDef());
    const d2 = store.archiveType(d1, id);
    expect(d2.types[0]!.archived).toBe(true);
  });

  it('does not affect other types', () => {
    const { doc: d1 } = store.addType(store.EMPTY_TYPES_DOC, emptyDef());
    const { doc: d2, id: id2 } = store.addType(d1, { ...emptyDef(), label: 'Other' });
    const d3 = store.archiveType(d2, id2);
    expect(d3.types[0]!.archived).toBe(false);
    expect(d3.types[1]!.archived).toBe(true);
  });
});

describe('EMPTY_TYPES_DOC', () => {
  it('is an empty document', () => {
    expect(store.EMPTY_TYPES_DOC.types).toHaveLength(0);
  });
});
