import { describe, expect, it } from 'vitest';
import { moveDown, moveItem, moveUp, sameOrder } from './order';

const items = ['a', 'b', 'c', 'd'];

describe('moveUp and moveDown', () => {
  it('moves one place earlier or later', () => {
    expect(moveUp(items, 2)).toEqual(['a', 'c', 'b', 'd']);
    expect(moveDown(items, 0)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('leaves the first and the last where they are', () => {
    expect(moveUp(items, 0)).toEqual(items);
    expect(moveDown(items, 3)).toEqual(items);
  });

  it('never changes the original list', () => {
    moveUp(items, 3);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('moveItem', () => {
  it('drops an item at any position, shifting the others', () => {
    expect(moveItem(items, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('ignores an index outside the list and clamps the target', () => {
    expect(moveItem(items, 9, 0)).toEqual(items);
    expect(moveItem(items, 0, 99)).toEqual(['b', 'c', 'd', 'a']);
  });
});

describe('sameOrder', () => {
  it('compares position by position', () => {
    expect(sameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameOrder(['a'], ['a', 'b'])).toBe(false);
  });
});
