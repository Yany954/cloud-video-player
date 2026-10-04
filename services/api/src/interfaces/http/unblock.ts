import { unblock } from './container';
import { pathParam, route, userIdOf } from './http';

// DELETE /me/blocks/{userId}
export const handler = route(async (event) => {
  await unblock.execute({ userId: userIdOf(event), blockedId: pathParam(event, 'userId') });
  return { statusCode: 204 };
});
