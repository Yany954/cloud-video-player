import { describe, expect, it } from 'vitest';
import { parseFfprobeOutput } from './ffprobe-output';

const output = (streams: unknown[], duration: string | undefined = '61.533333') =>
  JSON.stringify({ streams, format: { duration } });

describe('parseFfprobeOutput', () => {
  it('reads codecs, duration and size from a typical phone video', () => {
    const probe = parseFfprobeOutput(
      output([
        { codec_type: 'video', codec_name: 'hevc', width: 1920, height: 1080 },
        { codec_type: 'audio', codec_name: 'aac' },
        { codec_type: 'data', codec_name: 'bin_data' },
      ]),
    );

    expect(probe).toEqual({
      videoCodec: 'hevc',
      audioCodec: 'aac',
      durationSeconds: 61.533333,
      width: 1920,
      height: 1080,
    });
  });

  it.each([-90, 90, 270])('swaps width and height for a portrait video rotated %i°', (rotation) => {
    const probe = parseFfprobeOutput(
      output([
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1920,
          height: 1080,
          side_data_list: [{ rotation }],
        },
      ]),
    );

    expect(probe).toMatchObject({ width: 1080, height: 1920 });
  });

  it('keeps the size of an upside-down (180°) video', () => {
    const probe = parseFfprobeOutput(
      output([
        {
          codec_type: 'video',
          codec_name: 'h264',
          width: 1920,
          height: 1080,
          side_data_list: [{ rotation: 180 }],
        },
      ]),
    );

    expect(probe).toMatchObject({ width: 1920, height: 1080 });
  });

  it('reports a silent video', () => {
    expect(
      parseFfprobeOutput(output([{ codec_type: 'video', codec_name: 'h264' }])).audioCodec,
    ).toBeNull();
  });

  it('does not mistake cover art for a video stream', () => {
    const probe = parseFfprobeOutput(
      output([
        { codec_type: 'audio', codec_name: 'mp3' },
        { codec_type: 'video', codec_name: 'mjpeg', disposition: { attached_pic: 1 } },
      ]),
    );

    expect(probe.videoCodec).toBeNull();
  });

  it('survives missing streams and duration', () => {
    expect(parseFfprobeOutput('{}')).toEqual({
      videoCodec: null,
      audioCodec: null,
      durationSeconds: 0,
      width: 0,
      height: 0,
    });
  });
});
