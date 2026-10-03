import { isOwnedBy, type Video } from '../../domain/video';
import { NotFoundError } from '../errors';
import type { VideoRepository } from '../ports';

export async function findOwnedVideo(
  videos: VideoRepository,
  videoId: string,
  userId: string,
): Promise<Video> {
  const video = await videos.findById(videoId);
  if (!video || !isOwnedBy(video, userId)) throw new NotFoundError();
  return video;
}
