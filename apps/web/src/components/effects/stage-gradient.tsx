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
export function StageGradient({ subtle = false }: { subtle?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { running } = useEffectsAllowed(ref);
  return (
    <div ref={ref} aria-hidden className="stage-fallback absolute inset-0 overflow-hidden">
      {running && (
        <div className="effect-fade-in absolute inset-0">
          <Canvas subtle={subtle} />
        </div>
      )}
    </div>
  );
}
