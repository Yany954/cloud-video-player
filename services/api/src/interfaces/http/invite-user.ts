import { inviteUserRequestSchema } from '@cvp/shared';
import { json, parseBody, route, viewerOf } from './http';
import { inviteUser, toUserResponse } from './user-admin';

// POST /admin/users
export const handler = route(async (event) => {
  const viewer = viewerOf(event);
  const { email } = parseBody(event, inviteUserRequestSchema);
  const user = await inviteUser.execute({ viewer, email });
  return json(201, toUserResponse(user, viewer.userId));
});
