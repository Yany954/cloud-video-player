import { GetParameterCommand, type SSMClient } from '@aws-sdk/client-ssm';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import type { PlaybackUrls, PlaybackUrlSigner } from '../application/ports';
import { mediaKeys } from './s3-object-storage';

export interface CloudFrontPlaybackSignerOptions {
  /** e.g. d111111abcdef8.cloudfront.net */
  domain: string;
  /** Id of the CloudFront public key that matches the private key. */
  keyPairId: string;
  /** SSM SecureString parameter holding the private key. */
  privateKeyParameter: string;
}

export class CloudFrontPlaybackSigner implements PlaybackUrlSigner {
  private privateKey?: Promise<string>;

  constructor(
    private readonly ssm: SSMClient,
    private readonly options: CloudFrontPlaybackSignerOptions,
  ) {}

  async sign(videoId: string, expiresAt: Date): Promise<PlaybackUrls> {
    const privateKey = await this.loadPrivateKey();
    const keys = mediaKeys(videoId);
    const sign = (key: string) =>
      getSignedUrl({
        url: `https://${this.options.domain}/${key}`,
        keyPairId: this.options.keyPairId,
        privateKey,
        dateLessThan: expiresAt,
      });
    return { video: sign(keys.video), poster: sign(keys.poster) };
  }

  /** Read once per Lambda container, then kept in memory. */
  private loadPrivateKey(): Promise<string> {
    this.privateKey ??= this.ssm
      .send(
        new GetParameterCommand({ Name: this.options.privateKeyParameter, WithDecryption: true }),
      )
      .then(({ Parameter }) => {
        if (!Parameter?.Value) throw new Error('Playback private key parameter is empty');
        return Parameter.Value;
      });
    // A failed read must not be cached, or the container would be broken until recycled.
    this.privateKey.catch(() => (this.privateKey = undefined));
    return this.privateKey;
  }
}
