"use client";

import { useEffect, useState, useRef } from "react";

interface ScreensaverProps {
  onDismiss: () => void;
}

interface ClockPos {
  x: number; // 0–100 (vw)
  y: number; // 0–100 (vh)
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Sanfter Bounce innerhalb des sicheren Bereichs */
function useBouncingPosition(padding = 15) {
  const [pos, setPos] = useState<ClockPos>({ x: 50, y: 50 });
  const vel = useRef({ x: 0.04, y: 0.03 }); // % pro Frame

  useEffect(() => {
    let frame: number;
    let current = { x: 50, y: 50 };

    const tick = () => {
      current.x += vel.current.x;
      current.y += vel.current.y;

      if (current.x <= padding || current.x >= 100 - padding) {
        vel.current.x *= -1;
        current.x = Math.max(padding, Math.min(100 - padding, current.x));
      }
      if (current.y <= padding || current.y >= 100 - padding) {
        vel.current.y *= -1;
        current.y = Math.max(padding, Math.min(100 - padding, current.y));
      }

      setPos({ x: current.x, y: current.y });
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [padding]);

  return pos;
}

export function Screensaver({ onDismiss }: ScreensaverProps) {
  const [now, setNow] = useState(new Date());
  const pos = useBouncingPosition(18);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function handleDismiss(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation();
    e.preventDefault();
    onDismiss();
  }

  return (
    <div
      className="screensaver"
      onClick={handleDismiss}
      onTouchStart={handleDismiss}
      aria-label="Tippen zum Fortfahren"
    >
      <div
        className="screensaver-clock"
        style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      >
        <span className="screensaver-time">{formatTime(now)}</span>
        <span className="screensaver-date">{formatDate(now)}</span>
      </div>

      <style>{`
        .screensaver {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #000;
          cursor: none;
          animation: screensaver-fade-in 1.5s ease forwards;
        }

        @keyframes screensaver-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .screensaver-clock {
          position: absolute;
          transform: translate(-50%, -50%);
          text-align: center;
          pointer-events: none;
          /* Keine transition — der Bounce soll smooth via rAF laufen */
        }

        .screensaver-time {
          display: block;
          font-size: clamp(3rem, 8vw, 7rem);
          font-weight: 100;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.18);
          font-variant-numeric: tabular-nums;
          font-family: ui-monospace, "SF Mono", monospace;
          line-height: 1;
        }

        .screensaver-date {
          display: block;
          margin-top: 0.5rem;
          font-size: clamp(0.75rem, 1.8vw, 1.1rem);
          font-weight: 300;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.10);
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
      `}</style>
    </div>
  );
}