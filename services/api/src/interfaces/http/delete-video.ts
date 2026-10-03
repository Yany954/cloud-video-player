import { deleteVideo } from './container';
import { pathParam, route, viewerOf } from './http';

// DELETE /videos/{videoId}
export const handler = route(async (event) => {
  await deleteVideo.execute({ viewer: viewerOf(event), videoId: pathParam(event, 'videoId') });
  return { statusCode: 204 };
});
