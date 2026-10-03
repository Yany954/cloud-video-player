import { z } from 'zod';

// Request contract of the admin review endpoint, shared by api, web and mobile.

export const reviewVideoRequestSchema = z.object({
  decision: z.enum(['approve', 'reject']),
});
export type ReviewVideoRequest = z.infer<typeof reviewVideoRequestSchema>;
export type ReviewDecision = ReviewVideoRequest['decision'];
