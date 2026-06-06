import { useEffect, useRef, useState, useCallback } from "react";
import { BurnInConfig, DEFAULT_CONFIG } from "../components/burn-in/config";

interface PixelShift {
  x: number;
  y: number;
}

interface BurnInState {
  shift: PixelShift;
  isNight: boolean;
  nightBrightness: number;
  showScreensaver: boolean;
}

function isNightHour(hour: number, nightStart: number, nightEnd: number): boolean {
  if (nightStart > nightEnd) {
    // Über Mitternacht: z.B. 22–7
    return hour >= nightStart || hour < nightEnd;
  }
  return hour >= nightStart && hour < nightEnd;
}

function randomShift(max: number): number {
  return Math.round((Math.random() * 2 - 1) * max);
}

export function useBurnInProtection(config: BurnInConfig = DEFAULT_CONFIG) {
  const [state, setState] = useState<BurnInState>({
    shift: { x: 0, y: 0 },
    isNight: false,
    nightBrightness: config.nightBrightness,
    showScreensaver: false,
  });

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pixelShiftTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nightCheckTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prüft ob Nacht-Modus aktiv sein soll
  const checkNight = useCallback(() => {
    const hour = new Date().getHours();
    const night = isNightHour(hour, config.nightStart, config.nightEnd);
    setState((prev) => ({
      ...prev,
      isNight: night,
      nightBrightness: config.nightBrightness,
    }));
  }, [config.nightStart, config.nightEnd, config.nightBrightness]);

  // Inaktivitäts-Timer zurücksetzen
  const resetInactivity = useCallback(() => {
    setState((prev) => {
      if (!prev.showScreensaver) return prev;
      return { ...prev, showScreensaver: false };
    });

    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);

    inactivityTimer.current = setTimeout(() => {
      setState((prev) => ({ ...prev, showScreensaver: true }));
    }, config.screensaverTimeout);
  }, [config.screensaverTimeout]);

  // Pixel-Shift
  useEffect(() => {
    pixelShiftTimer.current = setInterval(() => {
      setState((prev) => ({
        ...prev,
        shift: {
          x: randomShift(config.pixelShiftMax),
          y: randomShift(config.pixelShiftMax),
        },
      }));
    }, config.pixelShiftInterval);

    return () => {
      if (pixelShiftTimer.current) clearInterval(pixelShiftTimer.current);
    };
  }, [config.pixelShiftInterval, config.pixelShiftMax]);

  // Nacht-Check stündlich
  useEffect(() => {
    checkNight();
    nightCheckTimer.current = setInterval(checkNight, 60 * 1000);
    return () => {
      if (nightCheckTimer.current) clearInterval(nightCheckTimer.current);
    };
  }, [checkNight]);

  // Inaktivitäts-Listener
  useEffect(() => {
    const events = ["touchstart", "touchmove", "mousedown", "mousemove", "keydown"];
    events.forEach((e) => window.addEventListener(e, resetInactivity, { passive: true }));
    resetInactivity(); // Initialer Start

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivity));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivity]);

  const dismissScreensaver = useCallback(() => {
    setState((prev) => ({ ...prev, showScreensaver: false }));
    resetInactivity();
  }, [resetInactivity]);

  return { ...state, dismissScreensaver };
}
