import type { EventDetailResponse } from '@cvp/shared';
import { isOwnedBy } from '../../domain/video';
import { getCategory } from './container';
import { toEventResponse } from './event-response';
import { json, pathParam, route, viewerOf } from './http';
import { toListVideosResponse } from './video-list-response';

// GET /events/{eventId}
export const handler = route(async (event) => {
  const viewer = viewerOf(event);
  const { category, videos } = await getCategory.execute({
    viewer,
    categoryId: pathParam(event, 'eventId'),
  });
  return json(200, {
    event: toEventResponse(category, viewer.userId),
    videos: (await toListVideosResponse(videos)).videos,
    myVideoIds: videos.filter((video) => isOwnedBy(video, viewer.userId)).map((video) => video.id),
  } satisfies EventDetailResponse);
});
