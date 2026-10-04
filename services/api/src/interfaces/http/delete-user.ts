import { ForbiddenError } from '../../application/errors';
import { requestAccountDeletion } from './account-deletion';
import { pathParam, route, viewerOf } from './http';

// DELETE /admin/users/{userId}
export const handler = route(async (event) => {
  const viewer = viewerOf(event);
  const userId = pathParam(event, 'userId');
  // Admins delete their own account from their profile, with their password, like everyone.
  if (!viewer.isAdmin || viewer.userId === userId) throw new ForbiddenError();
  await requestAccountDeletion.execute({ viewer, userId });
  return { statusCode: 202 };
});
