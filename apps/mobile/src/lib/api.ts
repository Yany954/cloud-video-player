import { createHttpUploadApi } from '@cvp/upload-client';
import { getAccessToken } from './auth/cognito';
import { env } from './env';

/** The same API client the website uses; only where the token comes from differs. */
export const api = createHttpUploadApi({ baseUrl: env.apiUrl, getAccessToken });
