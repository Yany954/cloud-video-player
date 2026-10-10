import type { EventResponse } from '@cvp/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText, Field } from '@/components/ui';
import { Message, Placeholder } from '@/components/video-list';
import { useI18n } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { useLoad } from '@/lib/use-load';
import { MIN_TOUCH, useColors } from '@/theme';

/** The person's own events and the ones they were invited to, and making a new one. */
export default function EventsScreen() {
  const { t } = useI18n();
  const c = useColors();
  const router = useRouter();
  const state = useLoad(useCallback(() => api.listEvents(), []));
  /** The name being typed for a new event; null while the form is closed. */
  const [name, setName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  function create() {
    const trimmed = (name ?? '').trim();
    if (trimmed.length === 0) return setCreateError(t.events.nameMissing);
    setCreating(true);
    setCreateError('');
    api.createEvent({ name: trimmed }).then(
      (event) => {
        setCreating(false);
        setName(null);
        router.push({ pathname: '/events/[eventId]', params: { eventId: event.id } });
      },
      () => {
        setCreating(false);
        setCreateError(t.events.createFailed);
      },
    );
  }

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
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive"
      ListHeaderComponent={
        <View style={styles.create}>
          <Text style={[styles.intro, { color: c.mutedForeground }]}>{t.events.intro}</Text>
          {name === null ? (
            <Button testID="new-event" label={t.events.newEvent} onPress={() => setName('')} />
          ) : (
            <>
              <Field
                testID="event-name"
                label={t.events.name}
                placeholder={t.events.namePlaceholder}
                value={name}
                onChangeText={setName}
                maxLength={120}
                autoCapitalize="sentences"
                autoCorrect
                autoFocus
                returnKeyType="done"
                onSubmitEditing={create}
              />
              <ErrorText>{createError}</ErrorText>
              <View style={styles.buttons}>
                <View style={styles.grow}>
                  <Button
                    testID="create-event"
                    label={creating ? t.events.creating : t.events.create}
                    busy={creating}
                    onPress={create}
                  />
                </View>
                <View style={styles.grow}>
                  <Button
                    variant="outline"
                    label={t.common.cancel}
                    disabled={creating}
                    onPress={() => {
                      setName(null);
                      setCreateError('');
                    }}
                  />
                </View>
              </View>
            </>
          )}
        </View>
      }
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
          <Message icon="cloud-offline-outline" title={t.events.loadError} alert />
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
  create: { gap: 12, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  intro: { fontSize: 15, lineHeight: 21 },
  buttons: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
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
