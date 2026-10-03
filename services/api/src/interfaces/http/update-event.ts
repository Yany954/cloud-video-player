import { updateEventRequestSchema } from '@cvp/shared';
import { updateCategory } from './container';
import { toEventResponse } from './event-response';
import { json, parseBody, pathParam, route, userIdOf } from './http';

// PATCH /events/{eventId}
export const handler = route(async (event) => {
  const userId = userIdOf(event);
  const category = await updateCategory.execute({
    ...parseBody(event, updateEventRequestSchema),
    userId,
    categoryId: pathParam(event, 'eventId'),
  });
  return json(200, toEventResponse(category, userId));
});
