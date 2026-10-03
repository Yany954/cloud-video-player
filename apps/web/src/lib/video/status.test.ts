import { describe, expect, it } from 'vitest';
import { isBeingPrepared, videoStatusLabel } from './status';

describe('videoStatusLabel', () => {
  it.each([
    ['uploading', 'pending', 'Upload not finished'],
    ['uploaded', 'pending', 'Being prepared'],
    ['processing', 'pending', 'Being prepared'],
    ['ready', 'pending', 'Waiting for review'],
    ['ready', 'flagged', 'Being reviewed'],
    ['ready', 'rejected', 'Not approved'],
    ['ready', 'approved', 'Ready to watch'],
  ] as const)('%s + %s -> %s', (uploadStatus, moderationStatus, label) => {
    expect(videoStatusLabel({ uploadStatus, moderationStatus, failureReason: null })).toBe(label);
  });

  it.each([
    ['UNSUPPORTED_VIDEO_CODEC', 'Format not supported yet'],
    ['TOO_LARGE', 'Too large to process yet'],
    ['NO_VIDEO_STREAM', 'No video found in the file'],
    ['PROCESSING_ERROR', 'Could not be processed'],
    [null, 'Could not be processed'],
  ] as const)('explains a failure: %s -> %s', (failureReason, label) => {
    expect(
      videoStatusLabel({ uploadStatus: 'failed', moderationStatus: 'pending', failureReason }),
    ).toBe(label);
  });
});

describe('isBeingPrepared', () => {
  it.each([
    ['uploading', false],
    ['uploaded', true],
    ['processing', true],
    ['ready', false],
    ['failed', false],
  ] as const)('%s -> %s', (uploadStatus, expected) => {
    expect(isBeingPrepared({ uploadStatus })).toBe(expected);
  });
});
