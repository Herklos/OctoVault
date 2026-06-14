/**
 * DatabaseView — renders a database object's records in table or gallery view.
 *
 * The database node (`objectId`) owns its column schema in `node.meta.schema`.
 * Its children (objects with `parentId === objectId`) are the rows/records.
 * Field values come from `record.meta.props`.
 *
 * Views:
 *  - TableView  — horizontally scrollable table with one column per schema field.
 *  - GalleryView — 2-column card grid showing title + key props.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { colors as colorTokens, layout, radii, spacing } from '@/theme';
import type { PropField, PropValue } from '@drakkar.software/octovault-sdk';
import { schemaOf } from '@drakkar.software/octovault-sdk';
import { useSpaceObjects } from '@/lib/space-objects-context';
import { useTheme } from '@/lib/use-theme';
import { useDatabase, type DatabaseView as DatabaseViewSpec } from '@/lib/use-database';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Txt } from '@/components/ui/Txt';

interface DatabaseViewProps {
  spaceId: string;
  objectId: string;
}

// ── View switcher ─────────────────────────────────────────────────────────────

type ViewKind = 'table' | 'gallery';

function ViewToggle({ current, onChange }: { current: ViewKind; onChange: (k: ViewKind) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.viewToggle}>
      {(['table', 'gallery'] as ViewKind[]).map(k => (
        <Pressable
          key={k}
          onPress={() => onChange(k)}
          style={[styles.togglePill, current === k && { backgroundColor: colors.selected }]}
          accessibilityRole="radio"
          accessibilityState={{ checked: current === k }}
        >
          <Txt variant="caption" weight={current === k ? 'semibold' : 'regular'} tone={current === k ? 'ink' : 'inkMuted'}>
            {k === 'table' ? 'Table' : 'Gallery'}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

// ── Cell renderer ─────────────────────────────────────────────────────────────

function CellValue({ field, value }: { field: PropField; value: PropValue }) {
  const { colors } = useTheme();

  if (value == null || value === '') {
    return <Txt variant="caption" tone="inkFaint">—</Txt>;
  }

  if (field.kind === 'checkbox') {
    return (
      <View style={[styles.checkCell, { borderColor: colors.lineSoft, backgroundColor: value ? colors.accent : 'transparent' }]}>
        {value ? <Txt variant="caption" color={colors.onAccent}>✓</Txt> : null}
      </View>
    );
  }

  if (field.kind === 'select') {
    const opt = field.options?.find(o => o.id === value);
    const label = opt?.label ?? String(value);
    return (
      <View style={[styles.selectCell, { backgroundColor: colors.hover }]}>
        <Txt variant="caption">{label}</Txt>
      </View>
    );
  }

  return <Txt variant="caption" numberOfLines={1}>{String(value)}</Txt>;
}

// ── Table view ────────────────────────────────────────────────────────────────

const COL_W = 160;
const ROW_H = 40;

function TableView({ spaceId, objectId }: DatabaseViewProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const view = useMemo<DatabaseViewSpec>(() => ({ kind: 'table' }), []);
  const { records, dbTitle } = useDatabase(objectId, view);
  const { objects } = useSpaceObjects();
  const dbNode = objects.get(objectId);
  const schema = dbNode ? schemaOf(dbNode) : [];

  if (!dbNode) return <EmptyState iconName="list" title="Database not found" />;

  const openRecord = (id: string) =>
    router.push({ pathname: '/work/object/[id]', params: { id, spaceId } });

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
      <View>
        {/* Header row */}
        <View style={[styles.tableRow, styles.tableHeader, { borderBottomColor: colors.lineSoft }]}>
          <View style={[styles.tableCell, styles.titleCell, { borderRightColor: colors.lineSoft }]}>
            <Txt variant="caption" weight="semibold" tone="inkMuted">Name</Txt>
          </View>
          {schema.map(f => (
            <View key={f.key} style={[styles.tableCell, { borderRightColor: colors.lineSoft }]}>
              <Txt variant="caption" weight="semibold" tone="inkMuted">{f.label}</Txt>
            </View>
          ))}
        </View>

        {/* Data rows */}
        {records.length === 0 ? (
          <View style={[styles.tableRow, { borderBottomColor: colors.lineSoft }]}>
            <Txt variant="caption" tone="inkMuted" style={styles.emptyRow}>No records yet.</Txt>
          </View>
        ) : (
          records.map(({ node, props }) => (
            <Pressable
              key={node.id}
              onPress={() => openRecord(node.id)}
              style={({ pressed }) => [
                styles.tableRow,
                { borderBottomColor: colors.lineSoft },
                pressed && { backgroundColor: colors.pressed },
              ]}
            >
              <View style={[styles.tableCell, styles.titleCell, { borderRightColor: colors.lineSoft }]}>
                <Txt variant="caption" weight="medium" numberOfLines={1}>
                  {node.emoji ? `${node.emoji} ` : ''}{node.title || 'Untitled'}
                </Txt>
              </View>
              {schema.map(f => (
                <View key={f.key} style={[styles.tableCell, { borderRightColor: colors.lineSoft }]}>
                  <CellValue field={f} value={props[f.key] ?? null} />
                </View>
              ))}
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ── Gallery view ──────────────────────────────────────────────────────────────

function GalleryView({ spaceId, objectId }: DatabaseViewProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const view = useMemo<DatabaseViewSpec>(() => ({ kind: 'gallery' }), []);
  const { records } = useDatabase(objectId, view);
  const { objects } = useSpaceObjects();
  const dbNode = objects.get(objectId);
  const schema = (dbNode ? schemaOf(dbNode) : []).slice(0, 3);

  const openRecord = (id: string) =>
    router.push({ pathname: '/work/object/[id]', params: { id, spaceId } });

  if (records.length === 0) {
    return (
      <View style={styles.galleryEmpty}>
        <Txt variant="callout" tone="inkMuted" center>No records yet.</Txt>
      </View>
    );
  }

  return (
    <View style={styles.gallery}>
      {records.map(({ node, props }) => (
        <Pressable
          key={node.id}
          onPress={() => openRecord(node.id)}
          style={({ pressed }) => [
            styles.galleryCard,
            { backgroundColor: colors.paper, borderColor: colors.lineSoft },
            pressed && { backgroundColor: colors.pressed },
          ]}
        >
          {node.emoji ? (
            <Txt variant="title" style={styles.cardEmoji}>{node.emoji}</Txt>
          ) : null}
          <Txt variant="callout" weight="semibold" numberOfLines={2} style={styles.cardTitle}>
            {node.title || 'Untitled'}
          </Txt>
          {schema.map(f => {
            const value = props[f.key] ?? null;
            if (value == null || value === '') return null;
            return (
              <View key={f.key} style={styles.cardProp}>
                <Txt variant="caption" tone="inkMuted">{f.label}: </Txt>
                <Txt variant="caption" numberOfLines={1}>
                  {f.kind === 'select'
                    ? (f.options?.find(o => o.id === value)?.label ?? String(value))
                    : String(value)}
                </Txt>
              </View>
            );
          })}
        </Pressable>
      ))}
    </View>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export function DatabaseView({ spaceId, objectId }: DatabaseViewProps) {
  const { colors } = useTheme();
  const [viewKind, setViewKind] = useState<ViewKind>('table');
  const router = useRouter();
  const { objects } = useSpaceObjects();
  const dbNode = objects.get(objectId);

  const addRecord = useCallback(() => {
    if (!dbNode) return;
    const newId = objects.create({
      type: 'record',
      parentId: objectId,
      title: '',
    });
    if (newId) {
      router.push({ pathname: '/work/object/[id]', params: { id: newId, spaceId, focusTitle: '1' } });
    }
  }, [dbNode, objectId, objects, router, spaceId]);

  if (!dbNode) {
    return <EmptyState iconName="list" title="Database not found" />;
  }

  return (
    <View style={styles.root}>
      {/* Toolbar */}
      <View style={[styles.toolbar, { borderBottomColor: colors.lineSoft }]}>
        <ViewToggle current={viewKind} onChange={setViewKind} />
        <IconButton
          name="plus"
          size={20}
          onPress={addRecord}
          accessibilityLabel="Add record"
        />
      </View>

      {/* Content */}
      {viewKind === 'table'
        ? <TableView spaceId={spaceId} objectId={objectId} />
        : <GalleryView spaceId={spaceId} objectId={objectId} />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  viewToggle: { flexDirection: 'row', gap: spacing.xs },
  togglePill: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.md },

  // Table
  tableScroll: { flex: 1 },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_H,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeader: { height: 36 },
  tableCell: {
    width: COL_W,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    height: '100%',
  },
  titleCell: { width: 220 },
  emptyRow: { padding: spacing.lg },

  // Checkbox cell
  checkCell: { width: 18, height: 18, borderRadius: radii.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  selectCell: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.md },

  // Gallery
  gallery: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.lg,
  },
  galleryEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  galleryCard: {
    width: '47%',
    minWidth: 140,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardEmoji: { marginBottom: spacing.xs },
  cardTitle: { flexShrink: 1 },
  cardProp: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
});
