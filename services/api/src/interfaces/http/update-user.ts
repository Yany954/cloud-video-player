import { updateUserRequestSchema } from '@cvp/shared';
import { json, parseBody, pathParam, route, viewerOf } from './http';
import { toUserResponse, updateUser } from './user-admin';

// PATCH /admin/users/{userId}
export const handler = route(async (event) => {
  const viewer = viewerOf(event);
  const user = await updateUser.execute({
    viewer,
    userId: pathParam(event, 'userId'),
    change: parseBody(event, updateUserRequestSchema),
  });
  return json(200, toUserResponse(user, viewer.userId));
});
