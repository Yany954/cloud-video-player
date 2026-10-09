import { VIDEO_TITLE_MAX_LENGTH } from '@cvp/shared';
import { ApiError } from '@cvp/upload-client';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RenameForm } from '@/components/rename-form';
import { Button, ErrorText } from '@/components/ui';
import { IconButton, Message } from '@/components/video-list';
import { VideoStage } from '@/components/video-stage';
import { useI18n } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { videoStatusLabel } from '@/lib/video/status';
import { useColors } from '@/theme';

export default function VideoScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const { t } = useI18n();
  const c = useColors();
  const router = useRouter();
  // Asked for again each time the screen is opened: the links in the answer expire.
  const state = useLoad(useCallback(() => api.getPlayback(videoId), [videoId]));
  // A new title is shown at once, without loading the video again.
  const [newTitle, setNewTitle] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const playback = state.data;
  const title = newTitle ?? playback?.title ?? '';
  const status = state.error instanceof ApiError ? state.error.status : null;

  function confirmDelete() {
    Alert.alert(t.deleteVideo.dialogTitle, t.deleteVideo.dialogText(title), [
      { text: t.deleteVideo.keep, style: 'cancel' },
      {
        text: t.deleteVideo.button,
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          setDeleteError('');
          api.deleteVideo(videoId).then(
            () => router.back(),
            (caught: unknown) => {
              setDeleting(false);
              setDeleteError(
                caught instanceof ApiError && caught.status === 409
                  ? t.deleteVideo.stillPreparing(title)
                  : t.deleteVideo.failed(title),
              );
            },
          );
        },
      },
    ]);
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ title }} />
      {playback ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <VideoStage playback={playback} />
          <View style={styles.details}>
            {renaming ? (
              <RenameForm
                label={t.renameVideo.label}
                saveLabel={t.renameVideo.save}
                failedText={t.renameVideo.failed}
                initial={title}
                maxLength={VIDEO_TITLE_MAX_LENGTH}
                onCancel={() => setRenaming(false)}
                onSave={async (name) => {
                  const renamed = await api.renameVideo(videoId, name);
                  setNewTitle(renamed.title);
                  setRenaming(false);
                }}
              />
            ) : (
              <View style={styles.titleRow}>
                <Text accessibilityRole="header" style={[styles.title, { color: c.foreground }]}>
                  {title}
                </Text>
                {playback.isMine && (
                  <IconButton
                    testID="rename-video"
                    icon="pencil"
                    label={t.renameVideo.button(title)}
                    onPress={() => setRenaming(true)}
                  />
                )}
              </View>
            )}
            <Text style={[styles.facts, { color: c.mutedForeground }]}>
              {formatDuration(playback.durationSeconds)}, {playback.width} x {playback.height}
            </Text>
            {/* Only its uploader needs to know where the review stands. */}
            {playback.isMine && (
              <Text style={[styles.facts, { color: c.mutedForeground }]}>
                {videoStatusLabel(
                  {
                    uploadStatus: 'ready',
                    moderationStatus: playback.moderationStatus,
                    failureReason: null,
                  },
                  t.videoStatus,
                )}
              </Text>
            )}
            {playback.canDelete && !renaming && (
              <View style={styles.actions}>
                <Button
                  testID="delete-video"
                  variant="destructive"
                  label={deleting ? t.deleteVideo.deleting : t.deleteVideo.button}
                  accessibilityLabel={t.deleteVideo.label(title)}
                  busy={deleting}
                  onPress={confirmDelete}
                />
                <ErrorText>{deleteError}</ErrorText>
              </View>
            )}
          </View>
        </ScrollView>
      ) : state.failed ? (
        <Message
          icon={status === 404 ? 'help-circle-outline' : 'cloud-offline-outline'}
          title={
            status === 404
              ? t.player.notFound
              : status === 409
                ? t.player.stillPreparing
                : t.player.loadFailed
          }
          text={status === 404 ? undefined : t.common.tryAgain}
          alert
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel={t.player.loading} color={c.mutedForeground} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 32 },
  details: { gap: 6, paddingHorizontal: 20, paddingTop: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 28,
    paddingTop: 8,
  },
  facts: { fontSize: 15, lineHeight: 21, fontVariant: ['tabular-nums'] },
  actions: { gap: 10, marginTop: 20 },
});
