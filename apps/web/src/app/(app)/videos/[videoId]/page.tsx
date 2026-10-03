'use client';

import type { PlaybackResponse } from '@cvp/shared';
import { ApiError } from '@cvp/upload-client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { uploadApi } from '@/lib/api';
import { formatDuration } from '@/lib/format';

type State =
  | { status: 'loading' }
  | { status: 'ready'; playback: PlaybackResponse }
  | { status: 'error'; message: string };

function loadErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) return 'This video does not exist.';
  if (error instanceof ApiError && error.status === 409) {
    return 'This video is still being prepared. Try again in a moment.';
  }
  return 'The video could not be loaded. Check your connection and reload the page.';
}

export default function WatchPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [cannotPlay, setCannotPlay] = useState(false);

  useEffect(() => {
    let active = true;
    uploadApi.getPlayback(videoId).then(
      (playback) => active && setState({ status: 'ready', playback }),
      (error: unknown) => active && setState({ status: 'error', message: loadErrorMessage(error) }),
    );
    return () => {
      active = false;
    };
  }, [videoId]);

  return (
    <div className="grid gap-6">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex w-fit items-center gap-1.5 rounded-lg text-sm outline-none focus-visible:ring-3"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Your library
      </Link>

      {state.status === 'loading' && (
        <div aria-busy="true" aria-label="Loading video" className="grid gap-4">
          <div className="bg-muted aspect-video animate-pulse rounded-3xl motion-reduce:animate-none" />
          <div className="bg-muted h-7 w-64 animate-pulse rounded-lg motion-reduce:animate-none" />
        </div>
      )}

      {state.status === 'error' && (
        <p role="alert" className="text-destructive">
          {state.message}
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
              This browser could not play the video. Some phone recordings use a format (HEVC) that
              not every browser supports. Try Safari, or a recent version of Chrome or Edge.
            </p>
          )}
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{state.playback.title}</h1>
            <p className="text-muted-foreground text-sm tabular-nums">
              {formatDuration(state.playback.durationSeconds)}, {state.playback.width} x{' '}
              {state.playback.height}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
