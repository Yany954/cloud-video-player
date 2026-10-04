import { reportVideoRequestSchema } from '@cvp/shared';
import { reportVideo } from './container';
import { parseBody, pathParam, route, viewerOf } from './http';

// POST /videos/{videoId}/reports
export const handler = route(async (event) => {
  await reportVideo.execute({
    ...parseBody(event, reportVideoRequestSchema),
    viewer: viewerOf(event),
    videoId: pathParam(event, 'videoId'),
  });
  return { statusCode: 204 };
});
