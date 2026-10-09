import type { PlaybackResponse } from '@cvp/shared';
import { ApiError } from '@cvp/upload-client';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui';
import { Message } from '@/components/video-list';
import { VideoStage } from '@/components/video-stage';
import { useI18n } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { nextId, previousId, readAutoplay, startingId, writeAutoplay } from '@/lib/event/playlist';
import { formatDuration } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { MIN_TOUCH, useColors } from '@/theme';

/**
 * Plays an event from one video to the next. There is a single player for the whole list, so
 * Picture-in-Picture and locked-screen playback carry on across videos.
 */
export default function PlayEventScreen() {
  const { eventId, start } = useLocalSearchParams<{ eventId: string; start?: string }>();
  const { t } = useI18n();
  const p = t.playlist;
  const c = useColors();
  const detail = useLoad(useCallback(() => api.getEvent(eventId), [eventId]));

  const videos = useMemo(
    () => (detail.data?.videos ?? []).filter((video) => video.uploadStatus === 'ready'),
    [detail.data],
  );
  const ids = useMemo(() => videos.map((video) => video.id), [videos]);

  const [chosenId, setChosenId] = useState<string | null>(null);
  // Until the viewer picks one: the video asked for, else the first.
  const currentId =
    chosenId !== null && ids.includes(chosenId) ? chosenId : startingId(ids, start ?? null);
  const upNext = nextId(ids, currentId);
  const before = previousId(ids, currentId);

  const [playbacks, setPlaybacks] = useState<Record<string, PlaybackResponse | 'failed'>>({});
  const prepare = useCallback((videoId: string | null) => {
    if (videoId === null) return;
    setPlaybacks((known) => {
      if (known[videoId]) return known;
      api.getPlayback(videoId).then(
        (playback) => setPlaybacks((now) => ({ ...now, [videoId]: playback })),
        () => setPlaybacks((now) => ({ ...now, [videoId]: 'failed' })),
      );
      return known;
    });
  }, []);
  // The current video's links, and the next one's ahead of time so the change is quick.
  useEffect(() => {
    prepare(currentId);
    prepare(upNext);
  }, [prepare, currentId, upNext]);

  const [autoplay, setAutoplay] = useState(true);
  useEffect(() => {
    void readAutoplay().then(setAutoplay);
  }, []);

  if (detail.error instanceof ApiError && detail.error.status === 404) {
    return <Notice title={p.notFound} />;
  }
  if (detail.failed && !detail.data) return <Notice title={p.loadFailed} />;
  if (!detail.data) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator accessibilityLabel={t.common.loading} color={c.mutedForeground} />
      </View>
    );
  }
  if (currentId === null)
    return <Notice title={p.empty} icon="film-outline" name={detail.data.event.name} />;

  const current = playbacks[currentId];
  const source = current && current !== 'failed' ? current : null;
  const position = ids.indexOf(currentId) + 1;
  const title = videos[position - 1]?.title ?? '';

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: detail.data.event.name }} />
      {source ? (
        <VideoStage
          playback={source}
          onEnded={() => {
            if (autoplay && upNext !== null) setChosenId(upNext);
          }}
        />
      ) : (
        <View style={[styles.stage, { backgroundColor: '#000000' }]}>
          {current === 'failed' ? (
            <Text accessibilityRole="alert" style={styles.stageText}>
              {p.videoFailed}
            </Text>
          ) : (
            <ActivityIndicator accessibilityLabel={t.player.loading} color="#FFFFFF" />
          )}
        </View>
      )}

      <View style={styles.details}>
        <Text accessibilityRole="header" style={[styles.title, { color: c.foreground }]}>
          {title}
        </Text>
        <Text
          testID="position"
          accessibilityLiveRegion="polite"
          style={[styles.facts, { color: c.mutedForeground }]}
        >
          {p.position(position, ids.length)}
          {source ? `, ${formatDuration(source.durationSeconds)}` : ''}
        </Text>

        <View style={styles.buttons}>
          <View style={styles.grow}>
            <Button
              testID="previous"
              variant="outline"
              label={p.previous}
              disabled={before === null}
              onPress={() => setChosenId(before)}
            />
          </View>
          <View style={styles.grow}>
            <Button
              testID="next"
              variant="outline"
              label={p.next}
              disabled={upNext === null}
              onPress={() => setChosenId(upNext)}
            />
          </View>
        </View>

        <View style={styles.autoplay}>
          <View style={styles.grow}>
            <Text style={[styles.label, { color: c.foreground }]}>{p.autoplay}</Text>
            <Text style={[styles.facts, { color: c.mutedForeground }]}>
              {autoplay ? p.autoplayOn : p.autoplayOff}
            </Text>
          </View>
          <Switch
            testID="autoplay"
            accessibilityLabel={p.autoplay}
            value={autoplay}
            onValueChange={(on) => {
              setAutoplay(on);
              void writeAutoplay(on);
            }}
            trackColor={{ true: c.primary }}
          />
        </View>

        <Text accessibilityRole="header" style={[styles.section, { color: c.foreground }]}>
          {p.listTitle}
        </Text>
        {videos.map((video, index) => {
          const playing = video.id === currentId;
          return (
            <Pressable
              key={video.id}
              testID={`queue-${index + 1}`}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}. ${video.title}${playing ? `, ${p.playing}` : ''}`}
              accessibilityState={{ selected: playing }}
              onPress={() => setChosenId(video.id)}
              style={({ pressed }) => [
                styles.queueRow,
                playing && { backgroundColor: c.muted },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.number, { color: c.mutedForeground }]}>{index + 1}</Text>
              <Text numberOfLines={2} style={[styles.queueTitle, { color: c.foreground }]}>
                {video.title}
              </Text>
              {playing ? (
                <Ionicons name="volume-medium" size={18} color={c.primary} />
              ) : (
                video.durationSeconds !== null && (
                  <Text style={[styles.facts, { color: c.mutedForeground }]}>
                    {formatDuration(video.durationSeconds)}
                  </Text>
                )
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function Notice(props: {
  title: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  name?: string;
}) {
  const c = useColors();
  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ title: props.name ?? '' }} />
      <Message icon={props.icon ?? 'help-circle-outline'} title={props.title} alert={!props.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 32 },
  stage: { height: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  stageText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  details: { gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3, lineHeight: 28 },
  facts: { fontSize: 15, lineHeight: 21, fontVariant: ['tabular-nums'] },
  label: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  section: { fontSize: 17, fontWeight: '600', marginTop: 12 },
  buttons: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  autoplay: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  queueRow: {
    minHeight: MIN_TOUCH + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  number: { width: 22, fontSize: 15, fontVariant: ['tabular-nums'], textAlign: 'right' },
  queueTitle: { flex: 1, fontSize: 16, lineHeight: 21 },
});
