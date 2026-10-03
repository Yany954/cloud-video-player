'use client';

import type { VideoResponse } from '@cvp/shared';
import { useEffect, useState } from 'react';
import { ReviewActions } from '@/components/moderation/review-actions';
import { VideoList } from '@/components/video/video-list';
import { uploadApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';

export default function ReviewPage() {
  const { state } = useAuth();
  const isAdmin = state.status === 'signedIn' && state.user.isAdmin;
  const [videos, setVideos] = useState<VideoResponse[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    uploadApi.listReviewQueue().then(
      (response) => active && setVideos(response.videos),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [isAdmin]);

  // The server refuses non-admins anyway; this only avoids showing them a broken page.
  if (!isAdmin) {
    return (
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Review</h1>
        <p className="text-muted-foreground">Only admins can review videos.</p>
      </div>
    );
  }

  function reviewed(video: VideoResponse) {
    setError('');
    setNotice(
      video.moderationStatus === 'approved'
        ? `“${video.title}” is approved and now in the library.`
        : `“${video.title}” was rejected.`,
    );
    setVideos((current) => current?.filter((item) => item.id !== video.id) ?? null);
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Review</h1>
        <p className="text-muted-foreground text-sm">
          Watch each video before deciding. Approved videos appear in the library for everyone.
        </p>
      </div>
      <div className="grid gap-3">
        {/* Always rendered, never display:none, so screen readers announce each change. */}
        <p role="status" className="text-sm empty:sr-only">
          {notice}
        </p>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <VideoList
          id="review-title"
          title="Waiting for review"
          videos={videos}
          failed={failed}
          errorText="The review queue could not be loaded. Reload the page to try again."
          empty={{ title: 'All caught up', text: 'No videos are waiting for review.' }}
          from="review"
          renderActions={(video) => (
            <ReviewActions
              video={video}
              status={video.moderationStatus}
              onReviewed={reviewed}
              onError={(message) => {
                setNotice('');
                setError(message);
              }}
            />
          )}
        />
      </div>
    </div>
  );
}
