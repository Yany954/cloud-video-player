import { useCallback, useEffect } from 'react';
import { UploadPanel } from '@/components/upload-panel';
import { VideoList } from '@/components/video-list';
import { useI18n } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { useSharedUploads } from '@/lib/upload/uploads-context';
import { useLoad } from '@/lib/use-load';
import { isBeingPrepared } from '@/lib/video/status';

/** Everything the signed-in person uploaded, whatever its state: only they see all of it. */
export default function YourVideosScreen() {
  const { t } = useI18n();
  const state = useLoad(useCallback(() => api.listVideos().then(({ videos }) => videos), []));

  // A video being prepared changes on the server without us doing anything: keep checking.
  const preparing = state.data?.some(isBeingPrepared) ?? false;
  const { reload } = state;

  // A finished upload is a new video in the list.
  const { finishedCount } = useSharedUploads();
  useEffect(() => {
    if (finishedCount > 0) void reload();
  }, [finishedCount, reload]);
  useEffect(() => {
    if (!preparing) return;
    const timer = setInterval(() => void reload(), 4000);
    return () => clearInterval(timer);
  }, [preparing, reload]);

  return (
    <VideoList
      testID="your-videos"
      state={state}
      showStatus
      header={<UploadPanel refreshKey={state.data?.length ?? 0} />}
      errorText={t.lists.videosLoadError}
      empty={{ title: t.lists.videosEmptyTitle, text: t.lists.videosEmptyText }}
    />
  );
}
