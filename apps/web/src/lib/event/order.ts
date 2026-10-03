/** Moves the item at `from` to position `to`, shifting the ones in between. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  if (from < 0 || from >= result.length) return result;
  const target = Math.max(0, Math.min(result.length - 1, to));
  const [moved] = result.splice(from, 1);
  result.splice(target, 0, moved as T);
  return result;
}

/** One place earlier; the first item stays first. */
export function moveUp<T>(items: readonly T[], index: number): T[] {
  return moveItem(items, index, index - 1);
}

/** One place later; the last item stays last. */
export function moveDown<T>(items: readonly T[], index: number): T[] {
  return moveItem(items, index, index + 1);
}

export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
