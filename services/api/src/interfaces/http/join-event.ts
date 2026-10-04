import { joinEventRequestSchema } from '@cvp/shared';
import { joinCategory } from './container';
import { toEventResponse } from './event-response';
import { json, parseBody, pathParam, route, userIdOf } from './http';

// POST /events/{eventId}/join
export const handler = route(async (event) => {
  const userId = userIdOf(event);
  const category = await joinCategory.execute({
    ...parseBody(event, joinEventRequestSchema),
    userId,
    categoryId: pathParam(event, 'eventId'),
  });
  return json(200, toEventResponse(category, userId));
});
