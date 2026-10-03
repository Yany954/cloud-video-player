import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration } from './format';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [104_857_600, '100 MB'],
    [53_687_091_200, '50 GB'],
    [1_288_490_189, '1.2 GB'],
    [-5, '0 B'],
  ])('%i -> %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [7.566667, '0:07'],
    [59.9, '0:59'],
    [60, '1:00'],
    [3723, '1:02:03'],
    [-3, '0:00'],
  ])('%s s -> %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
