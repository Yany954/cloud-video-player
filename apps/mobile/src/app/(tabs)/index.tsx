import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { ErrorText } from '@/components/ui';
import { UploadPanel } from '@/components/upload-panel';
import { IconButton, VideoList } from '@/components/video-list';
import { useI18n } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { useSharedUploads } from '@/lib/upload/uploads-context';
import { useLoad } from '@/lib/use-load';
import { isBeingPrepared } from '@/lib/video/status';

/** Everything the signed-in person uploaded, whatever its state: only they see all of it. */
export default function YourVideosScreen() {
  const { t } = useI18n();
  const u = t.upload;
  const state = useLoad(useCallback(() => api.listVideos().then(({ videos }) => videos), []));
  const [removeError, setRemoveError] = useState('');

  // A video being prepared changes on the server without us doing anything: keep checking.
  const preparing = state.data?.some(isBeingPrepared) ?? false;
  const { reload } = state;
  useEffect(() => {
    if (!preparing) return;
    const timer = setInterval(() => void reload(), 4000);
    return () => clearInterval(timer);
  }, [preparing, reload]);

  // A finished upload is a new video in the list.
  const uploads = useSharedUploads();
  const { finishedCount } = uploads;
  useEffect(() => {
    if (finishedCount > 0) void reload();
  }, [finishedCount, reload]);

  // Uploads this phone is still sending (or will send): their rows are not leftovers.
  const inQueue = new Set(uploads.items.map((item) => item.videoId).filter(Boolean));

  return (
    <VideoList
      testID="your-videos"
      state={state}
      showStatus
      header={
        <>
          <UploadPanel refreshKey={state.data?.length ?? 0} />
          <ErrorText>{removeError}</ErrorText>
        </>
      }
      errorText={t.lists.videosLoadError}
      empty={{ title: t.lists.videosEmptyTitle, text: t.lists.videosEmptyText }}
      renderActions={(video) =>
        // An upload that was never finished and that nothing on this phone will finish
        // (started on another device, or its prepared file is gone): it can only be removed.
        video.uploadStatus === 'uploading' && uploads.ready && !inQueue.has(video.id) ? (
          <IconButton
            testID={`remove-unfinished-${video.title}`}
            icon="close"
            label={u.removeUnfinished(video.title)}
            onPress={() =>
              Alert.alert(u.removeUnfinishedTitle, u.removeUnfinishedText(video.title), [
                { text: t.common.cancel, style: 'cancel' },
                {
                  text: u.removeUnfinishedConfirm,
                  style: 'destructive',
                  onPress: () => {
                    setRemoveError('');
                    api.abort(video.id).then(
                      () => void reload(),
                      () => setRemoveError(`${u.removeUnfinishedFailed} ${t.common.tryAgain}`),
                    );
                  },
                },
              ])
            }
          />
        ) : null
      }
    />
  );
}
