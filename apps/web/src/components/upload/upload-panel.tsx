'use client';

import type { StorageUsageResponse } from '@cvp/shared';
import { useCallback, useEffect, useState } from 'react';
import { StorageWidget } from '@/components/storage/storage-widget';
import { uploadApi } from '@/lib/api';
import { useUploads } from '@/lib/upload/use-uploads';
import { Dropzone } from './dropzone';
import { UploadList } from './upload-list';

export function UploadPanel({ userId }: { userId: string }) {
  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);

  const refreshUsage = useCallback(() => {
    uploadApi.getStorageUsage().then(setUsage, () => {});
  }, []);
  useEffect(refreshUsage, [refreshUsage]);

  const uploads = useUploads(userId, refreshUsage);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="grid gap-8">
        <Dropzone onFiles={uploads.add} />
        <UploadList
          items={uploads.items}
          onPause={uploads.pause}
          onResume={uploads.resume}
          onCancel={uploads.cancel}
          onDismiss={uploads.dismiss}
        />
      </div>
      <StorageWidget usage={usage} />
    </div>
  );
}
