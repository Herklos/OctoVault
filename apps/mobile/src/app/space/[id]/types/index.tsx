import { router, useLocalSearchParams } from 'expo-router';

import { layout, spacing } from '@/theme';
import { useSpaceTypes } from '@/lib/space-types-context';
import { useInShell } from '@/lib/use-responsive';
import { AppBar } from '@/components/ui/AppBar';
import { StackScreen } from '@/components/ui/StackScreen';
import { TypeList } from '@/components/types/TypeList';

export default function SpaceTypesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = id ?? '';
  const inShell = useInShell();
  const { types } = useSpaceTypes();

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/space/[id]' as any));

  const handleAdd = () => {
    const newId = types.addType({
      label: 'New type',
      icon: 'layers',
      editorKind: 'record',
      contentKind: 'none',
      fields: [],
      creatable: true,
      archived: false,
    });
    if (newId) {
      router.push({ pathname: '/space/[id]/types/[typeId]', params: { id: spaceId, typeId: newId } });
    }
  };

  return (
    <StackScreen
      scroll
      contentStyle={{ padding: spacing.screenX, gap: spacing.md, maxWidth: layout.settingsColumnWidth, width: '100%', alignSelf: 'center' }}
      header={<AppBar title="Custom types" onBack={inShell ? undefined : goBack} />}
    >
      <TypeList
        onSelect={(typeId) => router.push({ pathname: '/space/[id]/types/[typeId]', params: { id: spaceId, typeId } })}
        onAdd={handleAdd}
      />
    </StackScreen>
  );
}
