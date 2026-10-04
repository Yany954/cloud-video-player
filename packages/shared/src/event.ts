import { z } from 'zod';
import type { VideoResponse } from './video';

// Contracts of the events API, shared by api, web and mobile. An event groups videos, e.g.
// "Concert Twenty One Pilots October 2026".

export const EVENT_VISIBILITIES = ['private', 'shared'] as const;
/** `private`: only its owner and collaborators. `shared`: every signed-in user. */
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

/** The colour themes an event's header can use. Each app decides what a theme looks like. */
export const EVENT_THEMES = [
  'stage',
  'sunset',
  'forest',
  'ocean',
  'ember',
  'violet',
  'gold',
  'steel',
] as const;
export type EventTheme = (typeof EVENT_THEMES)[number];

const name = z.string().trim().min(1).max(120);
const theme = z.enum(EVENT_THEMES);
const visibility = z.enum(EVENT_VISIBILITIES);

export const createEventRequestSchema = z.object({
  name,
  visibility: visibility.optional(),
  theme: theme.optional(),
});
export type CreateEventRequest = z.infer<typeof createEventRequestSchema>;

export const updateEventRequestSchema = z
  .object({ name: name.optional(), visibility: visibility.optional(), theme: theme.optional() })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Send a name, a visibility or a theme',
  });
export type UpdateEventRequest = z.infer<typeof updateEventRequestSchema>;

export const reorderEventRequestSchema = z.object({
  /** Every video of the event, in the order they should play. */
  videoIds: z.array(z.string().min(1)).max(1000),
});
export type ReorderEventRequest = z.infer<typeof reorderEventRequestSchema>;

export const setVideoEventRequestSchema = z.object({
  /** `null` takes the video out of its event. */
  eventId: z.string().min(1).nullable(),
});
export type SetVideoEventRequest = z.infer<typeof setVideoEventRequestSchema>;

export const joinEventRequestSchema = z.object({
  /** The secret from the invite link. */
  token: z.string().min(1).max(200),
});
export type JoinEventRequest = z.infer<typeof joinEventRequestSchema>;

export interface EventInviteResponse {
  token: string;
}

export interface EventCollaborator {
  userId: string;
  /** Null if the account no longer exists. */
  email: string | null;
}

export interface EventResponse {
  id: string;
  name: string;
  visibility: EventVisibility;
  /** The colours of its header. */
  theme: EventTheme;
  /** The caller created it: they can rename, reorder, share and delete it. */
  isOwner: boolean;
  /** The caller is its owner or a collaborator: they can add their own videos. */
  isMember: boolean;
  createdAt: string;
}

export interface ListEventsResponse {
  /** The caller's own events, newest first. */
  mine: EventResponse[];
  /** Events the caller joined through an invite link, newest first. */
  invited: EventResponse[];
  /** Events other people shared with everyone, newest first. */
  shared: EventResponse[];
}

export interface EventDetailResponse {
  event: EventResponse;
  /** The videos the caller may see, in playing order. */
  videos: VideoResponse[];
  /** Which of `videos` the caller uploaded. */
  myVideoIds: string[];
  /** The secret of the current invite link. Only its owner gets it; null for everyone else. */
  inviteToken: string | null;
  /** Who joined through the invite link. Only its owner gets the list; empty for everyone else. */
  collaborators: EventCollaborator[];
}
