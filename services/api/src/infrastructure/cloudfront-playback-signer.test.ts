import { createVerify, generateKeyPairSync } from 'node:crypto';
import type { SSMClient } from '@aws-sdk/client-ssm';
import { describe, expect, it, vi } from 'vitest';
import { CloudFrontPlaybackSigner } from './cloudfront-playback-signer';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function setup(send = vi.fn().mockResolvedValue({ Parameter: { Value: privateKey } })) {
  const signer = new CloudFrontPlaybackSigner({ send } as unknown as SSMClient, {
    domain: 'cdn.test',
    keyPairId: 'KEY123',
    privateKeyParameter: '/test/playback/private-key',
  });
  return { signer, send };
}

const expiresAt = new Date('2026-10-03T18:00:00.000Z');

/** CloudFront's URL-safe base64, back to bytes. */
const decode = (value: string) =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '=').replace(/~/g, '/'), 'base64');

describe('CloudFrontPlaybackSigner', () => {
  it('signs the video and the poster of one video, expiring when asked', async () => {
    const { signer } = setup();

    const urls = await signer.sign('video-1', expiresAt);

    const video = new URL(urls.video);
    expect(video.origin + video.pathname).toBe('https://cdn.test/media/video-1/video.mp4');
    expect(new URL(urls.poster).pathname).toBe('/media/video-1/poster.jpg');
    expect(video.searchParams.get('Key-Pair-Id')).toBe('KEY123');
    expect(video.searchParams.get('Expires')).toBe(String(expiresAt.getTime() / 1000));
  });

  it('produces a signature CloudFront can verify with the public key', async () => {
    const { signer } = setup();

    const url = new URL((await signer.sign('video-1', expiresAt)).video);

    // This is the exact policy CloudFront rebuilds from the URL before checking the signature.
    const policy = JSON.stringify({
      Statement: [
        {
          Resource: 'https://cdn.test/media/video-1/video.mp4',
          Condition: { DateLessThan: { 'AWS:EpochTime': expiresAt.getTime() / 1000 } },
        },
      ],
    });
    const valid = createVerify('RSA-SHA1')
      .update(policy)
      .verify(publicKey, decode(url.searchParams.get('Signature')!));
    expect(valid).toBe(true);
  });

  it('reads the private key once, decrypted, and reuses it', async () => {
    const { signer, send } = setup();

    await signer.sign('video-1', expiresAt);
    await signer.sign('video-2', expiresAt);

    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]![0].input).toEqual({
      Name: '/test/playback/private-key',
      WithDecryption: true,
    });
  });

  it('tries again after a failed key read instead of staying broken', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('throttled'))
      .mockResolvedValue({ Parameter: { Value: privateKey } });
    const { signer } = setup(send);

    await expect(signer.sign('video-1', expiresAt)).rejects.toThrow('throttled');
    await expect(signer.sign('video-1', expiresAt)).resolves.toHaveProperty('video');
  });
});
