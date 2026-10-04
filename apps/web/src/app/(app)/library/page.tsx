'use client';

import type { VideoResponse } from '@cvp/shared';
import { useEffect, useState } from 'react';
import { VideoList } from '@/components/video/video-list';
import { uploadApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n-context';

export default function LibraryPage() {
  const [videos, setVideos] = useState<VideoResponse[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { t } = useI18n();

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
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{t.library.title}</h1>
        <p className="text-muted-foreground text-sm">{t.library.intro}</p>
      </div>
      <VideoList
        id="library-title"
        title={t.library.listTitle}
        videos={videos}
        failed={failed}
        errorText={t.library.loadError}
        empty={{
          title: t.library.emptyTitle,
          text: t.library.emptyText,
        }}
        from="library"
      />
    </div>
  );
}
