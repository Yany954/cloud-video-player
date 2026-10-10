import type { EventResponse, StorageUsageResponse } from '@cvp/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText } from '@/components/ui';
import { IconButton } from '@/components/video-list';
import { useI18n } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { env } from '@/lib/env';
import { formatBytes, formatDuration } from '@/lib/format';
import { chooseVideos, PermissionDeniedError, recordVideo } from '@/lib/upload/pick';
import type { UploadSource } from '@/lib/upload/source';
import { useSharedUploads } from '@/lib/upload/uploads-context';
import type { UploadItem } from '@/lib/upload/use-uploads';
import { radius, useColors } from '@/theme';

/** Choosing or recording videos, which event they go into, and the uploads in progress. */
export function UploadPanel({ refreshKey }: { refreshKey: number }) {
  const { t, locale } = useI18n();
  const u = t.upload;
  const c = useColors();
  const uploads = useSharedUploads();
  const [busy, setBusy] = useState<'choose' | 'record' | null>(null);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);
  /** Events the person may add videos to: their own and the ones they were invited to. */
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [choosingEvent, setChoosingEvent] = useState(false);

  // Storage changes with every finished upload and every deleted video.
  useEffect(() => {
    let active = true;
    api.getStorageUsage().then(
      (value) => active && setUsage(value),
      () => {},
    );
    api.listEvents().then(
      ({ mine, invited }) => active && setEvents([...mine, ...invited]),
      // Uploading without an event still works.
      () => {},
    );
    return () => {
      active = false;
    };
  }, [refreshKey, uploads.finishedCount]);

  const event = events.find((item) => item.id === eventId) ?? null;

  async function pick(kind: 'choose' | 'record', get: () => Promise<UploadSource[]>) {
    setBusy(kind);
    setError('');
    try {
      const sources = await get();
      uploads.add(sources, event?.id);
    } catch (caught) {
      setError(caught instanceof PermissionDeniedError ? u.cameraDenied : u.pickFailed);
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={[styles.text, { color: c.mutedForeground }]}>{u.formats}</Text>
      <View style={styles.buttons}>
        <View style={styles.grow}>
          <Button
            testID="choose-videos"
            label={u.choose}
            busy={busy === 'choose'}
            disabled={busy !== null || !uploads.ready}
            onPress={() => void pick('choose', chooseVideos)}
          />
        </View>
        <View style={styles.grow}>
          <Button
            testID="record-video"
            variant="outline"
            label={u.record}
            busy={busy === 'record'}
            disabled={busy !== null || !uploads.ready}
            onPress={() => void pick('record', recordVideo)}
          />
        </View>
      </View>
      <Text style={[styles.small, { color: c.mutedForeground }]}>{u.recordNote}</Text>
      {busy === 'choose' && (
        <View style={styles.inline} accessibilityLiveRegion="polite">
          <ActivityIndicator color={c.mutedForeground} />
          <Text style={[styles.text, styles.grow, { color: c.mutedForeground }]}>{u.wait}</Text>
        </View>
      )}
      {error !== '' && (
        <View style={styles.gap}>
          <ErrorText>{error}</ErrorText>
          {error !== u.pickFailed && (
            <Pressable accessibilityRole="link" onPress={() => void Linking.openSettings()}>
              <Text style={[styles.text, styles.link, { color: c.foreground }]}>
                {u.openSettings}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {events.length > 0 && (
        <View style={styles.gap}>
          <View style={styles.inline}>
            <Text style={[styles.text, styles.grow, { color: c.foreground }]}>
              {u.eventFor(event?.name ?? u.eventNone)}
            </Text>
            <Pressable
              testID="choose-event"
              accessibilityRole="button"
              accessibilityLabel={u.eventLabel}
              accessibilityState={{ expanded: choosingEvent }}
              onPress={() => setChoosingEvent((open) => !open)}
              hitSlop={10}
            >
              <Text style={[styles.text, styles.link, { color: c.foreground }]}>
                {u.eventChange}
              </Text>
            </Pressable>
          </View>
          {choosingEvent &&
            [null, ...events].map((item) => {
              const selected = (item?.id ?? null) === (event?.id ?? null);
              return (
                <Pressable
                  key={item?.id ?? 'none'}
                  testID={`upload-event-${item?.name ?? 'none'}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setEventId(item?.id ?? null);
                    setChoosingEvent(false);
                  }}
                  style={[styles.option, selected && { backgroundColor: c.muted }]}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? c.primary : c.mutedForeground}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.text, styles.grow, { color: c.foreground }]}
                  >
                    {item?.name ?? u.eventNone}
                  </Text>
                </Pressable>
              );
            })}
        </View>
      )}

      {uploads.items.length > 0 && (
        <View style={styles.gap}>
          <Text accessibilityRole="header" style={[styles.heading, { color: c.foreground }]}>
            {u.listTitle}
          </Text>
          <Text style={[styles.small, { color: c.mutedForeground }]}>{u.keepOpen}</Text>
          {uploads.items.map((item) => (
            <UploadRow
              key={item.id}
              item={item}
              onPause={() => confirmPause(item, uploads.pause, u, locale)}
              onResume={() => uploads.resume(item.id)}
              onCancel={() => uploads.cancel(item.id)}
              onDismiss={() => uploads.dismiss(item.id)}
            />
          ))}
        </View>
      )}

      <View style={styles.inline}>
        <Ionicons name="shield-checkmark-outline" size={18} color={c.mutedForeground} />
        <Text style={[styles.small, styles.grow, { color: c.mutedForeground }]}>
          {u.reviewNote}{' '}
          <Text
            accessibilityRole="link"
            accessibilityHint={t.legal.opensInBrowser}
            style={[styles.link, { color: c.foreground }]}
            onPress={() => void WebBrowser.openBrowserAsync(`${env.webUrl}/terms`)}
          >
            {u.reviewRules}
          </Text>
        </Text>
      </View>
      {usage && (
        <Text testID="storage" style={[styles.small, { color: c.mutedForeground }]}>
          {t.storage.title}:{' '}
          {t.storage.usedOf(
            formatBytes(usage.bytesUsed, locale),
            formatBytes(usage.quotaBytes, locale),
          )}
        </Text>
      )}
    </View>
  );
}

/** Pausing asks first, because the parts being sent at that moment are not kept. */
function confirmPause(
  item: UploadItem,
  pause: (id: string) => void,
  u: ReturnType<typeof useI18n>['t']['upload'],
  locale: string,
) {
  const unsaved = Math.max(item.uploadedBytes - item.savedBytes, 0);
  const text =
    unsaved === 0
      ? u.pauseAllSaved
      : u.pauseWarning(formatBytes(unsaved, locale)) +
        (item.savedBytes > 0 ? u.pauseKept(formatBytes(item.savedBytes, locale)) : '');
  Alert.alert(u.pauseTitle, text, [
    { text: u.keepUploading, style: 'cancel' },
    { text: u.pause, onPress: () => pause(item.id) },
  ]);
}

function UploadRow(props: {
  item: UploadItem;
  onPause(): void;
  onResume(): void;
  onCancel(): void;
  onDismiss(): void;
}) {
  const { item } = props;
  const { t, locale } = useI18n();
  const u = t.upload;
  const c = useColors();
  const fraction = item.sizeBytes > 0 ? Math.min(item.uploadedBytes / item.sizeBytes, 1) : 0;
  const percent = Math.floor(fraction * 100);
  const active = item.status === 'uploading' || item.status === 'paused';
  const size = formatBytes(item.sizeBytes, locale);

  return (
    <View
      testID={`upload-${item.status}`}
      style={[styles.row, { borderColor: c.border, backgroundColor: c.card }]}
    >
      <View style={styles.inline}>
        <View style={[styles.thumb, { backgroundColor: c.muted }]}>
          {item.thumbnailUri ? (
            <Image
              source={{ uri: item.thumbnailUri }}
              style={styles.fill}
              contentFit="cover"
              accessible={false}
            />
          ) : (
            <Ionicons name="film-outline" size={20} color={c.mutedForeground} />
          )}
        </View>
        <View style={styles.grow}>
          <Text numberOfLines={1} style={[styles.name, { color: c.foreground }]}>
            {item.fileName}
          </Text>
          <Text style={[styles.small, styles.numbers, { color: c.mutedForeground }]}>
            {item.durationSeconds !== null && `${formatDuration(item.durationSeconds)}, `}
            {active ? u.sentOf(formatBytes(item.uploadedBytes, locale), size) : size}
          </Text>
        </View>
        {item.status === 'uploading' && (
          <IconButton icon="pause" label={u.pauseItem(item.fileName)} onPress={props.onPause} />
        )}
        {(item.status === 'paused' || (item.status === 'error' && item.canResume)) && (
          <IconButton
            testID="resume-upload"
            icon="play"
            label={u.resumeItem(item.fileName)}
            onPress={props.onResume}
          />
        )}
        {item.status === 'done' || !item.canResume ? (
          <IconButton
            testID="dismiss-upload"
            icon="close"
            label={u.dismissItem(item.fileName)}
            onPress={props.onDismiss}
          />
        ) : (
          <IconButton
            testID="cancel-upload"
            icon="close"
            label={u.cancelItem(item.fileName)}
            onPress={props.onCancel}
          />
        )}
      </View>

      {active && (
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={u.progressOf(item.fileName)}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          style={[styles.track, { backgroundColor: c.muted }]}
        >
          <View
            style={[
              styles.bar,
              {
                width: `${fraction * 100}%`,
                backgroundColor: item.status === 'paused' ? c.mutedForeground : c.primary,
              },
            ]}
          />
        </View>
      )}

      <Text
        testID="upload-status"
        accessibilityLiveRegion="polite"
        style={[
          styles.small,
          styles.numbers,
          { color: item.status === 'error' ? c.destructive : c.mutedForeground },
        ]}
      >
        {item.status === 'uploading' && u.uploading(percent)}
        {item.status === 'paused' && u.pausedAt(percent)}
        {item.status === 'done' && u.done}
        {item.status === 'error' && item.error}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 14, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
  buttons: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  gap: { gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 14, lineHeight: 20 },
  numbers: { fontVariant: ['tabular-nums'] },
  link: { textDecorationLine: 'underline' },
  heading: { fontSize: 17, fontWeight: '600', marginTop: 4 },
  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: radius.control,
  },
  row: { gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.control,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { width: '100%', height: '100%' },
  name: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
});
