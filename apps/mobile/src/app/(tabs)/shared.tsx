import { useCallback } from 'react';
import { StyleSheet, Text } from 'react-native';
import { VideoList } from '@/components/video-list';
import { useI18n } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { useLoad } from '@/lib/use-load';
import { useColors } from '@/theme';

/** Other people's approved videos from the events the person owns or was invited to. */
export default function SharedScreen() {
  const { t } = useI18n();
  const c = useColors();
  const state = useLoad(useCallback(() => api.listLibrary().then(({ videos }) => videos), []));

  return (
    <VideoList
      testID="shared-videos"
      state={state}
      errorText={t.lists.sharedLoadError}
      empty={{ title: t.lists.sharedEmptyTitle, text: t.lists.sharedEmptyText }}
      header={
        <Text style={[styles.intro, { color: c.mutedForeground }]}>{t.lists.sharedIntro}</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, lineHeight: 21, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
});
