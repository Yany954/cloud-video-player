import type { ListUsersResponse } from '@cvp/shared';
import { json, route, viewerOf } from './http';
import { listUsers, toUserResponse } from './user-admin';

// GET /admin/users
export const handler = route(async (event) => {
  const viewer = viewerOf(event);
  const users = await listUsers.execute({ viewer });
  return json(200, {
    users: users.map((user) => toUserResponse(user, viewer.userId)),
  } satisfies ListUsersResponse);
});
