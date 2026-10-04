// Continuous play of an event: which video comes next, and the viewer's autoplay choice.

const AUTOPLAY_KEY = 'cvp.autoplay-next';

/** The id after `currentId`, or null at the end of the list (or if it is not in it). */
export function nextId(ids: readonly string[], currentId: string | null): string | null {
  const index = currentId === null ? -1 : ids.indexOf(currentId);
  return index === -1 ? null : (ids[index + 1] ?? null);
}

export function previousId(ids: readonly string[], currentId: string | null): string | null {
  const index = currentId === null ? -1 : ids.indexOf(currentId);
  return index <= 0 ? null : (ids[index - 1] ?? null);
}

/** The video to start with: the one asked for when it is playable, else the first. */
export function startingId(ids: readonly string[], requested: string | null): string | null {
  return requested !== null && ids.includes(requested) ? requested : (ids[0] ?? null);
}

/** On unless the viewer turned it off in this browser. */
export function readAutoplay(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    return storage?.getItem(AUTOPLAY_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function writeAutoplay(storage: Pick<Storage, 'setItem'> | undefined, on: boolean): void {
  try {
    storage?.setItem(AUTOPLAY_KEY, on ? 'on' : 'off');
  } catch {
    // Storage can be unavailable (private mode): the choice then lasts for this page only.
  }
}
