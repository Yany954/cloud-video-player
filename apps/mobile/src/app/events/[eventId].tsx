import { ApiError } from '@cvp/upload-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Message, VideoList } from '@/components/video-list';
import { useI18n } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { useLoad } from '@/lib/use-load';
import { useColors } from '@/theme';

/** One event's videos, in playing order. Play all, adding and reordering come in step 4. */
export default function EventScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { t } = useI18n();
  const c = useColors();
  const detail = useLoad(useCallback(() => api.getEvent(eventId), [eventId]));
  // The list component wants the videos; everything else about loading stays the same.
  const videos = useMemo(() => ({ ...detail, data: detail.data?.videos ?? null }), [detail]);

  const missing = detail.error instanceof ApiError && detail.error.status === 404;
  if (missing) {
    return (
      <View style={[styles.screen, { backgroundColor: c.background }]}>
        <Stack.Screen options={{ title: '' }} />
        <Message icon="help-circle-outline" title={t.event.notFound} alert />
      </View>
    );
  }

  const event = detail.data?.event;
  return (
    <>
      <Stack.Screen options={{ title: event?.name ?? '' }} />
      <VideoList
        testID="event-videos"
        state={videos}
        // A member also sees their own videos that are still waiting for review.
        showStatus={event?.isMember}
        errorText={t.event.loadFailed}
        empty={{ title: t.event.emptyTitle, text: t.event.emptyVisitor }}
        header={
          event && detail.data ? (
            <View style={styles.header}>
              <Text accessibilityRole="header" style={[styles.name, { color: c.foreground }]}>
                {event.name}
              </Text>
              <Text style={[styles.facts, { color: c.mutedForeground }]}>
                {t.events.private}, {t.event.count(detail.data.videos.length)}
              </Text>
            </View>
          ) : undefined
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: 4, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  name: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3, lineHeight: 30 },
  facts: { fontSize: 15, lineHeight: 21 },
});
