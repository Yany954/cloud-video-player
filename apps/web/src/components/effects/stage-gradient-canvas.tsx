'use client';

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';

/**
 * The moving light. Loaded only in the browser, only after the page is shown (see
 * stage-gradient.tsx). The library bundles its own 3D engine and, with `lightType="3d"`,
 * fetches nothing from other servers.
 */
export default function StageGradientCanvas({
  subtle,
  colors,
}: {
  subtle: boolean;
  /** Base, main and accent. Defaults to night sky, the app's cobalt, and a warm spotlight. */
  colors?: readonly [string, string, string];
}) {
  const [base, main, accent] = colors ?? ['#0b1230', '#2447d6', '#c2630c'];
  return (
    <ShaderGradientCanvas
      // One device pixel per CSS pixel is plenty for a blurry gradient, and far cheaper.
      pixelDensity={1}
      pointerEvents="none"
      powerPreference="low-power"
      style={{ position: 'absolute', inset: 0 }}
    >
      <ShaderGradient
        control="props"
        type="waterPlane"
        animate="on"
        uSpeed={subtle ? 0.08 : 0.14}
        uStrength={subtle ? 1.6 : 2.4}
        uDensity={1.1}
        uFrequency={5.5}
        color1={base}
        color2={main}
        color3={accent}
        lightType="3d"
        brightness={subtle ? 0.9 : 1.05}
        grain="off"
        cAzimuthAngle={170}
        cPolarAngle={70}
        cDistance={4.2}
        cameraZoom={1}
        positionX={0}
        positionY={0.6}
        positionZ={0}
        rotationX={0}
        rotationY={8}
        rotationZ={-55}
        reflection={0.1}
        enableTransition={false}
      />
    </ShaderGradientCanvas>
  );
}
