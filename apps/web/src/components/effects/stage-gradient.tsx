'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { useEffectsAllowed } from './use-effects-allowed';

// Never part of the server's HTML or the first bundle.
const Canvas = dynamic(() => import('./stage-gradient-canvas'), { ssr: false });

/**
 * A stage-lighting background. What the server sends, and what stays when WebGL is missing or
 * reduced motion is on, is the static CSS gradient `stage-fallback`. The canvas fades in over
 * it and is removed while off screen, so nothing is drawn that nobody sees.
 */
export function StageGradient({
  subtle = false,
  colors,
  fallback,
}: {
  subtle?: boolean;
  /** Base, main and accent colours. Without them, the app's own stage lights. */
  colors?: readonly [string, string, string];
  /** The CSS background to show under (and instead of) the canvas when `colors` is given. */
  fallback?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { running } = useEffectsAllowed(ref);
  return (
    <div
      ref={ref}
      aria-hidden
      className={`absolute inset-0 overflow-hidden ${fallback ? '' : 'stage-fallback'}`}
      style={fallback ? { background: fallback } : undefined}
    >
      {running && (
        <div className="effect-fade-in absolute inset-0">
          <Canvas subtle={subtle} colors={colors} />
        </div>
      )}
    </div>
  );
}
