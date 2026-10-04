'use client';

import type { EventDetailResponse, PlaybackResponse } from '@cvp/shared';
import { ApiError } from '@cvp/upload-client';
import { ArrowLeft, SkipBack, SkipForward } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { uploadApi } from '@/lib/api';
import { nextId, previousId, readAutoplay, startingId, writeAutoplay } from '@/lib/event/playlist';
import { formatDuration } from '@/lib/format';
import { useI18n } from '@/lib/i18n/i18n-context';

/**
 * Plays an event from one video to the next. There is a single <video> element for the whole
 * list and only its source changes, so Picture-in-Picture and full screen survive the change
 * of video. The current video is in the query string (?v=), updated without a navigation.
 */
export default function PlayEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { t } = useI18n();
  const p = t.playlist;
  const player = useRef<HTMLVideoElement>(null);
  /** True when the next source should start by itself (autoplay, or the viewer pressed Next). */
  const startWhenLoaded = useRef(false);
  const requested = useRef(new Set<string>());

  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  /** Which problem it was; the text is chosen when shown, in the current language. */
  const [loadError, setLoadError] = useState<'' | 'notFound' | 'loadFailed'>('');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [playbacks, setPlaybacks] = useState<Record<string, PlaybackResponse | 'failed'>>({});
  // This page only renders in the browser, after sign-in, so reading storage here is safe.
  const [autoplay, setAutoplay] = useState(() => readAutoplay(window.localStorage));
  const [cannotPlay, setCannotPlay] = useState(false);

  const videos = useMemo(
    () => detail?.videos.filter((video) => video.uploadStatus === 'ready') ?? [],
    [detail],
  );
  const ids = useMemo(() => videos.map((video) => video.id), [videos]);
  const upNext = nextId(ids, currentId);
  const before = previousId(ids, currentId);

  useEffect(() => {
    let active = true;
    uploadApi.getEvent(eventId).then(
      (loaded) => {
        if (!active) return;
        const playable = loaded.videos.filter((video) => video.uploadStatus === 'ready');
        setDetail(loaded);
        setCurrentId(
          startingId(
            playable.map((video) => video.id),
            new URLSearchParams(window.location.search).get('v'),
          ),
        );
      },
      (caught: unknown) =>
        active &&
        setLoadError(
          caught instanceof ApiError && caught.status === 404 ? 'notFound' : 'loadFailed',
        ),
    );
    return () => {
      active = false;
    };
  }, [eventId]);

  // Signed links for the current video, and for the next one so the change is immediate.
  const prepare = useCallback((videoId: string | null) => {
    if (videoId === null || requested.current.has(videoId)) return;
    requested.current.add(videoId);
    uploadApi.getPlayback(videoId).then(
      (playback) => setPlaybacks((known) => ({ ...known, [videoId]: playback })),
      () => setPlaybacks((known) => ({ ...known, [videoId]: 'failed' })),
    );
  }, []);
  useEffect(() => {
    prepare(currentId);
    prepare(upNext);
  }, [prepare, currentId, upNext]);

  const go = useCallback((videoId: string | null, start: boolean) => {
    if (videoId === null) return;
    startWhenLoaded.current = start;
    setCannotPlay(false);
    setCurrentId(videoId);
    // Keeps the address shareable and reload-safe without remounting the player.
    window.history.replaceState(null, '', `?v=${encodeURIComponent(videoId)}`);
  }, []);

  const current = currentId === null ? undefined : playbacks[currentId];
  const source = current && current !== 'failed' ? current : null;

  useEffect(() => {
    if (!source || !startWhenLoaded.current) return;
    startWhenLoaded.current = false;
    // Browsers may refuse to start playback that no click asked for; the viewer then presses play.
    player.current?.play().catch(() => {});
  }, [source]);

  // Lock screen, keyboard media keys and the Picture-in-Picture window get the title and
  // working previous/next buttons.
  useEffect(() => {
    if (!source || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: source.title,
      album: detail?.event.name,
      artwork: [{ src: source.posterUrl }],
    });
    navigator.mediaSession.setActionHandler('nexttrack', upNext ? () => go(upNext, true) : null);
    navigator.mediaSession.setActionHandler(
      'previoustrack',
      before ? () => go(before, true) : null,
    );
    return () => {
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
    };
  }, [source, detail, upNext, before, go]);

  const back = (
    <Link
      href={`/events/${eventId}`}
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex w-fit items-center gap-1.5 rounded-lg text-sm outline-none focus-visible:ring-3"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {detail?.event.name ?? p.eventFallback}
    </Link>
  );

  if (loadError) {
    return (
      <div className="grid gap-6">
        {back}
        <p role="alert" className="text-destructive">
          {p[loadError]}
        </p>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="grid gap-6" aria-busy="true" aria-label={t.event.loading}>
        {back}
        <div className="bg-muted aspect-video animate-pulse rounded-3xl motion-reduce:animate-none" />
      </div>
    );
  }
  if (currentId === null) {
    return (
      <div className="grid gap-6">
        {back}
        <p className="text-muted-foreground">{p.empty}</p>
      </div>
    );
  }

  const position = ids.indexOf(currentId) + 1;
  const title = videos[position - 1]?.title ?? '';

  return (
    <div className="grid gap-6">
      {back}

      {/* One element for the whole event: only its source changes between videos. */}
      <div className="bg-stage flex justify-center overflow-hidden rounded-3xl">
        <video
          ref={player}
          controls
          playsInline
          preload="metadata"
          poster={source?.posterUrl}
          src={source?.videoUrl}
          onEnded={() => autoplay && go(upNext, true)}
          onError={() => source && setCannotPlay(true)}
          aria-label={title}
          style={{ aspectRatio: source ? `${source.width} / ${source.height}` : '16 / 9' }}
          className="max-h-[75dvh] max-w-full"
        />
      </div>
      {current === 'failed' && (
        <p role="alert" className="text-destructive text-sm">
          {p.videoFailed}
        </p>
      )}
      {cannotPlay && (
        <p role="alert" className="text-destructive text-sm">
          {t.player.cannotPlay}
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance break-words">
            {title}
          </h1>
          <p className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
            {p.position(position, ids.length)}
            {source && `, ${formatDuration(source.durationSeconds)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="lg"
            disabled={before === null}
            onClick={() => go(before, true)}
          >
            <SkipBack aria-hidden />
            {p.previous}
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={upNext === null}
            onClick={() => go(upNext, true)}
          >
            {p.next}
            <SkipForward aria-hidden />
          </Button>
        </div>
      </div>

      <Link
        href={`/videos/${currentId}?from=event-${eventId}`}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 w-fit rounded-lg text-sm underline underline-offset-4 outline-none focus-visible:ring-3"
      >
        {p.manage}
      </Link>

      <AutoplaySwitch
        on={autoplay}
        onChange={(on) => {
          setAutoplay(on);
          writeAutoplay(window.localStorage, on);
        }}
      />

      <section aria-labelledby="playlist-title" className="grid gap-3">
        <h2 id="playlist-title" className="text-base font-semibold tracking-tight">
          {p.listTitle}
        </h2>
        <ol className="bg-card divide-y overflow-hidden rounded-3xl border">
          {videos.map((video, index) => {
            const playing = video.id === currentId;
            return (
              <li key={video.id}>
                <button
                  type="button"
                  onClick={() => go(video.id, true)}
                  aria-current={playing ? 'true' : undefined}
                  className={`hover:bg-muted/60 focus-visible:ring-ring/50 flex w-full items-center gap-4 px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-inset sm:px-5 ${
                    playing ? 'bg-muted' : ''
                  }`}
                >
                  <span className="text-muted-foreground w-6 shrink-0 text-right text-sm tabular-nums">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium" title={video.title}>
                    {video.title}
                  </span>
                  {playing && (
                    <span className="text-primary shrink-0 text-sm font-medium">{p.playing}</span>
                  )}
                  {video.durationSeconds !== null && (
                    <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                      {formatDuration(video.durationSeconds)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function AutoplaySwitch({ on, onChange }: { on: boolean; onChange(on: boolean): void }) {
  const p = useI18n().t.playlist;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        id="autoplay-next"
        aria-checked={on}
        aria-describedby="autoplay-next-hint"
        onClick={() => onChange(!on)}
        className={`focus-visible:ring-ring/50 relative h-7 w-12 shrink-0 rounded-full border transition-colors outline-none focus-visible:ring-3 motion-reduce:transition-none ${
          on ? 'bg-primary border-primary' : 'bg-muted border-input'
        }`}
      >
        <span
          aria-hidden
          className={`bg-background absolute top-0.5 left-0.5 size-[1.375rem] rounded-full shadow-sm transition-transform motion-reduce:transition-none ${
            on ? 'translate-x-5' : ''
          }`}
        />
      </button>
      <div className="grid">
        <label htmlFor="autoplay-next" className="text-sm font-medium">
          {p.autoplay}
        </label>
        <span id="autoplay-next-hint" className="text-muted-foreground text-sm">
          {on ? p.autoplayOn : p.autoplayOff}
        </span>
      </div>
    </div>
  );
}
