import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { registerPull } from '@drakkar.software/octovault-sdk';
import { useObjectTypes, type ObjectTypesHook } from './use-object-types';
import { useSpaces } from './use-spaces';

interface SpaceTypesValue {
  spaceId: string | null;
  types: ObjectTypesHook;
}

const SpaceTypesContext = createContext<SpaceTypesValue | null>(null);

export function SpaceTypesProvider({ children }: { children: ReactNode }) {
  const { activeId } = useSpaces();
  const spaceId = activeId ?? null;
  const types = useObjectTypes(spaceId ?? '', { enabled: !!spaceId });

  const pullRef = useRef(types.pull);
  useEffect(() => {
    pullRef.current = types.pull;
  });

  // Pull the types doc when the space emits a change event.
  useEffect(() => {
    if (!spaceId || !types.ready) return;
    return registerPull(spaceId, () => pullRef.current());
  }, [spaceId, types.ready]);

  const value = useMemo<SpaceTypesValue>(() => ({ spaceId, types }), [spaceId, types]);
  return <SpaceTypesContext.Provider value={value}>{children}</SpaceTypesContext.Provider>;
}

export function useSpaceTypes(): SpaceTypesValue {
  const v = useContext(SpaceTypesContext);
  if (!v) throw new Error('useSpaceTypes must be used within a SpaceTypesProvider');
  return v;
}
