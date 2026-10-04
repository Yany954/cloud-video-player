/* eslint-disable @next/next/no-img-element -- posters are signed, time-limited CloudFront
   links that change on every request, so the Next.js image optimizer could not cache them. */
import type { VideoResponse } from '@cvp/shared';
import { Film, Play } from 'lucide-react';
import Link from 'next/link';
import { formatBytes, formatDuration } from '@/lib/format';
import { videoStatusLabel } from '@/lib/video/status';

interface VideoListProps {
  /** Unique on the page: it ties the heading to the section. */
  id: string;
  title: string;
  /** null while loading. */
  videos: VideoResponse[] | null;
  failed: boolean;
  errorText: string;
  empty: { title: string; text: string };
  /** Which list the player's "back" link returns to. */
  from?: string;
  /** Where a playable row leads, when it is not the single-video player. */
  hrefFor?: (video: VideoResponse) => string;
  /** Where each video is in its life. Pointless in a list where all share one status. */
  showStatus?: boolean;
  /** Extra controls at the end of each row. */
  renderActions?: (video: VideoResponse) => React.ReactNode;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export function VideoList({
  id,
  title,
  videos,
  failed,
  errorText,
  empty,
  from,
  hrefFor,
  showStatus = false,
  renderActions,
}: VideoListProps) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="text-base font-semibold tracking-tight">
        {title}
      </h2>
      {failed ? (
        <p role="alert" className="text-destructive text-sm">
          {errorText}
        </p>
      ) : videos === null ? (
        <div aria-busy="true" aria-label={`Loading: ${title}`} className="grid gap-3">
          <div className="bg-muted h-20 animate-pulse rounded-3xl motion-reduce:animate-none" />
          <div className="bg-muted h-20 animate-pulse rounded-3xl motion-reduce:animate-none" />
        </div>
      ) : videos.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-3xl border px-6 py-10 text-center">
          <Film aria-hidden className="text-muted-foreground size-7" strokeWidth={1.5} />
          <p className="font-medium">{empty.title}</p>
          <p className="text-muted-foreground text-sm">{empty.text}</p>
        </div>
      ) : (
        <ul className="bg-card divide-y overflow-hidden rounded-3xl border">
          {videos.map((video) => (
            <li key={video.id} className="flex flex-wrap items-center">
              <VideoRow
                video={video}
                href={hrefFor?.(video) ?? `/videos/${video.id}${from ? `?from=${from}` : ''}`}
                showStatus={showStatus}
              />
              {renderActions && (
                <div className="flex w-full gap-2 px-4 pb-3 sm:w-auto sm:py-3 sm:pr-5 sm:pl-0">
                  {renderActions(video)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VideoRow({
  video,
  href,
  showStatus,
}: {
  video: VideoResponse;
  href: string;
  showStatus: boolean;
}) {
  const playable = video.uploadStatus === 'ready';
  const content = (
    <>
      <span className="bg-muted relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {video.posterUrl ? (
          // Decorative: the title next to it already names the video.
          <img
            src={video.posterUrl}
            alt=""
            width={56}
            height={56}
            loading="lazy"
            className="size-full object-cover"
          />
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
      {showStatus && (
        <span className="bg-secondary text-secondary-foreground shrink-0 rounded-lg px-2.5 py-1 text-sm">
          {videoStatusLabel(video)}
        </span>
      )}
    </>
  );
  const layout = 'flex min-w-0 flex-1 items-center gap-4 px-4 py-3 sm:px-5';

  return playable ? (
    <Link
      href={href}
      aria-label={`Play ${video.title}`}
      className={`${layout} group hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-ring/50 outline-none focus-visible:ring-3 focus-visible:ring-inset`}
    >
      {content}
    </Link>
  ) : (
    <div className={layout}>{content}</div>
  );
}
