import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { opacity, radii, spacing } from '@/theme';
import { usePage, type Block, type BlockType } from '@/lib/use-page';
import { isPublicSpaceId } from '@/lib/starfish/pubspace';
import { useTheme } from '@/lib/use-theme';
import { AutosaveField } from '@/components/ui/AutosaveField';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Txt } from '@/components/ui/Txt';
import { ObjectHero } from '@/components/work/ObjectHero';

/**
 * Live block editor for one `page` Object — a Notion-style list of typed blocks
 * backed by a {@link usePage} WAL/CRDT document. One block is editable at a time
 * (tap to edit → autosaving field; blur commits); non-editing blocks render
 * read-only so a concurrent remote edit shows on the next fold. Block text merges
 * per-character across devices (RGA), block order via the reconcile diff. Title/
 * emoji live on the index node (header).
 */
export function PageView({ spaceId, objectId, emoji, title }: { spaceId: string; objectId: string; emoji?: string; title?: string }) {
  const { colors } = useTheme();
  const page = usePage(spaceId, objectId);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isPublicSpaceId(spaceId)) {
    return (
      <View style={styles.wrap}>
        <ObjectHero emoji={emoji} title={title} />
        <Callout tone="info" iconName="info">Pages live in private, end-to-end-encrypted spaces in this version.</Callout>
      </View>
    );
  }

  const addBlock = (type: BlockType = 'paragraph') => {
    const id = page.appendBlock({ type });
    if (id) setEditingId(id);
  };

  return (
    <View style={styles.wrap}>
      <ObjectHero emoji={emoji} title={title} subtitle={page.blocks.length ? `${page.blocks.length} blocks` : undefined} />

      {page.offline ? <Callout tone="info" iconName="info">Offline — showing the last synced version.</Callout> : null}
      {page.openError ? <Callout tone="danger" iconName="alert">{page.openError}</Callout> : null}

      <View style={styles.blocks}>
        {page.blocks.map((b, i) => (
          <BlockRow
            key={b.id}
            block={b}
            index={i}
            editing={editingId === b.id}
            onEdit={() => setEditingId(b.id)}
            onClose={() => setEditingId((cur) => (cur === b.id ? null : cur))}
            onText={(t) => page.setBlockText(b.id, t)}
            onCycle={() => page.setBlockType(b.id, nextType(b.type))}
            onToggle={() => page.setBlockChecked(b.id, !b.checked)}
            onDelete={() => {
              setEditingId(null);
              page.removeBlock(b.id);
            }}
          />
        ))}
      </View>

      {page.blocks.length === 0 && page.ready ? (
        <Txt variant="body" tone="inkFaint">Empty page — add your first block.</Txt>
      ) : null}
      {!page.ready && page.opening ? <Txt variant="caption" tone="inkFaint">Opening page…</Txt> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add block"
        disabled={!page.ready}
        onPress={() => addBlock()}
        style={[styles.add, { borderColor: colors.lineFaint, opacity: page.ready ? 1 : opacity.disabled }]}
      >
        <Icon name="plus" size={13} color={colors.inkMuted} />
        <Txt variant="caption" tone="inkMuted">Add block</Txt>
      </Pressable>
    </View>
  );
}

const CYCLE: BlockType[] = ['paragraph', 'heading', 'subheading', 'todo', 'bulleted', 'numbered', 'toggle', 'quote', 'code', 'divider'];
const LABEL: Record<BlockType, string> = {
  paragraph: 'Text',
  heading: 'Heading',
  subheading: 'Subheading',
  todo: 'To-do',
  bulleted: 'Bulleted',
  numbered: 'Numbered',
  toggle: 'Toggle',
  quote: 'Quote',
  code: 'Code',
  divider: 'Divider',
};
const MULTILINE: BlockType[] = ['paragraph', 'quote', 'code'];

function nextType(t: BlockType): BlockType {
  const i = CYCLE.indexOf(t);
  return CYCLE[(i + 1) % CYCLE.length]!;
}

function variantFor(t: BlockType): 'title' | 'heading' | 'body' | 'callout' {
  if (t === 'heading') return 'title';
  if (t === 'subheading') return 'heading';
  if (t === 'code') return 'callout';
  return 'body';
}

interface BlockRowProps {
  block: Block;
  index: number;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onText: (text: string) => void;
  onCycle: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function BlockRow({ block, index, editing, onEdit, onClose, onText, onCycle, onToggle, onDelete }: BlockRowProps) {
  const { colors } = useTheme();

  if (block.type === 'divider') {
    return (
      <View style={styles.dividerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit divider" onPress={onEdit} style={styles.dividerHit}>
          <View style={[styles.rule, { backgroundColor: colors.lineSoft }]} />
        </Pressable>
        {editing ? <RowActions type={block.type} onCycle={onCycle} onDelete={onDelete} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {block.type === 'todo' ? (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!block.checked }} accessibilityLabel={block.checked ? 'Mark not done' : 'Mark done'} onPress={onToggle} hitSlop={6} style={styles.gutter}>
          <Icon name={block.checked ? 'check' : 'target'} size={15} color={block.checked ? colors.success : colors.inkFaint} />
        </Pressable>
      ) : (
        <Prefix type={block.type} index={index} />
      )}

      <View style={styles.body}>
        {editing ? (
          <AutosaveField
            initialText={block.text}
            onCommit={(t) => onText(t)}
            onClose={onClose}
            autoFocus
            commitEmpty
            plain
            autoGrow
            multiline={MULTILINE.includes(block.type)}
            placeholder={LABEL[block.type]}
            accessibilityLabel="Block text"
          />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Edit block" onPress={onEdit} style={styles.read}>
            <Txt
              variant={variantFor(block.type)}
              mono={block.type === 'code'}
              tone={!block.text ? 'inkFaint' : block.checked ? 'inkMuted' : undefined}
              style={block.checked ? styles.doneText : undefined}
            >
              {block.text || LABEL[block.type]}
            </Txt>
          </Pressable>
        )}
        {editing ? <RowActions type={block.type} onCycle={onCycle} onDelete={onDelete} /> : null}
      </View>
    </View>
  );
}

/** Leading glyph for list/quote blocks (todo has its own checkbox). */
function Prefix({ type, index }: { type: BlockType; index: number }) {
  const { colors } = useTheme();
  if (type === 'bulleted') return <Txt style={styles.gutter} tone="inkMuted">•</Txt>;
  if (type === 'numbered') return <Txt style={styles.gutter} tone="inkMuted" mono>{`${index + 1}.`}</Txt>;
  if (type === 'quote') return <View style={[styles.quoteBar, { backgroundColor: colors.accent }]} />;
  return <View style={styles.gutter} />;
}

/** Inline controls shown under the block being edited: cycle type + delete. */
function RowActions({ type, onCycle, onDelete }: { type: BlockType; onCycle: () => void; onDelete: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Change block type" onPress={onCycle} style={[styles.typeChip, { borderColor: colors.lineFaint }]}>
        <Icon name="layers" size={11} color={colors.inkMuted} />
        <Txt variant="micro" weight="bold" mono uppercase tone="inkMuted">{LABEL[type]}</Txt>
      </Pressable>
      <IconButton name="trash" size={13} color={colors.inkMuted} onPress={onDelete} accessibilityLabel="Delete block" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  blocks: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  gutter: { minWidth: 20, alignItems: 'center', paddingTop: 2 },
  quoteBar: { width: 3, alignSelf: 'stretch', borderRadius: radii.xs, marginRight: spacing.xs },
  body: { flex: 1, gap: 4 },
  read: { paddingVertical: 4 },
  doneText: { textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radii.sm, borderWidth: 1 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  dividerHit: { flex: 1, paddingVertical: spacing.xs },
  rule: { height: 1, borderRadius: radii.xs },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed' },
});
