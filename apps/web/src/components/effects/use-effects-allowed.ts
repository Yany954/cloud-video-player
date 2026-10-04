'use client';

import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';

// Decides whether a WebGL effect may be shown, and whether it should be moving right now.
// The effects are decoration: every reason to skip them leaves the static fallback in place.

let webGlAvailable: boolean | null = null;

function hasWebGl(): boolean {
  if (webGlAvailable === null) {
    try {
      const canvas = document.createElement('canvas');
      webGlAvailable = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    } catch {
      webGlAvailable = false;
    }
  }
  return webGlAvailable;
}

function subscribeToMedia(query: string) {
  return (notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', notify);
    return () => media.removeEventListener('change', notify);
  };
}
const subscribeReducedMotion = subscribeToMedia('(prefers-reduced-motion: reduce)');

function subscribeVisibility(notify: () => void) {
  document.addEventListener('visibilitychange', notify);
  return () => document.removeEventListener('visibilitychange', notify);
}

/** True when the visitor asked their browser to save data. */
function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

export interface EffectsAllowed {
  /** The effect may be created: WebGL works, motion is welcome, and the first paint is done. */
  mount: boolean;
  /** It should be drawing: also on screen, in a visible tab. */
  running: boolean;
}

export function useEffectsAllowed(target: RefObject<HTMLElement | null>): EffectsAllowed {
  // On the server, and for the first client render: no effect, so the HTML is the fallback.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  );
  const tabVisible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => false,
  );
  const [idle, setIdle] = useState(false);
  const [onScreen, setOnScreen] = useState(false);

  // Wait until the page has painted and the browser has a free moment.
  useEffect(() => {
    const done = () => setIdle(true);
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(done, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(done, 300);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry?.isIntersecting ?? false),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [target]);

  const mount = idle && !reducedMotion && hasWebGl() && !savesData();
  return { mount, running: mount && onScreen && tabVisible };
}
