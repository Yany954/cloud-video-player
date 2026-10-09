import type { VideoResponse } from '@cvp/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n/i18n';
import { formatBytes, formatDuration } from '@/lib/format';
import type { Loaded } from '@/lib/use-load';
import { videoStatusLabel } from '@/lib/video/status';
import { MIN_TOUCH, radius, useColors } from '@/theme';

interface VideoListProps {
  state: Loaded<VideoResponse[]>;
  errorText: string;
  empty: { title: string; text: string };
  /** Where each video is in its life. Pointless in a list where all are ready to watch. */
  showStatus?: boolean;
  /** Shown above the rows, e.g. an explanation or an event's name. */
  header?: React.ReactElement;
  testID?: string;
}

/** A list of videos: pull down to refresh, tap a playable one to watch it. */
export function VideoList({ state, errorText, empty, showStatus, header, testID }: VideoListProps) {
  const c = useColors();
  const { t } = useI18n();

  return (
    <FlatList
      testID={testID}
      data={state.data ?? []}
      keyExtractor={(video) => video.id}
      renderItem={({ item }) => <VideoRow video={item} showStatus={!!showStatus} />}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: c.border }]} />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        state.data === null && !state.failed ? (
          <Placeholder />
        ) : state.failed ? (
          <Message
            icon="cloud-offline-outline"
            title={errorText}
            text={t.lists.pullToRetry}
            alert
          />
        ) : (
          <Message icon="film-outline" title={empty.title} text={empty.text} />
        )
      }
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={state.refresh}
          tintColor={c.mutedForeground}
        />
      }
      contentContainerStyle={styles.content}
      style={{ backgroundColor: c.background }}
    />
  );
}

function VideoRow({ video, showStatus }: { video: VideoResponse; showStatus: boolean }) {
  const c = useColors();
  const { t, locale } = useI18n();
  const router = useRouter();
  const playable = video.uploadStatus === 'ready';
  const date = new Date(video.createdAt).toLocaleDateString(locale, { dateStyle: 'medium' });
  const facts = [
    video.durationSeconds !== null && formatDuration(video.durationSeconds),
    video.sizeBytes !== null && formatBytes(video.sizeBytes, locale),
    date,
  ].filter(Boolean);
  const status = videoStatusLabel(video, t.videoStatus);

  return (
    <Pressable
      testID={`video-${video.id}`}
      accessibilityRole={playable ? 'button' : 'text'}
      accessibilityLabel={
        playable
          ? `${t.lists.play(video.title)}, ${facts.join(', ')}${showStatus ? `, ${status}` : ''}`
          : `${video.title}, ${status}`
      }
      disabled={!playable}
      onPress={() => router.push({ pathname: '/videos/[videoId]', params: { videoId: video.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.muted }]}
    >
      <View style={[styles.poster, { backgroundColor: c.muted }]}>
        {video.posterUrl ? (
          // Decorative: the title beside it names the video.
          <Image
            source={{ uri: video.posterUrl }}
            style={styles.posterImage}
            contentFit="cover"
            accessible={false}
            // The link is signed again on every request; the picture itself does not change.
            cachePolicy="memory-disk"
            recyclingKey={video.id}
          />
        ) : (
          <Ionicons name="film-outline" size={22} color={c.mutedForeground} />
        )}
      </View>
      <View style={styles.text}>
        <Text numberOfLines={2} style={[styles.title, { color: c.foreground }]}>
          {video.title}
        </Text>
        <Text style={[styles.facts, { color: c.mutedForeground }]}>{facts.join(', ')}</Text>
        {(showStatus || !playable) && (
          <Text style={[styles.facts, { color: c.mutedForeground }]}>{status}</Text>
        )}
      </View>
      {playable && <Ionicons name="play" size={18} color={c.mutedForeground} />}
    </Pressable>
  );
}

export function Message(props: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  text?: string;
  /** Announce it at once: something went wrong. */
  alert?: boolean;
}) {
  const c = useColors();
  return (
    <View
      style={styles.message}
      accessibilityRole={props.alert ? 'alert' : undefined}
      accessibilityLiveRegion={props.alert ? 'assertive' : undefined}
    >
      <Ionicons name={props.icon} size={30} color={c.mutedForeground} />
      <Text style={[styles.messageTitle, { color: props.alert ? c.destructive : c.foreground }]}>
        {props.title}
      </Text>
      {props.text && (
        <Text style={[styles.messageText, { color: c.mutedForeground }]}>{props.text}</Text>
      )}
    </View>
  );
}

/** Quiet grey rows while the first answer is on its way. */
export function Placeholder() {
  const c = useColors();
  const { t } = useI18n();
  return (
    <View accessibilityLabel={t.common.loading} accessibilityState={{ busy: true }}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.row}>
          <View style={[styles.poster, { backgroundColor: c.muted }]} />
          <View style={styles.text}>
            <View style={[styles.bar, { backgroundColor: c.muted, width: '70%' }]} />
            <View style={[styles.bar, { backgroundColor: c.muted, width: '45%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 24 },
  row: {
    minHeight: MIN_TOUCH + 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 20 + 64 + 14 },
  poster: {
    width: 64,
    height: 64,
    borderRadius: radius.control,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterImage: { width: '100%', height: '100%' },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  facts: { fontSize: 14, lineHeight: 19, fontVariant: ['tabular-nums'] },
  bar: { height: 12, borderRadius: 6 },
  message: { alignItems: 'center', gap: 8, paddingHorizontal: 32, paddingVertical: 56 },
  messageTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  messageText: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
});
