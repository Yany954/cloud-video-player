import { closeInvite } from './container';
import { pathParam, route, userIdOf } from './http';

// DELETE /events/{eventId}/invite
export const handler = route(async (event) => {
  await closeInvite.execute({ userId: userIdOf(event), categoryId: pathParam(event, 'eventId') });
  return { statusCode: 204 };
});
