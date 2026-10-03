'use client';

import type { StorageUsageResponse, VideoResponse } from '@cvp/shared';
import { useCallback, useEffect, useState } from 'react';
import { StorageWidget } from '@/components/storage/storage-widget';
import { VideoList } from '@/components/video/video-list';
import { uploadApi } from '@/lib/api';
import { useUploads } from '@/lib/upload/use-uploads';
import { Dropzone } from './dropzone';
import { UploadList } from './upload-list';

export function UploadPanel({ userId }: { userId: string }) {
  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);
  const [videos, setVideos] = useState<VideoResponse[] | null>(null);
  const [videosFailed, setVideosFailed] = useState(false);

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
        <VideoList videos={videos} failed={videosFailed} />
      </div>
      <StorageWidget usage={usage} />
    </div>
  );
}
