/**
 * Hook for the "database" object type — resolves a database node's children
 * (records) and applies a {@link DatabaseView} filter/sort/group spec.
 *
 * Logic lives here, not in the component, per OctoVault's design rules.
 */
import { useMemo, useState } from 'react';

import type { DatabaseView, DatabaseViewResult } from '@drakkar.software/octovault-sdk';
import { applyView, schemaOf } from '@drakkar.software/octovault-sdk';
import { useSpaceObjects } from './space-objects-context';

export function useDatabase(dbNodeId: string, view: DatabaseView): DatabaseViewResult & {
  dbTitle: string;
  dbEmoji: string | undefined;
} {
  const { objects } = useSpaceObjects();
  const dbNode = objects.get(dbNodeId);

  const schema = useMemo(() => (dbNode ? schemaOf(dbNode) : []), [dbNode]);

  const children = useMemo(
    () => objects.nodes.filter(n => n.parentId === dbNodeId && !n.archived),
    [objects.nodes, dbNodeId],
  );

  const result = useMemo(
    () => applyView(children, view, schema),
    [children, view, schema],
  );

  return {
    ...result,
    dbTitle: dbNode?.title ?? 'Database',
    dbEmoji: dbNode?.emoji,
  };
}

export type { DatabaseView, DatabaseViewKind } from '@drakkar.software/octovault-sdk';
