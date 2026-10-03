import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, MAX_PARTS, MIN_PART_BYTES, planUpload } from './upload-plan';

const MIB = 1024 ** 2;
const GIB = 1024 ** 3;

describe('planUpload', () => {
  it('uses a single part for a file smaller than one part', () => {
    expect(planUpload(5 * MIB)).toEqual({ partSizeBytes: 16 * MIB, partCount: 1 });
  });

  it('splits a 10 GiB concert into 16 MiB parts', () => {
    expect(planUpload(10 * GIB)).toEqual({ partSizeBytes: 16 * MIB, partCount: 640 });
  });

  it('adds a last, smaller part for the remainder', () => {
    expect(planUpload(16 * MIB + 1).partCount).toBe(2);
  });

  it('keeps 16 MiB parts up to exactly 10,000 parts', () => {
    expect(planUpload(MIN_PART_BYTES * MAX_PARTS)).toEqual({
      partSizeBytes: 16 * MIB,
      partCount: MAX_PARTS,
    });
  });

  it('grows the part size instead of exceeding 10,000 parts', () => {
    const plan = planUpload(MIN_PART_BYTES * MAX_PARTS + 1);
    expect(plan.partSizeBytes).toBe(17 * MIB);
    expect(plan.partCount).toBeLessThanOrEqual(MAX_PARTS);
  });

  it('fits the largest allowed file in 10,000 parts', () => {
    expect(planUpload(MAX_FILE_BYTES).partCount).toBeLessThanOrEqual(MAX_PARTS);
  });

  it.each([0, -1, 1.5, Number.NaN, MAX_FILE_BYTES + 1])('rejects size %s', (size) => {
    expect(() => planUpload(size)).toThrow(expect.objectContaining({ code: 'INVALID_SIZE' }));
  });
});
