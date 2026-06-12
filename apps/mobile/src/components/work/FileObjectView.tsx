/**
 * Viewer for file and image objects — the `editor:'file'` renderer.
 *
 * - If no blob is attached yet: shows an "Attach file"/"Attach image" CTA.
 * - For image objects: displays the decrypted image using expo-image.
 * - For file objects: shows metadata + a "Share / download" button.
 */
import { useCallback, useEffect, useState } from 'react';
import { File as FSFile, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';
import type { ByteSealer } from '@/lib/starfish/attachments';
import { loadObjectBlob } from '@/lib/starfish/object-blobs';
import { getSpaceEncryptor } from '@/lib/starfish/space-encryptor';
import { useSession } from '@/lib/session-context';
import { useSpaceObjects } from '@/lib/space-objects-context';
import { useObjectFiles } from '@/lib/use-object-files';
import type { PropValue } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Txt } from '@/components/ui/Txt';

interface FileObjectViewProps {
  spaceId: string;
  objectId: string;
  onRenameTitle?: (text: string) => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileObjectView({ spaceId, objectId, onRenameTitle: _onRenameTitle }: FileObjectViewProps) {
  const { session } = useSession();
  const { objects } = useSpaceObjects();
  const { attachBlob } = useObjectFiles(spaceId);
  const node = objects.get(objectId);
  const isImage = node?.type === 'image';

  const props = node?.props ?? {};
  const blobId = props['blobId'] as PropValue;
  const mime = (props['mime'] as string | undefined) ?? (isImage ? 'image/jpeg' : 'application/octet-stream');
  const name = (props['name'] as string | undefined) ?? (isImage ? 'image' : 'file');
  const size = props['size'] as number | undefined;

  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!blobId || typeof blobId !== 'string' || !session) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const spaceEnc = await getSpaceEncryptor(spaceId, session, null);
        const enc = spaceEnc.encryptor as unknown as ByteSealer;
        const data = await loadObjectBlob(spaceEnc.client, enc, spaceId, blobId);
        if (!cancelled) setBytes(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load file');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [blobId, spaceId, session]);

  const handleShare = useCallback(async () => {
    if (!bytes) return;
    const cacheFile = new FSFile(Paths.cache, name);
    cacheFile.write(bytes);
    await Sharing.shareAsync(cacheFile.uri, { mimeType: mime, dialogTitle: name });
  }, [bytes, name, mime]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Txt variant="callout" tone="danger">{error}</Txt>
      </View>
    );
  }

  if (!blobId) {
    return (
      <EmptyState
        iconName={isImage ? 'image' : 'file'}
        title={isImage ? 'No image attached' : 'No file attached'}
        subtitle={isImage ? 'Attach an image to this object.' : 'Attach a file to this object.'}
      >
        <Button
          label={isImage ? 'Attach image' : 'Attach file'}
          variant="primary"
          iconName="plus"
          size="sm"
          onPress={() => void attachBlob(objectId, isImage)}
        />
      </EmptyState>
    );
  }

  if (isImage && bytes) {
    const b64 = btoa(String.fromCharCode(...bytes));
    const uri = `data:${mime};base64,${b64}`;
    return (
      <View style={styles.imageContainer}>
        <Image source={{ uri }} style={styles.image} contentFit="contain" />
        <View style={styles.imageMeta}>
          <Txt variant="caption" tone="inkMuted">{name}{size != null ? ` · ${formatBytes(size)}` : ''}</Txt>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fileMeta}>
      <Txt variant="heading" weight="medium" numberOfLines={1}>{name}</Txt>
      {size != null ? <Txt variant="callout" tone="inkMuted">{formatBytes(size)}</Txt> : null}
      <Txt variant="caption" tone="inkFaint" mono>{mime}</Txt>
      {bytes ? (
        <Button label="Share / download" variant="secondary" iconName="arrow-r" onPress={() => void handleShare()} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  imageContainer: { flex: 1 },
  image: { flex: 1 },
  imageMeta: { padding: spacing.sm, alignItems: 'center' },
  fileMeta: { padding: spacing.lg, gap: spacing.md },
});
