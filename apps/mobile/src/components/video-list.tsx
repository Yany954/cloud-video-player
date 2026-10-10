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
  /** Shown under the rows (also when there are none). */
  footer?: React.ReactElement;
  /** Extra controls at the end of a row, e.g. "move up" in an event. */
  renderActions?: (video: VideoResponse, index: number) => React.ReactNode;
  /** Where a playable row leads, when it is not the single-video player. */
  onOpen?: (video: VideoResponse) => void;
  testID?: string;
}

/** A list of videos: pull down to refresh, tap a playable one to watch it. */
export function VideoList({
  state,
  errorText,
  empty,
  showStatus,
  header,
  footer,
  renderActions,
  onOpen,
  testID,
}: VideoListProps) {
  const c = useColors();
  const { t } = useI18n();

  return (
    <FlatList
      testID={testID}
      data={state.data ?? []}
      keyExtractor={(video) => video.id}
      renderItem={({ item, index }) => (
        <VideoRow
          video={item}
          showStatus={!!showStatus}
          actions={renderActions?.(item, index)}
          onOpen={onOpen}
        />
      )}
      ListFooterComponent={footer}
      keyboardShouldPersistTaps="handled"
      // A name being typed in the header or footer stays above the keyboard.
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
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

function VideoRow({
  video,
  showStatus,
  actions,
  onOpen,
}: {
  video: VideoResponse;
  showStatus: boolean;
  actions?: React.ReactNode;
  onOpen?: (video: VideoResponse) => void;
}) {
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
    <View style={styles.rowWithActions}>
      <Pressable
        testID={`video-${video.id}`}
        accessibilityRole={playable ? 'button' : 'text'}
        accessibilityLabel={
          playable
            ? `${t.lists.play(video.title)}, ${facts.join(', ')}${showStatus ? `, ${status}` : ''}`
            : `${video.title}, ${status}`
        }
        disabled={!playable}
        onPress={() =>
          onOpen
            ? onOpen(video)
            : router.push({ pathname: '/videos/[videoId]', params: { videoId: video.id } })
        }
        style={({ pressed }) => [
          styles.row,
          styles.rowMain,
          pressed && { backgroundColor: c.muted },
        ]}
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
        {playable && !actions && <Ionicons name="play" size={18} color={c.mutedForeground} />}
      </Pressable>
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
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
  rowWithActions: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
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
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { alignItems: 'center', gap: 8, paddingHorizontal: 32, paddingVertical: 56 },
  messageTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  messageText: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
});

/** A round icon button for a row: big enough to hit, named for screen readers. */
export function IconButton(props: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress(): void;
  disabled?: boolean;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        (pressed || props.disabled) && { opacity: 0.5 },
        pressed && { backgroundColor: c.muted },
      ]}
    >
      <Ionicons name={props.icon} size={20} color={c.mutedForeground} />
    </Pressable>
  );
}
