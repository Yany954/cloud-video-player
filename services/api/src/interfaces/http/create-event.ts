import { createEventRequestSchema } from '@cvp/shared';
import { createCategory } from './container';
import { toEventResponse } from './event-response';
import { json, parseBody, route, userIdOf } from './http';

// POST /events
export const handler = route(async (event) => {
  const userId = userIdOf(event);
  const category = await createCategory.execute({
    ...parseBody(event, createEventRequestSchema),
    userId,
  });
  return json(201, toEventResponse(category, userId));
});
