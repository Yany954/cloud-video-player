'use client';

import type { EventResponse, ListEventsResponse } from '@cvp/shared';
import { CalendarDays, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { VisibilityBadge } from '@/components/event/visibility-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadApi } from '@/lib/api';

export default function EventsPage() {
  const router = useRouter();
  const [events, setEvents] = useState<ListEventsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    let active = true;
    uploadApi.listEvents().then(
      (response) => active && setEvents(response),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, []);

  async function create(submit: React.FormEvent) {
    submit.preventDefault();
    if (name.trim().length === 0) {
      setCreateError('Give the event a name, for example “Concert, October 2026”.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const event = await uploadApi.createEvent({ name });
      router.push(`/events/${event.id}`);
    } catch {
      setCreateError('The event could not be created. Check your connection and try again.');
      setCreating(false);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Events</h1>
        <p className="text-muted-foreground text-sm">
          Group the videos of one day, such as a concert, and play them one after another. An event
          is private: only you and the people you invite can see it.
        </p>
      </div>

      <form
        onSubmit={(submit) => void create(submit)}
        noValidate
        aria-labelledby="new-event-title"
        className="grid gap-4 rounded-3xl border px-5 py-5"
      >
        <h2 id="new-event-title" className="text-base font-semibold tracking-tight">
          New event
        </h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="event-name">Name</Label>
            <Input
              id="event-name"
              name="event-name"
              autoComplete="off"
              maxLength={120}
              value={name}
              onChange={(change) => setName(change.target.value)}
              aria-invalid={createError ? true : undefined}
              aria-describedby={createError ? 'event-name-error' : undefined}
              placeholder="Concert Twenty One Pilots, October 2026…"
              className="h-9"
            />
          </div>
          <Button type="submit" size="lg" disabled={creating}>
            <Plus aria-hidden />
            {creating ? 'Creating…' : 'Create event'}
          </Button>
        </div>
        {createError && (
          <p id="event-name-error" role="alert" className="text-destructive text-sm">
            {createError}
          </p>
        )}
      </form>

      {failed ? (
        <p role="alert" className="text-destructive text-sm">
          Your events could not be loaded. Reload the page to try again.
        </p>
      ) : events === null ? (
        <div aria-busy="true" aria-label="Loading events" className="grid gap-3">
          <div className="bg-muted h-16 animate-pulse rounded-3xl motion-reduce:animate-none" />
          <div className="bg-muted h-16 animate-pulse rounded-3xl motion-reduce:animate-none" />
        </div>
      ) : (
        <>
          <EventList
            id="my-events-title"
            title="My events"
            events={events.mine}
            emptyText="You have no events yet. Create one above, then add your videos to it."
          />
          {events.invited.length > 0 && (
            <EventList
              id="invited-events-title"
              title="Events I was invited to"
              events={events.invited}
              emptyText=""
            />
          )}
          {events.shared.length > 0 && (
            <EventList
              id="shared-events-title"
              title="Shared by others"
              events={events.shared}
              emptyText=""
            />
          )}
        </>
      )}
    </div>
  );
}

function EventList({
  id,
  title,
  events,
  emptyText,
}: {
  id: string;
  title: string;
  events: EventResponse[];
  emptyText: string;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="text-base font-semibold tracking-tight">
        {title}
      </h2>
      {events.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-3xl border px-6 py-10 text-center">
          <CalendarDays aria-hidden className="text-muted-foreground size-7" strokeWidth={1.5} />
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        </div>
      ) : (
        <ul className="bg-card divide-y overflow-hidden rounded-3xl border">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-ring/50 flex items-center gap-4 px-4 py-4 outline-none focus-visible:ring-3 focus-visible:ring-inset sm:px-5"
              >
                <span className="min-w-0 flex-1 truncate font-medium" title={event.name}>
                  {event.name}
                </span>
                <VisibilityBadge visibility={event.visibility} />
                <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
