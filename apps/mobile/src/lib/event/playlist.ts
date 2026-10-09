import AsyncStorage from '@react-native-async-storage/async-storage';

// Continuous play of an event: which video comes next, and the viewer's autoplay choice.
// The same rules as the website's (apps/web/src/lib/event/playlist.ts).

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

/** On unless the viewer turned it off on this phone. */
export async function readAutoplay(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(AUTOPLAY_KEY)) !== 'off';
  } catch {
    return true;
  }
}

export async function writeAutoplay(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTOPLAY_KEY, on ? 'on' : 'off');
  } catch {
    // The choice then lasts until the app is closed.
  }
}
