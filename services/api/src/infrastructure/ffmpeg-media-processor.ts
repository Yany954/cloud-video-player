import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import type { MediaProcessor, RemuxPlan } from '../application/ports';
import type { ProbeResult } from '../domain/normalization';
import type { Video } from '../domain/video';
import { posterArgs, remuxArgs } from './ffmpeg-args';
import { parseFfprobeOutput } from './ffprobe-output';
import { mediaKeys, originalKey } from './s3-object-storage';
import { withS3RangeProxy } from './s3-range-proxy';

const run = promisify(execFile);
// ffmpeg prints progress and warnings to stderr; keep enough to diagnose a failure.
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

export interface FfmpegMediaProcessorOptions {
  uploadsBucket: string;
  mediaBucket: string;
  /** In Lambda the layer puts these on the PATH at /opt/bin. */
  ffmpegPath?: string;
  ffprobePath?: string;
}

export class FfmpegMediaProcessor implements MediaProcessor {
  constructor(
    private readonly s3: S3Client,
    private readonly options: FfmpegMediaProcessorOptions,
  ) {}

  async probe(video: Video): Promise<ProbeResult> {
    const { stdout } = await this.withSource(video, (url) =>
      run(
        this.options.ffprobePath ?? 'ffprobe',
        ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', url],
        { maxBuffer: MAX_OUTPUT_BYTES },
      ),
    );
    return parseFfprobeOutput(stdout);
  }

  async normalize(video: Video, plan: RemuxPlan, probe: ProbeResult): Promise<void> {
    const videoFile = join(tmpdir(), `${video.id}.mp4`);
    const posterFile = join(tmpdir(), `${video.id}.jpg`);
    const keys = mediaKeys(video.id);
    try {
      // The original is read in byte ranges and never downloaded: only the output has to
      // fit on the temporary disk.
      await this.withSource(video, (url) => this.ffmpeg(remuxArgs(plan, url, videoFile)));
      // The poster comes from the local output, which is much faster to seek than the source.
      await this.ffmpeg(posterArgs(videoFile, posterFile, probe.durationSeconds));
      await this.upload(posterFile, keys.poster, 'image/jpeg');
      // Uploaded last: once it exists, the video is complete.
      await this.upload(videoFile, keys.video, 'video/mp4');
    } finally {
      await Promise.all([rm(videoFile, { force: true }), rm(posterFile, { force: true })]);
    }
  }

  private async ffmpeg(args: string[]): Promise<void> {
    await run(this.options.ffmpegPath ?? 'ffmpeg', args, { maxBuffer: MAX_OUTPUT_BYTES });
  }

  private withSource<T>(video: Video, use: (url: string) => Promise<T>): Promise<T> {
    return withS3RangeProxy(
      this.s3,
      { bucket: this.options.uploadsBucket, key: originalKey(video) },
      use,
    );
  }

  private async upload(file: string, key: string, contentType: string): Promise<void> {
    await new Upload({
      client: this.s3,
      params: {
        Bucket: this.options.mediaBucket,
        Key: key,
        Body: createReadStream(file),
        ContentType: contentType,
        StorageClass: 'INTELLIGENT_TIERING',
      },
    }).done();
  }
}
