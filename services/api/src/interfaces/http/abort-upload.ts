import { abortUpload } from './container';
import { pathParam, route, userIdOf } from './http';

// DELETE /uploads/{videoId}
export const handler = route(async (event) => {
  await abortUpload.execute({ userId: userIdOf(event), videoId: pathParam(event, 'videoId') });
  return { statusCode: 204 };
});
