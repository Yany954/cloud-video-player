import type { DownloadResponse } from '@cvp/shared';
import { getDownload } from './container';
import { json, pathParam, route, viewerOf } from './http';

// GET /videos/{videoId}/download
export const handler = route(async (event) => {
  const download = await getDownload.execute({
    viewer: viewerOf(event),
    videoId: pathParam(event, 'videoId'),
  });
  return json(200, download satisfies DownloadResponse);
});
