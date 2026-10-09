import type { PlaybackResponse } from '@cvp/shared';
import { ApiError } from '@cvp/upload-client';
import { useEventListener } from 'expo';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button } from '@/components/ui';
import { Message } from '@/components/video-list';
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
  // Asked for again each time the screen is opened: the links in the answer expire.
  const state = useLoad(useCallback(() => api.getPlayback(videoId), [videoId]));

  const status = state.error instanceof ApiError ? state.error.status : null;
  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ title: state.data?.title ?? '' }} />
      {state.data ? (
        // A new player for a new answer, so fresh links are always used.
        <Player key={state.data.expiresAt} playback={state.data} />
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

function Player({ playback }: { playback: PlaybackResponse }) {
  const { t } = useI18n();
  const c = useColors();
  const window = useWindowDimensions();
  const [failed, setFailed] = useState(false);

  const player = useVideoPlayer(
    {
      uri: playback.videoUrl,
      // What the lock screen and Control Centre show while it plays.
      metadata: { title: playback.title, artwork: playback.posterUrl },
    },
    (created) => {
      // Sound goes on with the screen locked or the app in the background, with the
      // system's own play/pause controls.
      created.staysActiveInBackground = true;
      created.showNowPlayingNotification = true;
      // A video is not background sound: other apps' audio stops while it plays.
      created.audioMixingMode = 'doNotMix';
      created.play();
    },
  );

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') setFailed(true);
    if (status === 'readyToPlay') setFailed(false);
  });

  // As large as the screen allows without pushing the title off it: a portrait recording
  // is limited by height, a landscape one by width.
  const ratio =
    playback.width > 0 && playback.height > 0 ? playback.width / playback.height : 16 / 9;
  const maxHeight = window.height * 0.62;
  const height = Math.min(window.width / ratio, maxHeight);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.stage, { height }]}>
        <VideoView
          testID="video"
          player={player}
          style={{ width: Math.min(window.width, height * ratio), height }}
          contentFit="contain"
          nativeControls
          fullscreenOptions={{ enable: true }}
          allowsPictureInPicture
          // Leaving the app while it plays shrinks the video into a floating window.
          startsPictureInPictureAutomatically
          accessibilityLabel={playback.title}
        />
      </View>
      <View style={styles.details}>
        <Text accessibilityRole="header" style={[styles.title, { color: c.foreground }]}>
          {playback.title}
        </Text>
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
        {failed && (
          <View style={styles.failed}>
            <Text
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={[styles.facts, { color: c.destructive }]}
            >
              {t.player.cannotPlay}
            </Text>
            <Button
              variant="outline"
              label={t.player.retry}
              onPress={() => {
                setFailed(false);
                void player
                  .replaceAsync({
                    uri: playback.videoUrl,
                    metadata: { title: playback.title, artwork: playback.posterUrl },
                  })
                  .then(() => player.play());
              }}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 32 },
  // Always dark behind a video, in light mode too: bars beside a portrait video look right.
  stage: { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  details: { gap: 6, paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3, lineHeight: 28 },
  facts: { fontSize: 15, lineHeight: 21, fontVariant: ['tabular-nums'] },
  failed: { gap: 12, marginTop: 8 },
});
