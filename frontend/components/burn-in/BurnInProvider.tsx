"use client";

import { ReactNode } from "react";
import { useBurnInProtection } from "../../hooks/useBurnInProtection";
import { Screensaver } from "./Screensaver";
import { BurnInConfig, DEFAULT_CONFIG } from "./config";

interface BurnInProviderProps {
  children: ReactNode;
  config?: Partial<BurnInConfig>;
}

export function BurnInProvider({ children, config }: BurnInProviderProps) {
  const mergedConfig: BurnInConfig = { ...DEFAULT_CONFIG, ...config };
  const { shift, isNight, nightBrightness, showScreensaver, dismissScreensaver } =
    useBurnInProtection(mergedConfig);

  return (
    <>
      {/* Pixel-Shift: verschiebt das gesamte Layout minimal */}
      <div
        style={{
          transform: `translate(${shift.x}px, ${shift.y}px)`,
          transition: "transform 4s ease-in-out",
          display: "flex",
          flex: 1,
          height: "100dvh",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {children}
      </div>

      {/* Nacht-Dimm: dunkle Overlay-Ebene */}
      {isNight && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9990,
            background: "#000",
            opacity: 1 - nightBrightness,
            pointerEvents: "none",
            transition: "opacity 60s ease",
          }}
        />
      )}

      {/* Inaktivitäts-Screensaver */}
      {showScreensaver && <Screensaver onDismiss={dismissScreensaver} />}
    </>
  );
}