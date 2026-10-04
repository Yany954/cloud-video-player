import { blockUploaderRequestSchema, type BlockResponse } from '@cvp/shared';
import { blockUploader } from './container';
import { json, parseBody, route, viewerOf } from './http';

// POST /me/blocks
export const handler = route(async (event) => {
  const { videoId } = parseBody(event, blockUploaderRequestSchema);
  const block = await blockUploader.execute({ viewer: viewerOf(event), videoId });
  return json(201, {
    id: block.blockedId,
    videoTitle: block.videoTitle,
    createdAt: block.createdAt,
  } satisfies BlockResponse);
});
