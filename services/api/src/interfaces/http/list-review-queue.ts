import type { ReviewQueueResponse } from '@cvp/shared';
import { listReviewQueue } from './container';
import { json, route, viewerOf } from './http';
import { userDirectory } from './user-directory';
import { toListVideosResponse } from './video-list-response';

// GET /admin/review
export const handler = route(async (event) => {
  const items = await listReviewQueue.execute({ viewer: viewerOf(event) });
  const { videos } = await toListVideosResponse(items.map((item) => item.video));
  // Admins see who reported, so a person who reports in bad faith can be dealt with.
  const emails = await userDirectory.emailsOf([
    ...new Set(items.flatMap((item) => item.reports.map((report) => report.reporterId))),
  ]);
  return json(200, {
    videos: videos.map((video, index) => ({
      ...video,
      reports: items[index]!.reports.map((report) => ({
        reason: report.reason,
        note: report.note,
        createdAt: report.createdAt,
        reporterEmail: emails.get(report.reporterId) ?? null,
      })),
    })),
  } satisfies ReviewQueueResponse);
});
