import { reorderEventRequestSchema } from '@cvp/shared';
import { reorderCategory } from './container';
import { parseBody, pathParam, route, userIdOf } from './http';

// PUT /events/{eventId}/order
export const handler = route(async (event) => {
  await reorderCategory.execute({
    ...parseBody(event, reorderEventRequestSchema),
    userId: userIdOf(event),
    categoryId: pathParam(event, 'eventId'),
  });
  return { statusCode: 204 };
});
