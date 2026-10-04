'use client';

import type { PlaybackResponse } from '@cvp/shared';
import { ApiError } from '@cvp/upload-client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { DeleteVideoButton } from '@/components/video/delete-video-button';
import { ReportPanel } from '@/components/video/report-panel';
import { ReviewActions } from '@/components/moderation/review-actions';
import { uploadApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { HOME } from '@/lib/auth/return-to';
import { formatDuration } from '@/lib/format';
import { useI18n } from '@/lib/i18n/i18n-context';

type State =
  | { status: 'loading' }
  | { status: 'ready'; playback: PlaybackResponse }
  | { status: 'error'; kind: ReturnType<typeof loadErrorKind> };

/** Which problem it was; the text is chosen when it is shown, in the current language. */
function loadErrorKind(error: unknown): 'notFound' | 'stillPreparing' | 'loadFailed' {
  if (error instanceof ApiError && error.status === 404) return 'notFound';
  if (error instanceof ApiError && error.status === 409) return 'stillPreparing';
  return 'loadFailed';
}

// Where the viewer came from, so "back" returns to the same list.
const BACK_LINKS: Record<string, { href: string; label: 'library' | 'review' }> = {
  library: { href: '/library', label: 'library' },
  review: { href: '/review', label: 'review' },
};

export default function WatchPage() {
  // Reading the query string suspends while the page is prerendered.
  return (
    <Suspense>
      <Watch />
    </Suspense>
  );
}

function Watch() {
  const { videoId } = useParams<{ videoId: string }>();
  const { t } = useI18n();
  const from = useSearchParams().get('from') ?? '';
  // "event-<id>" returns to that event's page.
  const known = BACK_LINKS[from];
  const back = from.startsWith('event-')
    ? {
        href: `/events/${encodeURIComponent(from.slice('event-'.length))}`,
        label: t.player.backEvent,
      }
    : known
      ? { href: known.href, label: t.nav[known.label] }
      : { href: HOME, label: t.nav.yourVideos };
  const auth = useAuth().state;
  const isAdmin = auth.status === 'signedIn' && auth.user.isAdmin;
  const [state, setState] = useState<State>({ status: 'loading' });
  const [cannotPlay, setCannotPlay] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const router = useRouter();

  useEffect(() => {
    let active = true;
    uploadApi.getPlayback(videoId).then(
      (playback) => active && setState({ status: 'ready', playback }),
      (error: unknown) => active && setState({ status: 'error', kind: loadErrorKind(error) }),
    );
    return () => {
      active = false;
    };
  }, [videoId]);

  return (
    <div className="grid gap-6">
      <Link
        href={back.href}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex w-fit items-center gap-1.5 rounded-lg text-sm outline-none focus-visible:ring-3"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {back.label}
      </Link>

      {state.status === 'loading' && (
        <div aria-busy="true" aria-label={t.player.loading} className="grid gap-4">
          <div className="bg-muted aspect-video animate-pulse rounded-3xl motion-reduce:animate-none" />
          <div className="bg-muted h-7 w-64 animate-pulse rounded-lg motion-reduce:animate-none" />
        </div>
      )}

      {state.status === 'error' && (
        <p role="alert" className="text-destructive">
          {t.player[state.kind]}
        </p>
      )}

      {state.status === 'ready' && (
        <>
          {/* The player never waits on anything else: the element and its source render at once. */}
          <div className="bg-stage flex justify-center overflow-hidden rounded-3xl">
            <video
              controls
              playsInline
              preload="metadata"
              poster={state.playback.posterUrl}
              src={state.playback.videoUrl}
              onError={() => setCannotPlay(true)}
              aria-label={state.playback.title}
              style={{ aspectRatio: `${state.playback.width} / ${state.playback.height}` }}
              className="max-h-[75dvh] max-w-full"
            />
          </div>
          {cannotPlay && (
            <p role="alert" className="text-destructive text-sm">
              {t.player.cannotPlay}
            </p>
          )}
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{state.playback.title}</h1>
            <p className="text-muted-foreground text-sm tabular-nums">
              {formatDuration(state.playback.durationSeconds)}, {state.playback.width} x{' '}
              {state.playback.height}
            </p>
          </div>
          {state.playback.canDelete && (
            <div className="grid gap-2">
              <div>
                <DeleteVideoButton
                  video={{ id: videoId, title: state.playback.title }}
                  onDeleted={() => router.replace(back.href)}
                  onError={setDeleteError}
                />
              </div>
              {deleteError && (
                <p role="alert" className="text-destructive text-sm">
                  {deleteError}
                </p>
              )}
            </div>
          )}
          {!state.playback.isMine && (
            <ReportPanel
              video={{ id: videoId, title: state.playback.title }}
              onHidden={() => router.replace(back.href)}
            />
          )}
          {isAdmin && (
            <section
              aria-labelledby="review-heading"
              className="grid gap-3 rounded-3xl border px-5 py-4"
            >
              <div className="grid gap-1">
                <h2 id="review-heading" className="text-base font-semibold tracking-tight">
                  {t.review.title}
                </h2>
                <p role="status" className="text-muted-foreground text-sm">
                  {t.review.status[state.playback.moderationStatus]}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ReviewActions
                  video={{ id: videoId, title: state.playback.title }}
                  status={state.playback.moderationStatus}
                  onReviewed={(video) => {
                    setReviewError('');
                    setState({
                      status: 'ready',
                      playback: { ...state.playback, moderationStatus: video.moderationStatus },
                    });
                  }}
                  onError={setReviewError}
                />
              </div>
              {reviewError && (
                <p role="alert" className="text-destructive text-sm">
                  {reviewError}
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
