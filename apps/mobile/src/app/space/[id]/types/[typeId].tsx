import { router, useLocalSearchParams } from 'expo-router';

import { layout, spacing } from '@/theme';
import { useSpaceTypes } from '@/lib/space-types-context';
import { useInShell } from '@/lib/use-responsive';
import { AppBar } from '@/components/ui/AppBar';
import { StackScreen } from '@/components/ui/StackScreen';
import { TypeEditor } from '@/components/types/TypeEditor';

export default function SpaceTypeEditorScreen() {
  const { typeId } = useLocalSearchParams<{ id: string; typeId: string }>();
  const inShell = useInShell();
  const { types } = useSpaceTypes();

  const def = types.types.find((t) => t.id === (typeId ?? ''));
  const title = def?.label ?? 'Edit type';

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/work'));

  return (
    <StackScreen
      scroll
      contentStyle={{ padding: spacing.screenX, gap: spacing.md, maxWidth: layout.settingsColumnWidth, width: '100%', alignSelf: 'center' }}
      header={<AppBar title={title} onBack={inShell ? undefined : goBack} />}
    >
      <TypeEditor typeId={typeId ?? ''} />
    </StackScreen>
  );
}
