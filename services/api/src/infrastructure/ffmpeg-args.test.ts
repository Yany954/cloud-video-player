import { describe, expect, it } from 'vitest';
import { posterArgs, remuxArgs } from './ffmpeg-args';

const joined = (args: string[]) => args.join(' ');

describe('remuxArgs', () => {
  it('copies both streams and puts the index first', () => {
    const args = joined(
      remuxArgs({ kind: 'remux', video: 'copy', videoTag: null, audio: 'copy' }, 'in', 'out.mp4'),
    );

    expect(args).toContain('-i in');
    expect(args).toContain('-map 0:v:0 -map 0:a:0 -c:v copy -c:a copy');
    expect(args).toContain('-movflags +faststart');
    expect(args).not.toContain('-tag:v');
    expect(args.endsWith('out.mp4')).toBe(true);
  });

  it('tags HEVC for Apple players', () => {
    const args = joined(
      remuxArgs({ kind: 'remux', video: 'copy', videoTag: 'hvc1', audio: 'copy' }, 'in', 'out'),
    );

    expect(args).toContain('-c:v copy -tag:v hvc1');
  });

  it('re-encodes only the audio when asked', () => {
    const args = joined(
      remuxArgs(
        { kind: 'remux', video: 'copy', videoTag: null, audio: 'transcode-to-aac' },
        'in',
        'out',
      ),
    );

    expect(args).toContain('-c:v copy -c:a aac -b:a 192k');
  });

  it('maps no audio for a silent video', () => {
    const args = joined(
      remuxArgs({ kind: 'remux', video: 'copy', videoTag: null, audio: 'none' }, 'in', 'out'),
    );

    expect(args).not.toContain('0:a:0');
    expect(args).not.toContain('-c:a');
  });
});

describe('posterArgs', () => {
  it('takes the frame a tenth of the way in', () => {
    expect(joined(posterArgs('in', 'out.jpg', 120))).toContain('-ss 12.000 -i in');
  });

  it('never seeks past 30 seconds, even in a long concert', () => {
    expect(joined(posterArgs('in', 'out.jpg', 7_200))).toContain('-ss 30.000');
  });

  it('works for a clip shorter than a second', () => {
    expect(joined(posterArgs('in', 'out.jpg', 0.5))).toContain('-ss 0.050');
  });
});
