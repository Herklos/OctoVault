import { useRef, useState } from 'react';
import type { View as ViewType } from 'react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { radii, spacing } from '@/theme';
import { copyText } from '@/lib/clipboard';
import { objectDescriptor, objectLink } from '@drakkar.software/octovault-sdk';
import { useSpaceObjects } from '@/lib/space-objects-context';
import type { ObjectNode } from '@drakkar.software/octovault-sdk';
import { useTheme } from '@/lib/use-theme';
import { AutosaveField } from '@/components/ui/AutosaveField';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { Sheet } from '@/components/ui/Sheet';
import { Txt } from '@/components/ui/Txt';
import { useToast } from '@/components/ui/Toast';

interface ObjectActionsProps {
  /** The object being acted on (page/board/…); the trigger no-ops until it loads. */
  node: ObjectNode | undefined;
  /** Persist a title/emoji change (wired to `useObjects.rename` in the route). */
  onRename: (patch: { title?: string; emoji?: string }) => void;
  /** Archive the object (wired to `useObjects.archive`); the route handles nav.
   *  This component owns the Undo toast (restore through the shared store). */
  onArchive: () => void;
}

/**
 * Header actions for any {@link ObjectNode}: icon via the searchable
 * {@link EmojiPicker}, title via a no-Save/Cancel {@link AutosaveField} (every
 * keystroke debounce-commits; closing never loses an edit), plus Copy link (web)
 * and Archive. Built on the {@link Sheet} primitive so it presents as a centered
 * dialog on desktop and a bottom sheet on phones — the old hand-rolled Modal was
 * bottom-anchored even on a 1440px window, with a type-an-emoji-by-hand field.
 *
 * Archive is reversible, so it ships with a toast Undo (restore through the ONE
 * shared index store) instead of a blocking confirm — `useConfirm` stays reserved
 * for the irreversible delete-forever in Trash.
 */
export function ObjectActions({ node, onRename, onArchive }: ObjectActionsProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const { spaceId, objects } = useSpaceObjects();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const iconRef = useRef<ViewType>(null);

  const label = node ? objectDescriptor(node.type).label : 'Object';

  const archive = () => {
    if (!node) return;
    const id = node.id;
    setOpen(false);
    onArchive();
    toast.show({
      message: `${label} archived`,
      action: { label: 'Undo', onPress: () => objects.restore(id) },
    });
  };

  const copyLink = async () => {
    if (!node || !spaceId) return;
    const url = objectLink(spaceId, node);
    if (!url) return;
    setOpen(false);
    if (await copyText(url)) toast.show({ message: 'Link copied' });
  };

  return (
    <>
      <IconButton
        name="dots"
        size={18}
        color={colors.ink}
        // Don't open against an unloaded node — there'd be nothing to rename yet.
        onPress={() => { if (node) setOpen(true); }}
        tooltip={`${label} options`}
        accessibilityLabel="Object actions"
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={styles.identityRow}>
          {/* Icon tile: opens the picker (anchored popover on wide, sheet on narrow).
              Ghost smile glyph when no emoji — no forced default icon. */}
          <Pressable
            ref={iconRef}
            accessibilityRole="button"
            accessibilityLabel={node?.emoji ? 'Change icon' : 'Add icon'}
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [
              styles.iconTile,
              { backgroundColor: pressed ? colors.pressed : colors.paperAlt, borderColor: colors.lineSoft },
            ]}
          >
            {node?.emoji ? (
              <Txt variant="title" center>{node.emoji}</Txt>
            ) : (
              <Icon name="emoji" size={18} color={colors.inkMuted} />
            )}
          </Pressable>
          <AutosaveField
            initialText={node?.title ?? ''}
            placeholder="Untitled"
            onCommit={(text) => onRename({ title: text.trim() })}
            accessibilityLabel="Title"
            autoFocus={false}
            containerStyle={styles.titleField}
          />
        </View>
        <Menu>
          {Platform.OS === 'web' ? <MenuItem icon="link" label="Copy link" onPress={() => void copyLink()} /> : null}
          {Platform.OS === 'web' ? <MenuSeparator /> : null}
          <MenuItem icon="trash" label="Archive" danger onPress={archive} />
        </Menu>
        <EmojiPicker
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          anchorRef={iconRef}
          current={node?.emoji ?? null}
          onSelect={(emoji) => onRename({ emoji: emoji ?? undefined })}
        />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconTile: {
    width: spacing.controlMinHeight,
    height: spacing.controlMinHeight,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleField: { flex: 1 },
});
