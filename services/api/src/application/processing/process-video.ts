import { planNormalization } from '../../domain/normalization';
import { markFailed, markReady, startProcessing } from '../../domain/video';
import type { MediaProcessor, VideoRepository } from '../ports';

export interface ProcessVideoInput {
  videoId: string;
  /** True when the job will not be retried again if this attempt throws. */
  isLastAttempt: boolean;
}

/** Makes an uploaded video playable. Safe to run more than once for the same video. */
export class ProcessVideo {
  constructor(
    private readonly videos: VideoRepository,
    private readonly processor: MediaProcessor,
  ) {}

  async execute(input: ProcessVideoInput): Promise<void> {
    const video = await this.videos.findById(input.videoId);
    // Deleted meanwhile, or a duplicate delivery of a job that already finished.
    if (!video || video.uploadStatus === 'ready') return;

    const processing = startProcessing(video);
    await this.videos.save(processing);

    try {
      const probe = await this.processor.probe(processing);
      const plan = planNormalization(probe, processing.sizeBytes ?? processing.declaredSizeBytes);
      if (plan.kind === 'unsupported') {
        await this.videos.save(markFailed(processing, plan.reason));
        return;
      }
      await this.processor.normalize(processing, plan);
      await this.videos.save(
        markReady(processing, {
          durationSeconds: probe.durationSeconds,
          width: probe.width,
          height: probe.height,
        }),
      );
    } catch (error) {
      // Let the queue retry transient problems; only give up visibly on the last attempt.
      if (input.isLastAttempt) await this.videos.save(markFailed(processing, 'PROCESSING_ERROR'));
      throw error;
    }
  }
}
