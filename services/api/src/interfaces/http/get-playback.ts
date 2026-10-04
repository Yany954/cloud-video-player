import type { PlaybackResponse } from '@cvp/shared';
import { getPlayback } from './container';
import { json, pathParam, route, viewerOf } from './http';

// GET /videos/{videoId}/playback
export const handler = route(async (event) => {
  const playback = await getPlayback.execute({
    viewer: viewerOf(event),
    videoId: pathParam(event, 'videoId'),
  });
  return json(200, {
    title: playback.title,
    videoUrl: playback.video,
    posterUrl: playback.poster,
    expiresAt: playback.expiresAt,
    durationSeconds: playback.durationSeconds,
    width: playback.width,
    height: playback.height,
    moderationStatus: playback.moderationStatus,
    canDelete: playback.canDelete,
    isMine: playback.isMine,
  } satisfies PlaybackResponse);
});
