import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radii, spacing, type SwatchName } from '@/theme';
import type { TypeDef, EditorKind, ContentKind } from '@/lib/starfish/object-types-store';
import { useSpaceTypes } from '@/lib/space-types-context';
import { useTheme } from '@/lib/use-theme';
import { AutosaveField } from '@/components/ui/AutosaveField';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { Txt } from '@/components/ui/Txt';
import { ColorPicker } from './ColorPicker';
import { FieldEditor } from './FieldEditor';
import { IconPicker } from './IconPicker';

const EDITOR_KINDS: EditorKind[] = ['page', 'record', 'none'];
const CONTENT_KINDS: ContentKind[] = ['append', 'merge', 'none'];

interface TypeEditorProps {
  typeId: string;
}

export function TypeEditor({ typeId }: TypeEditorProps) {
  const { colors } = useTheme();
  const { types } = useSpaceTypes();
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const def = types.types.find((t) => t.id === typeId);
  if (!def) {
    return <Txt variant="subhead" tone="inkMuted" style={styles.empty}>Type not found.</Txt>;
  }

  return (
    <View style={styles.wrap}>
      {/* Identity */}
      <View style={styles.identity}>
        <Pressable
          onPress={() => setShowIconPicker((v) => !v)}
          style={[styles.iconBtn, { backgroundColor: colors.hover }]}
          accessibilityRole="button"
          accessibilityLabel="Change icon"
        >
          <Icon name={(def.icon as IconName) || 'layers'} size={24} color={colors.ink} />
        </Pressable>
        <AutosaveField
          key={def.id}
          initialText={def.label}
          onCommit={(t) => types.patchType(typeId, { label: t.trim() || 'Unnamed type' })}
          placeholder="Type name…"
          accessibilityLabel="Type name"
          containerStyle={styles.flex}
        />
      </View>

      {showIconPicker ? (
        <View style={[styles.section, { borderColor: colors.lineSoft }]}>
          <IconPicker value={def.icon as IconName} onChange={(name) => { types.patchType(typeId, { icon: name }); setShowIconPicker(false); }} />
        </View>
      ) : null}

      {/* Color */}
      <View style={styles.row}>
        <Pressable onPress={() => setShowColorPicker((v) => !v)} style={styles.rowLabel} accessibilityRole="button" accessibilityLabel="Color">
          <Txt variant="subhead" tone="inkMuted">Color</Txt>
          {def.color ? (
            <View style={[styles.colorDot, { backgroundColor: def.color }]} />
          ) : (
            <Txt variant="caption" tone="inkMuted">None</Txt>
          )}
        </Pressable>
      </View>
      {showColorPicker ? (
        <View style={[styles.section, { borderColor: colors.lineSoft }]}>
          <ColorPicker value={def.color} onChange={(name) => { types.patchType(typeId, { color: name ?? undefined }); setShowColorPicker(false); }} />
        </View>
      ) : null}

      {/* Editor kind */}
      <View style={styles.row}>
        <Txt variant="subhead" tone="inkMuted" style={styles.flex}>Editor</Txt>
        <View style={styles.pills}>
          {EDITOR_KINDS.map((k) => (
            <Pressable
              key={k}
              onPress={() => types.patchType(typeId, { editorKind: k })}
              style={[styles.pill, { backgroundColor: def.editorKind === k ? colors.accent : colors.hover }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: def.editorKind === k }}
            >
              <Txt variant="caption" mono weight={def.editorKind === k ? 'bold' : undefined} style={{ color: def.editorKind === k ? colors.onAccent : colors.ink }}>
                {k}
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Content kind */}
      <View style={styles.row}>
        <Txt variant="subhead" tone="inkMuted" style={styles.flex}>Content</Txt>
        <View style={styles.pills}>
          {CONTENT_KINDS.map((k) => (
            <Pressable
              key={k}
              onPress={() => types.patchType(typeId, { contentKind: k })}
              style={[styles.pill, { backgroundColor: def.contentKind === k ? colors.accent : colors.hover }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: def.contentKind === k }}
            >
              <Txt variant="caption" mono weight={def.contentKind === k ? 'bold' : undefined} style={{ color: def.contentKind === k ? colors.onAccent : colors.ink }}>
                {k}
              </Txt>
            </Pressable>
          ))}
        </View>
      </View>

      <Divider />

      {/* Fields */}
      <Txt variant="micro" weight="bold" mono uppercase tone="inkMuted">Fields</Txt>
      {def.fields.map((field) => (
        <FieldEditor
          key={field.key}
          field={field}
          onPatch={(patch) => types.patchField(typeId, field.key, patch)}
          onRemove={() => types.removeField(typeId, field.key)}
        />
      ))}
      <Button
        label="Add field"
        variant="secondary"
        size="sm"
        iconName="plus"
        onPress={() => {
          const key = `field_${Date.now()}`;
          types.addField(typeId, { key, label: 'New field', kind: 'text' });
        }}
      />

      <Divider />

      {/* Archive */}
      <Button
        label="Archive type"
        variant="danger"
        size="sm"
        iconName="trash"
        onPress={() => types.archiveType(typeId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  empty: { padding: spacing.lg, textAlign: 'center' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: spacing.controlMinHeight },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  colorDot: { width: 18, height: 18, borderRadius: radii.pill },
  pills: { flexDirection: 'row', gap: spacing.xs },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.md },
  section: { borderWidth: 1, borderRadius: radii.md, padding: spacing.sm },
});
