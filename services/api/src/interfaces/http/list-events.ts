import type { ListEventsResponse } from '@cvp/shared';
import { listCategories } from './container';
import { toEventResponse } from './event-response';
import { json, route, userIdOf } from './http';

// GET /events
export const handler = route(async (event) => {
  const userId = userIdOf(event);
  const { mine, invited, shared } = await listCategories.execute({ userId });
  return json(200, {
    mine: mine.map((category) => toEventResponse(category, userId)),
    invited: invited.map((category) => toEventResponse(category, userId)),
    shared: shared.map((category) => toEventResponse(category, userId)),
  } satisfies ListEventsResponse);
});
