import type { EventInviteResponse } from '@cvp/shared';
import { openInvite } from './container';
import { json, pathParam, route, userIdOf } from './http';

// PUT /events/{eventId}/invite
export const handler = route(async (event) => {
  const token = await openInvite.execute({
    userId: userIdOf(event),
    categoryId: pathParam(event, 'eventId'),
  });
  return json(200, { token } satisfies EventInviteResponse);
});
