'use client';

import { LiquidMetal } from '@paper-design/shaders-react';

/**
 * The logo as liquid metal, using the LiquidMetal shader of @paper-design/shaders-react
 * (Apache-2.0). Loaded only in the browser, after the page is shown.
 */
export default function LiquidMetalCanvas() {
  return (
    <LiquidMetal
      image="/brand-mark.svg"
      colorBack="#00000000"
      colorTint="#dfe8ff"
      speed={0.7}
      repetition={3}
      softness={0.25}
      shiftRed={0.3}
      shiftBlue={0.4}
      distortion={0.1}
      contour={0.6}
      angle={70}
      scale={0.82}
      // Sharp enough for a logo, bounded so a large screen does not cost a large canvas.
      maxPixelCount={640 * 640}
      style={{ position: 'absolute', inset: 0 }}
    />
  );
}
