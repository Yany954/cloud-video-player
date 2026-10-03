import { Readable } from 'node:stream';
import type { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { withS3RangeProxy } from './s3-range-proxy';

const CONTENT = Buffer.from('0123456789abcdef');

/** Answers GetObject like S3 does, including byte ranges. */
function fakeS3() {
  const send = vi.fn(async (command: GetObjectCommand) => {
    const { Key, Range } = command.input;
    if (Key === 'missing.mov')
      throw Object.assign(new Error('NoSuchKey'), { $metadata: { httpStatusCode: 404 } });
    if (!Range) return { Body: Readable.from([CONTENT]), ContentLength: CONTENT.length };
    const [, from, to] = /bytes=(\d+)-(\d*)/.exec(Range)!;
    const start = Number(from);
    const end = to ? Number(to) : CONTENT.length - 1;
    const slice = CONTENT.subarray(start, end + 1);
    return {
      Body: Readable.from([slice]),
      ContentLength: slice.length,
      ContentRange: `bytes ${start}-${end}/${CONTENT.length}`,
    };
  });
  return { s3: { send } as unknown as S3Client, send };
}

const source = { bucket: 'uploads', key: 'uploads/u/v/original.mov' };

describe('withS3RangeProxy', () => {
  it('serves the whole object on a local address, with the file extension in the URL', async () => {
    const { s3 } = fakeS3();

    await withS3RangeProxy(s3, source, async (url) => {
      expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/source\.mov$/);
      const response = await fetch(url);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(CONTENT.toString());
    });
  });

  it('forwards byte ranges, so ffmpeg can seek without downloading the file', async () => {
    const { s3, send } = fakeS3();

    await withS3RangeProxy(s3, source, async (url) => {
      const response = await fetch(url, { headers: { range: 'bytes=10-13' } });

      expect(response.status).toBe(206);
      expect(response.headers.get('content-range')).toBe('bytes 10-13/16');
      expect(await response.text()).toBe('abcd');
    });
    expect(send.mock.calls[0]![0].input).toMatchObject({
      Bucket: 'uploads',
      Key: source.key,
      Range: 'bytes=10-13',
    });
  });

  it("passes on S3's error status", async () => {
    const { s3 } = fakeS3();

    await withS3RangeProxy(s3, { bucket: 'uploads', key: 'missing.mov' }, async (url) => {
      expect((await fetch(url)).status).toBe(404);
    });
  });

  it('stops listening afterwards, even when the work fails', async () => {
    const { s3 } = fakeS3();
    let address = '';

    await expect(
      withS3RangeProxy(s3, source, async (url) => {
        address = url;
        throw new Error('ffmpeg crashed');
      }),
    ).rejects.toThrow('ffmpeg crashed');

    await expect(fetch(address)).rejects.toThrow();
  });
});
