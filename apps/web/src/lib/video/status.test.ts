import { describe, expect, it } from 'vitest';
import { videoStatusLabel } from './status';

describe('videoStatusLabel', () => {
  it.each([
    ['uploading', 'pending', 'Upload not finished'],
    ['uploaded', 'pending', 'Waiting for review'],
    ['ready', 'pending', 'Waiting for review'],
    ['ready', 'flagged', 'Being reviewed'],
    ['ready', 'rejected', 'Not approved'],
    ['processing', 'approved', 'Being prepared'],
    ['ready', 'approved', 'Ready to watch'],
    ['failed', 'approved', 'Could not be processed'],
  ] as const)('%s + %s -> %s', (uploadStatus, moderationStatus, label) => {
    expect(videoStatusLabel({ uploadStatus, moderationStatus })).toBe(label);
  });
});
