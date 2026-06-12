import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { makeRegistry, BUILTIN_REGISTRY, type TypeRegistry } from '@drakkar.software/octovault-sdk';
import { useSpaceTypes } from './space-types-context';

const TypeRegistryContext = createContext<TypeRegistry>(BUILTIN_REGISTRY);

export function TypeRegistryProvider({ children }: { children: ReactNode }) {
  const { types } = useSpaceTypes();
  const registry = useMemo(() => makeRegistry(types.types), [types.types]);
  return <TypeRegistryContext.Provider value={registry}>{children}</TypeRegistryContext.Provider>;
}

export function useTypeRegistry(): TypeRegistry {
  return useContext(TypeRegistryContext);
}
