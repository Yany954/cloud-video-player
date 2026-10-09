import type { PlaybackResponse } from '@cvp/shared';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/ui';
import { useI18n } from '@/i18n/i18n';
import { useColors } from '@/theme';

const sourceOf = (playback: PlaybackResponse): VideoSource => ({
  uri: playback.videoUrl,
  // What the lock screen and Control Centre show while it plays.
  metadata: { title: playback.title, artwork: playback.posterUrl },
});

interface VideoStageProps {
  playback: PlaybackResponse;
  /** The video played to its end (not: was paused or closed). */
  onEnded?(): void;
}

/**
 * The video itself. One player for as long as this stays on screen: giving it another
 * `playback` swaps the video inside the same player, so an event keeps playing from one video
 * to the next in Picture-in-Picture and with the screen locked.
 */
export function VideoStage({ playback, onEnded }: VideoStageProps) {
  const { t } = useI18n();
  const c = useColors();
  const window = useWindowDimensions();
  const [failed, setFailed] = useState(false);

  const player = useVideoPlayer(sourceOf(playback), (created) => {
    // Sound goes on with the screen locked or the app in the background, with the system's
    // own play/pause controls.
    created.staysActiveInBackground = true;
    created.showNowPlayingNotification = true;
    // A video is not background sound: other apps' audio stops while it plays.
    created.audioMixingMode = 'doNotMix';
    created.play();
  });

  // Another video for the same player. The first one was given when the player was made.
  const shown = useRef(playback.videoUrl);
  useEffect(() => {
    if (shown.current === playback.videoUrl) return;
    shown.current = playback.videoUrl;
    setFailed(false);
    void player.replaceAsync(sourceOf(playback)).then(
      () => player.play(),
      () => setFailed(true),
    );
  }, [playback, player]);

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') setFailed(true);
    if (status === 'readyToPlay') setFailed(false);
  });
  useEventListener(player, 'playToEnd', () => onEnded?.());

  // As large as the screen allows without pushing the title off it: a portrait recording
  // is limited by height, a landscape one by width.
  const ratio =
    playback.width > 0 && playback.height > 0 ? playback.width / playback.height : 16 / 9;
  const height = Math.min(window.width / ratio, window.height * 0.6);

  return (
    <View>
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
      {failed && (
        <View style={styles.failed}>
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={[styles.text, { color: c.destructive }]}
          >
            {t.player.cannotPlay}
          </Text>
          <Button
            variant="outline"
            label={t.player.retry}
            onPress={() => {
              setFailed(false);
              void player.replaceAsync(sourceOf(playback)).then(
                () => player.play(),
                () => setFailed(true),
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Always dark behind a video, in light mode too: bars beside a portrait video look right.
  stage: { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  failed: { gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  text: { fontSize: 15, lineHeight: 21 },
});
