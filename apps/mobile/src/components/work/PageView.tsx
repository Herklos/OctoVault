import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, opacity, radii, spacing } from '@/theme';
import { isMultiline, labelFor, mdShortcut, monoFor, variantFor } from '@/lib/blocks';
import { usePage, type Block, type BlockType } from '@/lib/use-page';
import { isPublicSpaceId } from '@/lib/starfish/pubspace';
import { useRowHover } from '@/lib/use-hover';
import { useTheme } from '@/lib/use-theme';
import { AutosaveField } from '@/components/ui/AutosaveField';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Txt } from '@/components/ui/Txt';
import { BlockTypeMenu } from '@/components/work/BlockTypeMenu';
import { ObjectHero } from '@/components/work/ObjectHero';

/**
 * Live block editor for one `page` Object — a Notion-style list of typed blocks
 * backed by a {@link usePage} WAL/CRDT document. One block is editable at a time
 * (tap to edit → autosaving field; blur commits); non-editing blocks render
 * read-only so a concurrent remote edit shows on the next fold. Block text merges
 * per-character across devices (RGA), block order via the reconcile diff. Title/
 * emoji live on the index node (header).
 *
 * Affordances (Notion-style): a left-gutter hover "+" inserts a block below (web
 * hover; native reveals it on the actively-edited row); a gutter grip opens the
 * shared {@link BlockTypeMenu} to change the block's type; clicking the empty area
 * below the last block (or an empty page) appends a paragraph and focuses it.
 */
export function PageView({ spaceId, objectId, emoji, title, onRenameTitle }: { spaceId: string; objectId: string; emoji?: string; title?: string; onRenameTitle?: (text: string) => void }) {
  const { colors } = useTheme();
  const page = usePage(spaceId, objectId);
  const [editingId, setEditingId] = useState<string | null>(null);
  // The block-type menu is shared across three triggers: `insert` chooses a new
  // block's type (gutter +), `retype` changes an existing block's type (gutter grip),
  // and `slash` is the "/" command inside an empty block (selecting clears the "/").
  const [menu, setMenu] = useState<{ mode: 'insert'; index: number } | { mode: 'retype'; id: string; type: BlockType } | { mode: 'slash'; id: string; type: BlockType } | null>(null);
  // A pending Markdown-shortcut conversion ("# " etc.), applied on the NEXT commit
  // tick so the editing field has already unmounted (and flushed the prefix) — the
  // effect's clear is then the last write and converges the char-RGA text to empty.
  const [pending, setPending] = useState<{ id: string; type: BlockType } | null>(null);

  // Markdown shortcut: the field unmounted on `setEditingId(null)` and flushed the
  // raw prefix; now convert the type, clear the text, and reopen the block empty.
  useEffect(() => {
    if (!pending) return;
    page.setBlockType(pending.id, pending.type);
    page.setBlockText(pending.id, '');
    setEditingId(pending.id);
    setPending(null);
  }, [pending, page]);

  if (isPublicSpaceId(spaceId)) {
    return (
      <View style={[styles.wrap, { backgroundColor: colors.editorCanvas }]}>
        <ObjectHero emoji={emoji} title={title} />
        <Callout tone="info" iconName="info">Pages live in private, end-to-end-encrypted spaces in this version.</Callout>
      </View>
    );
  }

  const insertAt = (index: number, type: BlockType = 'paragraph') => {
    const id = page.insertBlock(index, { type });
    if (id) setEditingId(id);
    return id;
  };

  const onMenuSelect = (type: BlockType) => {
    if (!menu) return;
    if (menu.mode === 'insert') {
      insertAt(menu.index, type);
    } else if (menu.mode === 'slash') {
      // Slash command: set the type, drop the "/", and reopen the now-empty block.
      page.setBlockType(menu.id, type);
      page.setBlockText(menu.id, '');
      setEditingId(menu.id);
    } else {
      page.setBlockType(menu.id, type);
    }
    setMenu(null);
  };

  const onMenuClose = () => {
    // Cancelling the slash menu leaves the block holding a stray "/" — clear it.
    if (menu?.mode === 'slash') page.setBlockText(menu.id, '');
    setMenu(null);
  };

  // Live keystroke handler for the editing block: open the slash menu on a lone "/",
  // or convert the type on a start-of-line Markdown prefix. Both first close the
  // editor (so its field flushes the raw text), then the menu/effect clears it.
  const onBlockChange = (id: string, type: BlockType, text: string) => {
    if (text === '/') {
      setEditingId(null);
      setMenu({ mode: 'slash', id, type });
      return;
    }
    const md = mdShortcut(text);
    if (md && md !== type) {
      setEditingId(null);
      setPending({ id, type: md });
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.editorCanvas }]}>
      <ObjectHero emoji={emoji} title={title} subtitle={page.blocks.length ? `${page.blocks.length} blocks` : undefined} onChangeTitle={onRenameTitle} />

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
            onChange={(t) => onBlockChange(b.id, b.type, t)}
            onAddBelow={() => setMenu({ mode: 'insert', index: i + 1 })}
            onChangeType={() => setMenu({ mode: 'retype', id: b.id, type: b.type })}
            onToggle={() => page.setBlockChecked(b.id, !b.checked)}
            onDelete={() => {
              setEditingId(null);
              page.removeBlock(b.id);
            }}
          />
        ))}
      </View>

      {!page.ready && page.opening ? <Txt variant="caption" tone="inkFaint">Opening page…</Txt> : null}

      {/* Click the empty area below the last block (and on an empty page) to append
          a paragraph and focus it — `docEditorMinHeight` is the min tap surface. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a block"
        disabled={!page.ready}
        onPress={() => insertAt(page.blocks.length)}
        style={[styles.tail, { opacity: page.ready ? 1 : opacity.disabled }]}
      >
        {page.blocks.length === 0 && page.ready ? (
          <Txt variant="body" tone="inkFaint">Empty page — click here to start writing.</Txt>
        ) : null}
      </Pressable>

      <BlockTypeMenu
        visible={!!menu}
        current={menu && menu.mode !== 'insert' ? menu.type : undefined}
        title={menu?.mode === 'insert' ? 'Add block' : 'Turn into'}
        onSelect={onMenuSelect}
        onClose={onMenuClose}
      />
    </View>
  );
}

interface BlockRowProps {
  block: Block;
  index: number;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onText: (text: string) => void;
  /** Live per-keystroke text (for the slash command + Markdown shortcuts). */
  onChange: (text: string) => void;
  onAddBelow: () => void;
  onChangeType: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function BlockRow({ block, index, editing, onEdit, onClose, onText, onChange, onAddBelow, onChangeType, onToggle, onDelete }: BlockRowProps) {
  const { colors } = useTheme();
  const { hovered, hoverProps } = useRowHover();
  // Web reveals gutter controls on hover; native has no pointer (`useRowHover` is
  // constant-false), so the actively-edited block reveals them instead.
  const showGutter = hovered || editing;

  if (block.type === 'divider') {
    return (
      <View style={styles.row} {...hoverProps}>
        <BlockGutter visible={showGutter} onAddBelow={onAddBelow} onChangeType={onChangeType} />
        <Pressable accessibilityRole="button" accessibilityLabel="Edit divider" onPress={onEdit} style={styles.dividerHit}>
          <View style={[styles.rule, { backgroundColor: colors.lineSoft }]} />
        </Pressable>
        {editing ? <IconButton name="trash" size={13} color={colors.inkMuted} onPress={onDelete} accessibilityLabel="Delete block" /> : null}
      </View>
    );
  }

  return (
    <View style={styles.row} {...hoverProps}>
      <BlockGutter visible={showGutter} onAddBelow={onAddBelow} onChangeType={onChangeType} />

      {block.type === 'todo' ? (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!block.checked }} accessibilityLabel={block.checked ? 'Mark not done' : 'Mark done'} onPress={onToggle} hitSlop={6} style={styles.marker}>
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
            onChange={onChange}
            onClose={onClose}
            autoFocus
            commitEmpty
            plain
            autoGrow
            textVariant={variantFor(block.type)}
            mono={monoFor(block.type)}
            multiline={isMultiline(block.type)}
            placeholder={labelFor(block.type)}
            accessibilityLabel="Block text"
          />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Edit block" onPress={onEdit} style={styles.read}>
            <Txt
              variant={variantFor(block.type)}
              mono={monoFor(block.type)}
              tone={!block.text ? 'inkFaint' : block.checked ? 'inkMuted' : undefined}
              style={block.checked ? styles.doneText : undefined}
            >
              {block.text || labelFor(block.type)}
            </Txt>
          </Pressable>
        )}
        {editing ? <IconButton name="trash" size={13} color={colors.inkMuted} onPress={onDelete} accessibilityLabel="Delete block" style={styles.delete} /> : null}
      </View>
    </View>
  );
}

/**
 * Left-gutter hover controls for a block row: a "+" that inserts a new block below
 * (opens the type menu) and a grip that opens the type menu to change this block's
 * type. Reserves {@link layout.blockGutterWidth} so rows never shift; the buttons
 * fade in via `visible` (web hover / native active-edit — see {@link BlockRow}).
 */
function BlockGutter({ visible, onAddBelow, onChangeType }: { visible: boolean; onAddBelow: () => void; onChangeType: () => void }) {
  const { colors } = useTheme();
  return (
    // The gutter View reserves a FIXED `blockGutterWidth` so rows never shift; the
    // two-button cluster is absolutely positioned (right-aligned to the gutter's
    // right edge) so it overflows LEFT into the screen margin instead of widening
    // the gutter when revealed (Notion-style margin handles).
    <View style={styles.gutter}>
      {visible ? (
        <View style={styles.gutterCluster}>
          <IconButton name="plus" size={layout.blockHandleSize} color={colors.inkMuted} onPress={onAddBelow} accessibilityLabel="Insert block below" style={styles.gutterBtn} />
          <IconButton name="grip" size={layout.blockHandleSize} color={colors.inkMuted} onPress={onChangeType} accessibilityLabel="Change block type" style={styles.gutterBtn} />
        </View>
      ) : null}
    </View>
  );
}

/** Leading list marker for bullet / numbered / quote blocks (todo has its own checkbox). */
function Prefix({ type, index }: { type: BlockType; index: number }) {
  const { colors } = useTheme();
  if (type === 'bulleted') return <Txt style={styles.marker} tone="inkMuted">•</Txt>;
  if (type === 'numbered') return <Txt style={styles.marker} tone="inkMuted" mono>{`${index + 1}.`}</Txt>;
  if (type === 'quote') return <View style={[styles.quoteBar, { backgroundColor: colors.accent }]} />;
  return <View style={styles.marker} />;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md },
  blocks: { gap: layout.blockRowGap },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  gutter: { width: layout.blockGutterWidth },
  gutterCluster: { position: 'absolute', right: 0, top: 2, flexDirection: 'row', alignItems: 'center' },
  gutterBtn: { padding: 1 },
  marker: { minWidth: 20, alignItems: 'center', paddingTop: 2 },
  quoteBar: { width: layout.quoteBarWidth, alignSelf: 'stretch', borderRadius: radii.xs, marginRight: spacing.xs },
  body: { flex: 1, gap: spacing.xs },
  read: { paddingVertical: 4 },
  doneText: { textDecorationLine: 'line-through' },
  delete: { alignSelf: 'flex-start' },
  dividerHit: { flex: 1, paddingVertical: spacing.xs },
  rule: { height: 1, borderRadius: radii.xs },
  tail: { minHeight: layout.docEditorMinHeight, paddingVertical: spacing.sm },
});
