import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/theme';
import { leaveSpace } from '@/lib/starfish/registry';
import { useSession } from '@/lib/session-context';
import { useInShell } from '@/lib/use-responsive';
import { useSpaceDetails } from '@/lib/use-space-details';
import { useSpaceInvite } from '@/lib/use-space-invite';
import { useSpaceMembers } from '@/lib/use-space-members';
import { useTheme } from '@/lib/use-theme';
import { AppBar } from '@/components/ui/AppBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { CopyField } from '@/components/ui/CopyField';
import { Divider } from '@/components/ui/Divider';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Row } from '@/components/ui/Row';
import { SignInPrompt } from '@/components/ui/SignInPrompt';
import { StackScreen } from '@/components/ui/StackScreen';
import { TextField } from '@/components/ui/TextField';
import { Txt } from '@/components/ui/Txt';

/** Space details — manage one space's shared identity (name/image), its member roster,
 *  owner-only invites (private cap / public link), and leave/remove. All logic lives in
 *  the `use-space-*` hooks; this page reads the param, pulls them, and composes UI. */
export default function SpaceDetailsScreen() {
  // The member roster resolves names/avatars from a STABLE id set through a module
  // cache the React Compiler can't track — opt out so a fetched profile reaches the
  // rows (see use-space-members.ts / use-pseudos.ts).
  'use no memo';
  const { colors } = useTheme();
  const inShell = useInShell();
  const { session } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const spaceId = id ?? '';

  const { space, isOwner, isPublic, draftName, setDraftName, image, pickImage, removeImage, dirty, saveName, saving, error } =
    useSpaceDetails(spaceId);
  const members = useSpaceMembers(spaceId);
  const invite = useSpaceInvite(spaceId);

  // Local UI state (page-thin: just inputs + confirm toggles, like join.tsx).
  const [joinRequest, setJoinRequest] = useState('');
  const [publicWrite, setPublicWrite] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/work'));

  const doLeave = async () => {
    if (!session || leaving) return;
    setLeaving(true);
    try {
      await leaveSpace(session.accountClient, session.userId, spaceId);
      router.replace('/join');
    } catch {
      setLeaving(false);
    }
  };

  if (!session) {
    return (
      <StackScreen header={<AppBar title="Space" onBack={inShell ? undefined : goBack} />}>
        <SignInPrompt subtitle="Sign in to manage this space." />
      </StackScreen>
    );
  }

  const spaceName = space?.name ?? 'Space';
  const monogram = (space?.short || spaceName.slice(0, 2)).toUpperCase();

  return (
    <StackScreen
      scroll
      contentStyle={styles.content}
      header={
        <AppBar
          title="Space details"
          onBack={inShell ? undefined : goBack}
          right={
            isOwner ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save space"
                accessibilityState={{ disabled: !dirty || saving }}
                disabled={!dirty || saving}
                onPress={saveName}
              >
                <Txt variant="subhead" weight="semibold" tone={dirty || saving ? 'accent' : 'inkMuted'}>
                  {saving ? 'Saving…' : 'Save'}
                </Txt>
              </Pressable>
            ) : null
          }
        />
      }
    >
      {/* IDENTITY */}
      <View style={styles.identity}>
        {isOwner ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Change space image" onPress={pickImage} style={styles.avatarWrap}>
            <Avatar label={monogram} image={image} size={68} />
            <View style={[styles.cameraBadge, { backgroundColor: colors.accent, borderColor: colors.paper }]}>
              <Icon name="camera" size={12} color={colors.onAccent} />
            </View>
          </Pressable>
        ) : (
          <Avatar label={monogram} image={image} size={68} />
        )}
        <View style={styles.identityText}>
          <Txt variant="heading" weight="bold" numberOfLines={1}>
            {spaceName}
          </Txt>
          <View style={styles.pills}>
            <Pill
              label={isPublic ? 'Public' : 'Private'}
              tone={isPublic ? 'note' : 'accent'}
              iconName={isPublic ? 'globe' : 'lock'}
            />
            <Pill label={isOwner ? 'Owner' : 'Member'} tone={isOwner ? 'success' : 'neutral'} iconName="shield" />
          </View>
          {isOwner ? (
            <View style={styles.avatarActions}>
              <Pressable accessibilityRole="button" onPress={pickImage} hitSlop={6}>
                <Txt variant="footnote" weight="semibold" tone="accent">
                  {image ? 'Change image' : 'Upload image'}
                </Txt>
              </Pressable>
              {image ? (
                <Pressable accessibilityRole="button" onPress={removeImage} hitSlop={6}>
                  <Txt variant="footnote" weight="semibold" tone="danger">
                    Remove
                  </Txt>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {isOwner ? (
        <Card title="NAME">
          <View style={styles.field}>
            <Txt variant="micro" weight="semibold" mono uppercase tone="inkMuted">
              Space name
            </Txt>
            <TextField
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Space name…"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (dirty) void saveName();
              }}
            />
          </View>
          {error ? (
            <Callout tone="danger" iconName="alert">
              {error}
            </Callout>
          ) : null}
        </Card>
      ) : null}

      {/* MEMBERS */}
      {members.hasRoster ? (
        <Card title="MEMBERS">
          {members.members.length === 0 ? (
            <Txt variant="footnote" tone="inkSoft">
              {members.loading ? 'Loading members…' : 'No members yet.'}
            </Txt>
          ) : (
            members.members.map((m, i) => (
              <View key={m.userId}>
                {i > 0 ? <Divider style={styles.divider} /> : null}
                <Row
                  title={m.name ?? m.fingerprint}
                  detail={m.isOwner ? 'Owner' : m.name ? m.fingerprint : 'Member'}
                  detailMono={!!m.name || m.isOwner === false}
                  right={
                    <View style={styles.memberRight}>
                      <Avatar label={m.monogram} image={m.avatar} size={28} />
                      {isOwner && !m.isOwner ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${m.name ?? m.fingerprint}`}
                          onPress={() => setPendingRemove(m.userId)}
                          hitSlop={6}
                        >
                          <Icon name="x" size={16} color={colors.danger} />
                        </Pressable>
                      ) : null}
                    </View>
                  }
                />
                {pendingRemove === m.userId ? (
                  <View style={styles.confirm}>
                    <Callout tone="danger" iconName="trash" title="Remove this member?">
                      They lose access to new content. History they already decrypted may remain readable.
                    </Callout>
                    <View style={styles.confirmRow}>
                      <Button
                        label="Remove"
                        variant="danger"
                        size="sm"
                        iconName="trash"
                        style={styles.confirmBtn}
                        onPress={() => {
                          setPendingRemove(null);
                          void members.removeMember(m.userId);
                        }}
                      />
                      <Button label="Cancel" variant="ghost" size="sm" style={styles.confirmBtn} onPress={() => setPendingRemove(null)} />
                    </View>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </Card>
      ) : (
        <Card title="MEMBERS">
          <Txt variant="footnote" tone="inkSoft">
            A public space has no member roster — anyone with the invitation link can read it.
          </Txt>
        </Card>
      )}

      {/* INVITE — owner only */}
      {isOwner ? (
        <Card title="INVITE">
          {invite.isPublic ? (
            <>
              <Txt variant="footnote" tone="inkSoft">
                Generate a space-wide invitation link. Read-only lets people read; read &amp; write lets them post.
              </Txt>
              <View style={styles.typeRow}>
                <Button
                  label="Read-only"
                  variant={!publicWrite ? 'primary' : 'secondary'}
                  size="sm"
                  iconName="globe"
                  onPress={() => {
                    setPublicWrite(false);
                    invite.reset();
                  }}
                />
                <Button
                  label="Read & write"
                  variant={publicWrite ? 'primary' : 'secondary'}
                  size="sm"
                  iconName="link"
                  onPress={() => {
                    setPublicWrite(true);
                    invite.reset();
                  }}
                />
              </View>
              <Button
                label={invite.busy ? 'Generating…' : 'Generate invite link'}
                variant="secondary"
                size="md"
                iconName="link"
                loading={invite.busy}
                onPress={() => void invite.generatePublicInvite(publicWrite)}
              />
            </>
          ) : (
            <>
              <Txt variant="footnote" tone="inkSoft">
                Paste the invitee’s join request (from their Join screen), then generate an encrypted invite cap to send back.
              </Txt>
              <TextField
                value={joinRequest}
                onChangeText={(v) => {
                  setJoinRequest(v);
                  if (invite.result) invite.reset();
                }}
                placeholder="Paste join request…"
                multiline
                mono
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                label={invite.busy ? 'Generating…' : 'Generate invite'}
                variant="secondary"
                size="md"
                iconName="people"
                loading={invite.busy}
                onPress={() => void invite.generatePrivateInvite(joinRequest)}
              />
            </>
          )}
          {invite.result ? (
            <CopyField
              value={invite.result}
              label={invite.isPublic ? 'Invitation link' : 'Invite cap'}
              copyLabel={invite.isPublic ? 'Copy link' : 'Copy invite'}
              share
              shareTitle={`Join ${spaceName} on OctoVault`}
            />
          ) : null}
          {invite.error ? (
            <Callout tone="danger" iconName="alert">
              {invite.error}
            </Callout>
          ) : null}
        </Card>
      ) : null}

      {/* DANGER ZONE */}
      <Card title="DANGER ZONE">
        {isOwner ? (
          <>
            <Txt variant="footnote" tone="inkSoft">
              Leaving removes this space from your devices. As the owner, members keep their access — this does not delete the space.
            </Txt>
            {confirmLeave ? (
              <Callout tone="danger" iconName="logout" title="Leave this space?">
                You’ll stop seeing it on your devices. You can rejoin with an invite later.
              </Callout>
            ) : null}
            {confirmLeave ? (
              <View style={styles.confirmRow}>
                <Button
                  label={leaving ? 'Leaving…' : 'Leave space'}
                  variant="danger"
                  size="md"
                  iconName="logout"
                  style={styles.confirmBtn}
                  disabled={leaving}
                  onPress={doLeave}
                />
                <Button label="Cancel" variant="ghost" size="md" style={styles.confirmBtn} onPress={() => setConfirmLeave(false)} />
              </View>
            ) : (
              <Button label="Leave space" variant="danger" size="md" iconName="logout" onPress={() => setConfirmLeave(true)} />
            )}
          </>
        ) : (
          <>
            <Txt variant="footnote" tone="inkSoft">
              Leaving removes this space from your devices. You can rejoin with a new invite later.
            </Txt>
            <Button
              label={leaving ? 'Leaving…' : 'Leave space'}
              variant="danger"
              size="md"
              iconName="logout"
              disabled={leaving}
              onPress={doLeave}
            />
          </>
        )}
      </Card>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.screenX, gap: spacing.lg, paddingBottom: 96 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatarWrap: { position: 'relative' },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: layout.avatarBadgeSize,
    height: layout.avatarBadgeSize,
    borderRadius: layout.avatarBadgeSize / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: spacing.xs },
  pills: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  avatarActions: { flexDirection: 'row', gap: spacing.md, marginTop: 2 },
  field: { gap: 3 },
  divider: { marginVertical: spacing.xs },
  memberRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  confirm: { gap: spacing.sm, marginTop: spacing.sm },
  confirmRow: { flexDirection: 'row', gap: spacing.sm },
  confirmBtn: { flex: 1 },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
});
