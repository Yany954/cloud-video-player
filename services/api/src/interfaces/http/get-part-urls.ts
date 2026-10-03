import type { PartUrlsResponse } from '@cvp/shared';
import { z } from 'zod';
import { getPartUrls } from './container';
import { json, parseQuery, pathParam, route, userIdOf } from './http';

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).optional() });

// GET /uploads/{videoId}/parts?limit=
export const handler = route(async (event) => {
  const result = await getPartUrls.execute({
    userId: userIdOf(event),
    videoId: pathParam(event, 'videoId'),
    limit: parseQuery(event, querySchema).limit,
  });
  return json(200, result satisfies PartUrlsResponse);
});
