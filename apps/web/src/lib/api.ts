import { createHttpUploadApi } from '@cvp/upload-client';
import { getAccessToken } from './auth/cognito';

export const uploadApi = createHttpUploadApi({
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
  getAccessToken,
});
