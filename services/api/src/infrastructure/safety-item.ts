import type { Block, Report } from '../domain/safety';

// Single-table key patterns. Reports live in the video's partition, blocks in the blocker's.
export const REPORT_PREFIX = 'REPORT#';
export const BLOCK_PREFIX = 'BLOCK#';

export const reportKey = (videoId: string, reporterId: string) => ({
  PK: `VIDEO#${videoId}`,
  SK: `${REPORT_PREFIX}${reporterId}`,
});

export const blockKey = (blockerId: string, blockedId: string) => ({
  PK: `USER#${blockerId}`,
  SK: `${BLOCK_PREFIX}${blockedId}`,
});

export const toReportItem = (report: Report) => ({
  ...reportKey(report.videoId, report.reporterId),
  type: 'Report',
  ...report,
});

export function fromReportItem(item: object): Report {
  const report = item as Report;
  return {
    videoId: report.videoId,
    reporterId: report.reporterId,
    reason: report.reason,
    note: report.note,
    createdAt: report.createdAt,
  };
}

export const toBlockItem = (block: Block) => ({
  ...blockKey(block.blockerId, block.blockedId),
  type: 'Block',
  ...block,
});

export function fromBlockItem(item: object): Block {
  const block = item as Block;
  return {
    blockerId: block.blockerId,
    blockedId: block.blockedId,
    videoTitle: block.videoTitle,
    createdAt: block.createdAt,
  };
}
