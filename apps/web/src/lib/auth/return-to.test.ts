import { describe, expect, it } from 'vitest';
import { isSafePath } from './return-to';

describe('isSafePath', () => {
  it.each(['/', '/events', '/events/abc/join#secret', '/videos/1?from=library'])(
    'accepts the in-app path %s',
    (path) => {
      expect(isSafePath(path)).toBe(true);
    },
  );

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'events',
    '',
    '/login',
  ])('refuses %s', (path) => {
    expect(isSafePath(path)).toBe(false);
  });
});
