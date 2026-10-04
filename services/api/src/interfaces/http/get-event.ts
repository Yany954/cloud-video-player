import type { EventDetailResponse } from '@cvp/shared';
import { canManageCategory } from '../../domain/category';
import { isOwnedBy } from '../../domain/video';
import { getCategory } from './container';
import { toEventResponse } from './event-response';
import { json, pathParam, route, viewerOf } from './http';
import { userDirectory } from './user-directory';
import { toListVideosResponse } from './video-list-response';

// GET /events/{eventId}
export const handler = route(async (event) => {
  const viewer = viewerOf(event);
  const { category, videos } = await getCategory.execute({
    viewer,
    categoryId: pathParam(event, 'eventId'),
  });
  // Only the owner sees the invite link and who joined.
  const isOwner = canManageCategory(category, viewer.userId);
  const emails = isOwner ? await userDirectory.emailsOf(category.collaboratorIds) : null;
  return json(200, {
    event: toEventResponse(category, viewer.userId),
    inviteToken: isOwner ? category.inviteToken : null,
    collaborators: emails
      ? category.collaboratorIds.map((userId) => ({ userId, email: emails.get(userId) ?? null }))
      : [],
    videos: (await toListVideosResponse(videos)).videos,
    myVideoIds: videos.filter((video) => isOwnedBy(video, viewer.userId)).map((video) => video.id),
  } satisfies EventDetailResponse);
});
