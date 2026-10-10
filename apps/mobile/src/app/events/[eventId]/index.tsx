import type { VideoResponse } from '@cvp/shared';
import { ApiError } from '@cvp/upload-client';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { RenameForm } from '@/components/rename-form';
import { Button } from '@/components/ui';
import { IconButton, Message, VideoList } from '@/components/video-list';
import { useI18n } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { env } from '@/lib/env';
import { moveUp } from '@/lib/event/order';
import { useLoad } from '@/lib/use-load';
import { videoStatusLabel } from '@/lib/video/status';
import { MIN_TOUCH, useColors } from '@/theme';

const EVENT_NAME_MAX_LENGTH = 120;

/** One event: its videos in playing order, and everything a member or its owner can do with it. */
export default function EventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { t } = useI18n();
  const e = t.event;
  const c = useColors();
  const router = useRouter();
  const auth = useAuth().state;
  const detail = useLoad(useCallback(() => api.getEvent(eventId), [eventId]));
  const { reload } = detail;

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [renaming, setRenaming] = useState(false);

  /** Runs one change, then loads the event again. `done` is announced; a failure shows `failed`. */
  const run = useCallback(
    async (action: () => Promise<unknown>, done: string, failed: string) => {
      setBusy(true);
      setError('');
      setNotice('');
      try {
        await action();
        await reload();
        setNotice(done);
        return true;
      } catch {
        setError(`${failed} ${t.common.tryAgain}`);
        // Part of the change may have been saved: show what the server has now.
        void reload();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [reload, t.common.tryAgain],
  );

  // The list component wants the videos; everything else about loading stays the same.
  const videos = useMemo(() => ({ ...detail, data: detail.data?.videos ?? null }), [detail]);

  if (detail.error instanceof ApiError && detail.error.status === 404) {
    return (
      <View style={[styles.screen, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <Message icon="help-circle-outline" title={e.notFound} alert />
      </View>
    );
  }

  const data = detail.data;
  const event = data?.event;
  const list = data?.videos ?? [];
  const playable = list.some((video) => video.uploadStatus === 'ready');

  async function shareInvite() {
    if (!event || !data) return;
    setError('');
    try {
      const token = data.inviteToken ?? (await api.openInvite(event.id)).token;
      if (!data.inviteToken) void reload();
      // The secret travels after "#", which browsers never send to a server.
      await Share.share({
        message: `${e.inviteMessage(event.name)} ${env.webUrl}/events/${event.id}/join#${token}`,
      });
    } catch {
      setError(`${e.inviteFailed} ${t.common.tryAgain}`);
    }
  }

  function confirmDelete() {
    if (!event) return;
    if (list.length > 0) {
      return Alert.alert(e.deleteNotEmptyTitle, e.deleteNotEmptyText);
    }
    Alert.alert(e.deleteTitle, e.deleteText(event.name), [
      { text: e.keep, style: 'cancel' },
      {
        text: e.delete,
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          api.deleteEvent(event.id).then(
            () => router.back(),
            (caught: unknown) => {
              setBusy(false);
              setError(
                caught instanceof ApiError && caught.status === 409
                  ? e.deleteHasOthersVideos
                  : `${e.deleteFailed} ${t.common.tryAgain}`,
              );
            },
          );
        },
      },
    ]);
  }

  function confirmLeave() {
    if (!event || auth.status !== 'signedIn') return;
    const userId = auth.user.id;
    Alert.alert(t.invite.leaveTitle, t.invite.leaveText, [
      { text: t.invite.stay, style: 'cancel' },
      {
        text: t.invite.leave,
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          api.removeCollaborator(event.id, userId).then(
            () => router.back(),
            () => {
              setBusy(false);
              setError(`${t.invite.leaveFailed} ${t.common.tryAgain}`);
            },
          );
        },
      },
    ]);
  }

  function confirmRemove(video: VideoResponse) {
    Alert.alert(e.removeTitle, `${e.removeText(video.title)}${e.removePrivateNote}`, [
      { text: e.keepInEvent, style: 'cancel' },
      {
        text: e.remove,
        style: 'destructive',
        onPress: () =>
          void run(
            () => api.setVideoEvent(video.id, null),
            e.removed(video.title),
            e.removeFailed(video.title),
          ),
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: event?.name ?? '' }} />
      <VideoList
        testID="event-videos"
        state={videos}
        // A member also sees their own videos that are still waiting for review.
        showStatus={event?.isMember}
        errorText={e.loadFailed}
        empty={{
          title: e.emptyTitle,
          text: event?.isMember ? e.emptyMember : e.emptyVisitor,
        }}
        renderActions={
          event?.isMember && data
            ? (video, index) => (
                <>
                  {index > 0 && (
                    <IconButton
                      testID={`up-${video.title}`}
                      icon="arrow-up"
                      label={e.moveEarlier(video.title)}
                      disabled={busy}
                      onPress={() =>
                        void run(
                          () =>
                            api.reorderEvent(
                              event.id,
                              moveUp(list, index).map((item) => item.id),
                            ),
                          e.movedUp(video.title),
                          e.orderNotSaved,
                        )
                      }
                    />
                  )}
                  {data.myVideoIds.includes(video.id) && (
                    <IconButton
                      testID={`remove-${video.title}`}
                      icon="close"
                      label={e.removeLabel(video.title)}
                      disabled={busy}
                      onPress={() => confirmRemove(video)}
                    />
                  )}
                </>
              )
            : undefined
        }
        header={
          event && data ? (
            <View style={styles.header}>
              {renaming ? (
                <RenameForm
                  label={e.nameLabel}
                  saveLabel={e.saveName}
                  failedText={e.renameFailed}
                  initial={event.name}
                  maxLength={EVENT_NAME_MAX_LENGTH}
                  onCancel={() => setRenaming(false)}
                  onSave={async (name) => {
                    await api.updateEvent(event.id, { name });
                    await reload();
                    setRenaming(false);
                    setNotice(e.renamed);
                  }}
                />
              ) : (
                <>
                  <Text accessibilityRole="header" style={[styles.name, { color: c.foreground }]}>
                    {event.name}
                  </Text>
                  <Text style={[styles.facts, { color: c.mutedForeground }]}>
                    {event.isOwner ? e.privateOwner : e.privateGuest}
                  </Text>
                  <Text style={[styles.facts, { color: c.mutedForeground }]}>
                    {e.count(list.length)}
                  </Text>
                  {playable && (
                    <Button
                      testID="play-all"
                      label={e.playAll}
                      onPress={() =>
                        router.push({
                          pathname: '/events/[eventId]/play',
                          params: { eventId: event.id },
                        })
                      }
                    />
                  )}
                  {event.isOwner && (
                    <View style={styles.buttons}>
                      <View style={styles.grow}>
                        <Button
                          testID="rename-event"
                          variant="outline"
                          label={e.rename}
                          disabled={busy}
                          onPress={() => setRenaming(true)}
                        />
                      </View>
                      <View style={styles.grow}>
                        <Button
                          testID="share-invite"
                          variant="outline"
                          label={t.invite.title}
                          accessibilityLabel={e.inviteShare}
                          disabled={busy}
                          onPress={() => void shareInvite()}
                        />
                      </View>
                    </View>
                  )}
                </>
              )}
              {/* Always there, so screen readers announce each change. */}
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.facts, { color: c.foreground }]}
              >
                {notice}
              </Text>
              {error !== '' && (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                  style={[styles.facts, { color: c.destructive }]}
                >
                  {error}
                </Text>
              )}
              <Text accessibilityRole="header" style={[styles.section, { color: c.foreground }]}>
                {e.videosTitle}
              </Text>
            </View>
          ) : undefined
        }
        footer={
          event && data && !renaming ? (
            <View style={styles.footer}>
              {event.isMember && (
                <AddVideos
                  eventId={event.id}
                  inEventCount={list.length}
                  busy={busy}
                  onAdd={(chosen) =>
                    run(
                      async () => {
                        // One at a time, so a failure says exactly how far it got after the reload.
                        for (const video of chosen) await api.setVideoEvent(video.id, event.id);
                      },
                      chosen.length === 1 ? e.added(chosen[0]!.title) : e.addedMany(chosen.length),
                      chosen.length === 1 ? e.addFailed(chosen[0]!.title) : e.addFailedMany,
                    )
                  }
                />
              )}
              {event.isOwner ? (
                <Button
                  testID="delete-event"
                  variant="destructive"
                  label={e.delete}
                  disabled={busy}
                  onPress={confirmDelete}
                />
              ) : event.isMember ? (
                <View style={styles.guest}>
                  <Text style={[styles.section, { color: c.foreground }]}>
                    {t.invite.guestTitle}
                  </Text>
                  <Text style={[styles.facts, { color: c.mutedForeground }]}>
                    {t.invite.guestIntro}
                  </Text>
                  <Button
                    testID="leave-event"
                    variant="outline"
                    label={t.invite.leave}
                    disabled={busy}
                    onPress={confirmLeave}
                  />
                </View>
              ) : null}
            </View>
          ) : undefined
        }
      />
    </>
  );
}

/**
 * The caller's own videos that are not in this event yet, as a checklist. Nothing is added by
 * ticking: only the button adds, and only what is ticked.
 */
function AddVideos(props: {
  eventId: string;
  /** Changes when a video enters or leaves the event, so the list is read again. */
  inEventCount: number;
  busy: boolean;
  onAdd(videos: VideoResponse[]): Promise<boolean>;
}) {
  const { t } = useI18n();
  const e = t.event;
  const c = useColors();
  const { eventId, inEventCount } = props;
  const [candidates, setCandidates] = useState<VideoResponse[] | null>(null);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let active = true;
    api.listVideos().then(
      ({ videos }) => active && setCandidates(videos.filter((video) => video.eventId !== eventId)),
      () => active && setCandidates((current) => current ?? []),
    );
    return () => {
      active = false;
    };
  }, [eventId, inEventCount]);

  const canMove = (video: VideoResponse) =>
    video.uploadStatus === 'ready' || video.uploadStatus === 'failed';
  // Only what is still listed and addable counts, whatever was ticked earlier.
  const chosen = candidates?.filter((video) => ticked.has(video.id) && canMove(video)) ?? [];

  return (
    <View style={styles.add}>
      <Text accessibilityRole="header" style={[styles.section, { color: c.foreground }]}>
        {e.addTitle}
      </Text>
      {candidates === null ? null : candidates.length === 0 ? (
        <Text style={[styles.facts, { color: c.mutedForeground }]}>{e.addNone}</Text>
      ) : (
        <>
          <Text style={[styles.facts, { color: c.mutedForeground }]}>{e.addHint}</Text>
          {/* Its own scroll area: with many videos the Add button stays close at hand. */}
          <ScrollView
            testID="add-list"
            style={[styles.addList, { borderColor: c.border }]}
            nestedScrollEnabled
            persistentScrollbar
          >
            {candidates.map((video) => {
              const addable = canMove(video);
              const checked = addable && ticked.has(video.id);
              const note = !addable
                ? e.addNotReady(videoStatusLabel(video, t.videoStatus))
                : video.eventId
                  ? e.addMoves
                  : '';
              return (
                <Pressable
                  key={video.id}
                  testID={`add-${video.title}`}
                  accessibilityRole="checkbox"
                  accessibilityLabel={note ? `${video.title}, ${note}` : video.title}
                  accessibilityState={{ checked, disabled: !addable }}
                  disabled={!addable}
                  onPress={() =>
                    setTicked((current) => {
                      const next = new Set(current);
                      if (next.has(video.id)) next.delete(video.id);
                      else next.add(video.id);
                      return next;
                    })
                  }
                  style={[styles.candidate, !addable && { opacity: 0.55 }]}
                >
                  <View
                    style={[
                      styles.box,
                      { borderColor: checked ? c.primary : c.input },
                      checked && { backgroundColor: c.primary },
                    ]}
                  >
                    {checked && <Ionicons name="checkmark" size={16} color={c.primaryForeground} />}
                  </View>
                  <View style={styles.candidateText}>
                    <Text
                      numberOfLines={2}
                      style={[styles.candidateTitle, { color: c.foreground }]}
                    >
                      {video.title}
                    </Text>
                    {note !== '' && (
                      <Text style={[styles.note, { color: c.mutedForeground }]}>{note}</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <Button
            testID="add-selected"
            label={e.add(chosen.length)}
            disabled={props.busy || chosen.length === 0}
            onPress={() => void props.onAdd(chosen).then(() => setTicked(new Set()))}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  name: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3, lineHeight: 30 },
  facts: { fontSize: 15, lineHeight: 21 },
  section: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  footer: { gap: 24, paddingHorizontal: 20, paddingTop: 24 },
  guest: { gap: 8 },
  add: { gap: 10 },
  addList: { maxHeight: 264, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10 },
  candidate: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 12 },
  candidateText: { flex: 1, gap: 2 },
  candidateTitle: { fontSize: 16, fontWeight: '500', lineHeight: 21 },
  note: { fontSize: 13, lineHeight: 18 },
  box: {
    width: 24,
    height: 24,
    borderWidth: 1.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
