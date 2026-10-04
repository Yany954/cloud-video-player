import type { BlockRepository, ReportRepository } from '../ports';

// Stand-ins for use cases built without reporting or blocking (most unit tests). The Lambda
// composition roots always pass the real repositories.

export const NO_BLOCKS: BlockRepository = {
  add: async () => {},
  remove: async () => {},
  listByBlocker: async () => [],
  deleteByBlocker: async () => {},
};

export const NO_REPORTS: ReportRepository = {
  add: async () => true,
  listByVideo: async () => [],
  deleteByVideo: async () => {},
};

/** The ids of everyone this person blocked. */
export async function blockedIdsOf(blocks: BlockRepository, userId: string): Promise<Set<string>> {
  return new Set((await blocks.listByBlocker(userId)).map((block) => block.blockedId));
}
