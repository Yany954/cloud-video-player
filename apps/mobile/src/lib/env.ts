/** Public settings, inlined by Expo at build time from `.env` (see `.env.example`). */
export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? '',
  userPoolId: process.env.EXPO_PUBLIC_USER_POOL_ID ?? '',
  userPoolClientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID ?? '',
  /** The website, for pages the app links to (terms, privacy). */
  webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? 'https://main.d1fywgy7g1rdyk.amplifyapp.com',
};
