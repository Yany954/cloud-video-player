import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Readable } from 'node:stream';
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';

/**
 * Serves one S3 object on a local HTTP address for the duration of `use`, forwarding byte
 * ranges to S3. The static ffmpeg build cannot resolve hostnames, so it reads the original
 * from 127.0.0.1 instead of from S3 directly, still seeking without downloading the file.
 */
export async function withS3RangeProxy<T>(
  s3: S3Client,
  source: { bucket: string; key: string },
  use: (url: string) => Promise<T>,
): Promise<T> {
  const server = createServer((request, response) => {
    const range = request.headers.range;
    s3.send(new GetObjectCommand({ Bucket: source.bucket, Key: source.key, Range: range })).then(
      (object) => {
        response.writeHead(range ? 206 : 200, {
          'accept-ranges': 'bytes',
          ...(object.ContentLength !== undefined && { 'content-length': object.ContentLength }),
          ...(object.ContentRange && { 'content-range': object.ContentRange }),
        });
        const body = object.Body as Readable;
        // ffmpeg drops the connection whenever it seeks: stop reading from S3 too.
        response.on('close', () => body.destroy());
        body.on('error', () => response.destroy());
        body.pipe(response);
      },
      (error: { $metadata?: { httpStatusCode?: number } }) => {
        response.writeHead(error.$metadata?.httpStatusCode ?? 502).end();
      },
    );
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  // The extension helps ffmpeg pick the right container parser.
  const extension = source.key.split('.').pop();
  try {
    return await use(`http://127.0.0.1:${port}/source.${extension}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
