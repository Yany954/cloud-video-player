/* eslint-disable @next/next/no-img-element -- a small local SVG; nothing for the image optimizer to do. */
'use client';

import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { useEffectsAllowed } from './use-effects-allowed';

const Canvas = dynamic(() => import('./liquid-metal-canvas'), { ssr: false });

/**
 * The brand mark. The plain mark is always in the page; the liquid-metal version is drawn over
 * it when effects are allowed, and removed while off screen. Decorative: the name is in text
 * next to it.
 */
export function LiquidMetalLogo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { running } = useEffectsAllowed(ref);
  return (
    <div ref={ref} aria-hidden className={`relative aspect-square ${className ?? ''}`}>
      <img
        src="/brand-mark.svg"
        alt=""
        width={240}
        height={240}
        className={`brand-mark-static absolute inset-[9%] size-[82%] transition-opacity duration-700 motion-reduce:transition-none ${
          running ? 'opacity-0' : 'opacity-100'
        }`}
      />
      {running && (
        <div className="effect-fade-in absolute inset-0">
          <Canvas />
        </div>
      )}
    </div>
  );
}
