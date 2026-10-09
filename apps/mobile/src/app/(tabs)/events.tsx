import type { EventResponse } from '@cvp/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { Message, Placeholder } from '@/components/video-list';
import { useI18n } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { useLoad } from '@/lib/use-load';
import { MIN_TOUCH, useColors } from '@/theme';

/** The person's own events and the ones they were invited to. Creating one is on the website for now. */
export default function EventsScreen() {
  const { t } = useI18n();
  const c = useColors();
  const router = useRouter();
  const state = useLoad(useCallback(() => api.listEvents(), []));

  const sections = state.data
    ? [
        { title: t.events.mine, data: state.data.mine, empty: t.events.mineEmpty },
        // An empty "invited" section would only be noise.
        ...(state.data.invited.length > 0
          ? [{ title: t.events.invited, data: state.data.invited, empty: '' }]
          : []),
      ]
    : [];

  return (
    <SectionList<EventResponse, (typeof sections)[number]>
      testID="events"
      sections={sections}
      keyExtractor={(event) => event.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={[styles.heading, { color: c.foreground }]}>
          {section.title}
        </Text>
      )}
      renderSectionFooter={({ section }) =>
        section.data.length === 0 ? (
          <Text style={[styles.empty, { color: c.mutedForeground }]}>{section.empty}</Text>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          testID={`event-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={t.events.open(item.name)}
          onPress={() =>
            router.push({ pathname: '/events/[eventId]', params: { eventId: item.id } })
          }
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.muted }]}
        >
          <Ionicons name="albums-outline" size={22} color={c.mutedForeground} />
          <Text numberOfLines={2} style={[styles.name, { color: c.foreground }]}>
            {item.name}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
        </Pressable>
      )}
      ItemSeparatorComponent={() => (
        <View style={[styles.separator, { backgroundColor: c.border }]} />
      )}
      ListEmptyComponent={
        state.failed ? (
          <Message
            icon="cloud-offline-outline"
            title={t.events.loadError}
            text={t.lists.pullToRetry}
            alert
          />
        ) : (
          <Placeholder />
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

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 24 },
  heading: {
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  empty: { fontSize: 15, lineHeight: 21, paddingHorizontal: 20, paddingVertical: 8 },
  row: {
    minHeight: MIN_TOUCH + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '500', lineHeight: 21 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 20 + 22 + 14 },
});
