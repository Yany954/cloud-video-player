'use client';

import type { VideoResponse } from '@cvp/shared';
import { useEffect, useState } from 'react';
import { VideoList } from '@/components/video/video-list';
import { uploadApi } from '@/lib/api';

export default function LibraryPage() {
  const [videos, setVideos] = useState<VideoResponse[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    uploadApi.listLibrary().then(
      (response) => active && setVideos(response.videos),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Library</h1>
        <p className="text-muted-foreground text-sm">
          Videos from everyone in the group, once an admin has approved them.
        </p>
      </div>
      <VideoList
        id="library-title"
        title="Approved videos"
        videos={videos}
        failed={failed}
        errorText="The library could not be loaded. Reload the page to try again."
        empty={{
          title: 'Nothing here yet',
          text: 'Approved videos from you and the rest of the group will be listed here.',
        }}
        from="library"
      />
    </div>
  );
}
