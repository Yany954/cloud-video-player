'use client';

import type { StorageUsageResponse, VideoResponse } from '@cvp/shared';
import { useCallback, useEffect, useState } from 'react';
import { DeleteVideoButton } from '@/components/video/delete-video-button';
import { StorageWidget } from '@/components/storage/storage-widget';
import { VideoList } from '@/components/video/video-list';
import { uploadApi } from '@/lib/api';
import { useUploads } from '@/lib/upload/use-uploads';
import { isBeingPrepared } from '@/lib/video/status';
import { Dropzone } from './dropzone';
import { UploadList } from './upload-list';

export function UploadPanel({ userId }: { userId: string }) {
  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);
  const [videos, setVideos] = useState<VideoResponse[] | null>(null);
  const [videosFailed, setVideosFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // Runs on load and again after every finished upload.
  const refresh = useCallback(() => {
    uploadApi.getStorageUsage().then(setUsage, () => {});
    uploadApi.listVideos().then(
      (response) => {
        setVideos(response.videos);
        setVideosFailed(false);
      },
      () => setVideosFailed(true),
    );
  }, []);
  useEffect(refresh, [refresh]);

  // A video being prepared changes on the server without us doing anything: keep checking.
  const preparing = videos?.some(isBeingPrepared) ?? false;
  useEffect(() => {
    if (!preparing) return;
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [preparing, refresh]);

  const uploads = useUploads(userId, refresh);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="grid gap-8">
        <Dropzone onFiles={uploads.add} />
        <UploadList
          items={uploads.items}
          onPause={uploads.pause}
          onResume={uploads.resume}
          onCancel={uploads.cancel}
          onDismiss={uploads.dismiss}
        />
        <div className="grid gap-3 empty:hidden">
          {/* Always rendered, never display:none, so screen readers announce each change. */}
          <p role="status" className="text-sm empty:sr-only">
            {notice}
          </p>
          {deleteError && (
            <p role="alert" className="text-destructive text-sm">
              {deleteError}
            </p>
          )}
        </div>
        <VideoList
          id="my-videos-title"
          title="My videos"
          videos={videos}
          failed={videosFailed}
          errorText="Your videos could not be loaded. Reload the page to try again."
          empty={{ title: 'No videos yet', text: 'The videos you upload will be listed here.' }}
          showStatus
          renderActions={(video) =>
            // Not while it is still uploading or being prepared: those are still changing.
            (video.uploadStatus === 'ready' || video.uploadStatus === 'failed') && (
              <DeleteVideoButton
                video={video}
                iconOnly
                onDeleted={() => {
                  setDeleteError('');
                  setNotice(`“${video.title}” was deleted.`);
                  setVideos((current) => current?.filter((item) => item.id !== video.id) ?? null);
                  refresh();
                }}
                onError={(message) => {
                  setNotice('');
                  setDeleteError(message);
                }}
              />
            )
          }
        />
      </div>
      <StorageWidget usage={usage} />
    </div>
  );
}
