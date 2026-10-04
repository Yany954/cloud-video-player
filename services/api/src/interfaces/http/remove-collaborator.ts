import { removeCollaborator } from './container';
import { pathParam, route, userIdOf } from './http';

// DELETE /events/{eventId}/collaborators/{userId}
export const handler = route(async (event) => {
  await removeCollaborator.execute({
    userId: userIdOf(event),
    categoryId: pathParam(event, 'eventId'),
    collaboratorId: pathParam(event, 'userId'),
  });
  return { statusCode: 204 };
});
