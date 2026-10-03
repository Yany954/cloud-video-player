import type { VideoResponse } from '@cvp/shared';
import { Film } from 'lucide-react';
import { formatBytes } from '@/lib/format';
import { videoStatusLabel } from '@/lib/video/status';

interface VideoListProps {
  /** null while loading. */
  videos: VideoResponse[] | null;
  failed: boolean;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function VideoList({ videos, failed }: VideoListProps) {
  return (
    <section aria-labelledby="videos-title" className="grid gap-3">
      <h2 id="videos-title" className="text-base font-semibold tracking-tight">
        My videos
      </h2>
      {failed ? (
        <p role="alert" className="text-destructive text-sm">
          Your videos could not be loaded. Reload the page to try again.
        </p>
      ) : videos === null ? (
        <div aria-busy="true" aria-label="Loading videos" className="grid gap-3">
          <div className="bg-muted h-16 animate-pulse rounded-3xl motion-reduce:animate-none" />
          <div className="bg-muted h-16 animate-pulse rounded-3xl motion-reduce:animate-none" />
        </div>
      ) : videos.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-3xl border px-6 py-10 text-center">
          <Film aria-hidden className="text-muted-foreground size-7" strokeWidth={1.5} />
          <p className="font-medium">No videos yet</p>
          <p className="text-muted-foreground text-sm">
            The videos you upload will be listed here.
          </p>
        </div>
      ) : (
        <ul className="bg-card divide-y rounded-3xl border">
          {videos.map((video) => (
            <li key={video.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="truncate font-medium" title={video.title}>
                  {video.title}
                </p>
                <p className="text-muted-foreground text-sm tabular-nums">
                  {video.sizeBytes !== null && `${formatBytes(video.sizeBytes)}, `}
                  <time dateTime={video.createdAt}>
                    {dateFormat.format(new Date(video.createdAt))}
                  </time>
                </p>
              </div>
              <span className="bg-secondary text-secondary-foreground shrink-0 rounded-lg px-2.5 py-1 text-sm">
                {videoStatusLabel(video)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
