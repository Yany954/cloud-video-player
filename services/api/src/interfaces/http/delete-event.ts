import { deleteCategory } from './container';
import { pathParam, route, userIdOf } from './http';

// DELETE /events/{eventId}
export const handler = route(async (event) => {
  await deleteCategory.execute({
    userId: userIdOf(event),
    categoryId: pathParam(event, 'eventId'),
  });
  return { statusCode: 204 };
});
