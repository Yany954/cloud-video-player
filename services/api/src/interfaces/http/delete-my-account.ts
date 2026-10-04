import { deleteAccountRequestSchema } from '@cvp/shared';
import { requestAccountDeletion } from './account-deletion';
import { parseBody, route, viewerOf } from './http';

// POST /me/deletion
export const handler = route(async (event) => {
  const viewer = viewerOf(event);
  // The password is checked and forgotten: it is never stored or logged.
  const { password } = parseBody(event, deleteAccountRequestSchema);
  await requestAccountDeletion.execute({ viewer, userId: viewer.userId, password });
  return { statusCode: 202 };
});
