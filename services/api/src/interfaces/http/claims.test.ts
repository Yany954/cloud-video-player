import { describe, expect, it } from 'vitest';
import { parseGroups } from './claims';

describe('parseGroups', () => {
  it.each([
    ['[admin user]', ['admin', 'user']],
    ['[admin]', ['admin']],
    ['[]', []],
    [
      ['admin', 'user'],
      ['admin', 'user'],
    ],
    [undefined, []],
    [42, []],
  ])('parses %j', (claim, expected) => {
    expect(parseGroups(claim)).toEqual(expected);
  });
});
