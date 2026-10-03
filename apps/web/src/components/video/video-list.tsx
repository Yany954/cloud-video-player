/* eslint-disable @next/next/no-img-element -- posters are signed, time-limited CloudFront
   links that change on every request, so the Next.js image optimizer could not cache them. */
import type { VideoResponse } from '@cvp/shared';
import { Film, Play } from 'lucide-react';
import Link from 'next/link';
import { formatBytes, formatDuration } from '@/lib/format';
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
          <div className="bg-muted h-20 animate-pulse rounded-3xl motion-reduce:animate-none" />
          <div className="bg-muted h-20 animate-pulse rounded-3xl motion-reduce:animate-none" />
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
        <ul className="bg-card divide-y overflow-hidden rounded-3xl border">
          {videos.map((video) => (
            <li key={video.id}>
              <VideoRow video={video} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VideoRow({ video }: { video: VideoResponse }) {
  const playable = video.uploadStatus === 'ready';
  const content = (
    <>
      <span className="bg-muted relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {video.posterUrl ? (
          // Decorative: the title next to it already names the video.
          <img src={video.posterUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <Film aria-hidden className="text-muted-foreground size-5" strokeWidth={1.5} />
        )}
        {playable && (
          <span className="bg-stage/55 text-stage-foreground absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
            <Play aria-hidden className="size-5 fill-current" />
          </span>
        )}
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-medium" title={video.title}>
          {video.title}
        </span>
        <span className="text-muted-foreground text-sm tabular-nums">
          {video.durationSeconds !== null && `${formatDuration(video.durationSeconds)}, `}
          {video.sizeBytes !== null && `${formatBytes(video.sizeBytes)}, `}
          <time dateTime={video.createdAt}>{dateFormat.format(new Date(video.createdAt))}</time>
        </span>
      </span>
      <span className="bg-secondary text-secondary-foreground shrink-0 rounded-lg px-2.5 py-1 text-sm">
        {videoStatusLabel(video)}
      </span>
    </>
  );
  const layout = 'flex items-center gap-4 px-4 py-3 sm:px-5';

  return playable ? (
    <Link
      href={`/videos/${video.id}`}
      aria-label={`Play ${video.title}`}
      className={`${layout} group hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-ring/50 outline-none focus-visible:ring-3 focus-visible:ring-inset`}
    >
      {content}
    </Link>
  ) : (
    <div className={layout}>{content}</div>
  );
}
