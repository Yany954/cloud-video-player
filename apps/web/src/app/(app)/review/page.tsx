'use client';

import type { ReviewItemResponse, VideoResponse } from '@cvp/shared';
import { useEffect, useState } from 'react';
import { ReviewActions } from '@/components/moderation/review-actions';
import { VideoList } from '@/components/video/video-list';
import { uploadApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { useFormat, useI18n } from '@/lib/i18n/i18n-context';

export default function ReviewPage() {
  const { state } = useAuth();
  const { t } = useI18n();
  const fmt = useFormat();
  const r = t.review;
  const isAdmin = state.status === 'signedIn' && state.user.isAdmin;
  const [videos, setVideos] = useState<ReviewItemResponse[] | null>(null);
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
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{r.title}</h1>
        <p className="text-muted-foreground">{r.adminsOnly}</p>
      </div>
    );
  }

  function reviewed(video: VideoResponse) {
    setError('');
    setNotice(
      video.moderationStatus === 'approved'
        ? r.approvedNotice(video.title)
        : r.rejectedNotice(video.title),
    );
    setVideos((current) => current?.filter((item) => item.id !== video.id) ?? null);
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{r.title}</h1>
        <p className="text-muted-foreground text-sm">{r.intro}</p>
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
          title={r.queueTitle}
          videos={videos}
          failed={failed}
          errorText={r.loadError}
          empty={{ title: r.emptyTitle, text: r.emptyText }}
          from="review"
          renderDetails={(video) => {
            const reports = videos?.find((item) => item.id === video.id)?.reports ?? [];
            if (reports.length === 0) return null;
            return (
              <div className="grid gap-2 px-4 pb-4 sm:px-5">
                <p className="text-destructive text-sm font-medium">{r.reported(reports.length)}</p>
                <ul className="grid gap-1.5 text-sm">
                  {reports.map((report) => (
                    <li key={`${report.reporterEmail}-${report.createdAt}`}>
                      <span className="font-medium">{t.report.reasons[report.reason]}</span>
                      {report.note && <span>: “{report.note}”</span>}
                      <span className="text-muted-foreground">
                        {' '}
                        ({r.reportedBy}{' '}
                        <span translate="no">{report.reporterEmail ?? r.deletedAccount}</span>,{' '}
                        <time dateTime={report.createdAt}>{fmt.date(report.createdAt)}</time>)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }}
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
