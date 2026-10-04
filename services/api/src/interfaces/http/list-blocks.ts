import type { ListBlocksResponse } from '@cvp/shared';
import { listBlocks } from './container';
import { json, route, userIdOf } from './http';

// GET /me/blocks
export const handler = route(async (event) => {
  const blocks = await listBlocks.execute({ userId: userIdOf(event) });
  return json(200, {
    blocks: blocks.map((block) => ({
      id: block.blockedId,
      videoTitle: block.videoTitle,
      createdAt: block.createdAt,
    })),
  } satisfies ListBlocksResponse);
});
