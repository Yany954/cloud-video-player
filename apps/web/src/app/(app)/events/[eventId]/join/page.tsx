'use client';

import { ApiError } from '@cvp/upload-client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { uploadApi } from '@/lib/api';

/**
 * Where an invite link lands. The app shell has already made sure the visitor is signed in
 * (sending them to the login page and back here if not). The secret is in the URL fragment,
 * which browsers never send to a server.
 */
export default function JoinEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const token = window.location.hash.slice(1);
    uploadApi.joinEvent(eventId, token).then(
      () => active && router.replace(`/events/${eventId}`),
      (caught: unknown) =>
        active &&
        setError(
          caught instanceof ApiError && [400, 404, 409].includes(caught.status)
            ? 'This invite link is not valid any more. Ask the person who sent it for a new one.'
            : 'The invitation could not be opened. Check your connection and reload the page.',
        ),
    );
    return () => {
      active = false;
    };
  }, [eventId, router]);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">Event invitation</h1>
      {error ? (
        <>
          <p role="alert" className="text-destructive">
            {error}
          </p>
          <Link
            href="/events"
            className="text-primary focus-visible:ring-ring/50 w-fit rounded-lg text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3"
          >
            Go to your events
          </Link>
        </>
      ) : (
        <p role="status" className="text-muted-foreground">
          Opening the invitation…
        </p>
      )}
    </div>
  );
}
