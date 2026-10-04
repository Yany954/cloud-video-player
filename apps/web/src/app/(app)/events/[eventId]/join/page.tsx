'use client';

import { ApiError } from '@cvp/upload-client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { uploadApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n/i18n-context';

/**
 * Where an invite link lands. The app shell has already made sure the visitor is signed in
 * (sending them to the login page and back here if not). The secret is in the URL fragment,
 * which browsers never send to a server.
 */
export default function JoinEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const j = useI18n().t.join;
  /** Which problem it was; the text is chosen when shown, in the current language. */
  const [error, setError] = useState<'' | 'invalid' | 'failed'>('');

  useEffect(() => {
    let active = true;
    const token = window.location.hash.slice(1);
    if (token.length === 0) {
      // Reported asynchronously, like every other outcome of this effect.
      void Promise.resolve().then(() => active && setError('invalid'));
      return () => {
        active = false;
      };
    }
    uploadApi.joinEvent(eventId, token).then(
      () => active && router.replace(`/events/${eventId}`),
      (caught: unknown) =>
        active &&
        setError(
          caught instanceof ApiError && [400, 404, 409].includes(caught.status)
            ? 'invalid'
            : 'failed',
        ),
    );
    return () => {
      active = false;
    };
  }, [eventId, router]);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">{j.title}</h1>
      {error ? (
        <>
          <p role="alert" className="text-destructive">
            {j[error]}
          </p>
          <Link
            href="/events"
            className="text-primary focus-visible:ring-ring/50 w-fit rounded-lg text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3"
          >
            {j.goToEvents}
          </Link>
        </>
      ) : (
        <p role="status" className="text-muted-foreground">
          {j.opening}
        </p>
      )}
    </div>
  );
}
