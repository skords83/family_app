// backend/src/sse.ts
import { Request, Response } from 'express';
import { EventEmitter } from 'events';

// ─── Event Types ────────────────────────────────────────────────────────────

export type SSEEventType =
  | 'task_updated'        // Aufgabe abgehakt / wieder geöffnet
  | 'task_uncompleted'    // Aufgabe wurde zurückgesetzt (Kind bekommt Notification)
  | 'points_updated'      // Punktestand geändert
  | 'reward_claimed'      // Belohnung eingelöst / genehmigt
  | 'shopping_updated'    // Einkaufsliste geändert
  | 'config_updated'      // Widget-Konfiguration geändert
  | 'ping';               // Heartbeat (kein Reload nötig)

export interface SSEEvent {
  type: SSEEventType;
  /** Optionale Payload — Frontend entscheidet, was es re-fetcht */
  data?: Record<string, unknown>;
}

// ─── Singleton Emitter ───────────────────────────────────────────────────────

export const sseEmitter = new EventEmitter();
sseEmitter.setMaxListeners(100); // viele Tabs / Clients möglich

/** Überall im Backend aufrufen, um ein Event zu broadcasten */
export function emitSSE(event: SSEEvent): void {
  sseEmitter.emit('event', event);
}

// ─── Express Handler ─────────────────────────────────────────────────────────

export function sseHandler(req: Request, res: Response): void {
  // SSE-Header
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx / Traefik: Buffering deaktivieren
  res.flushHeaders();

  // Sofort ein erstes Event senden, damit der Client weiß dass die Verbindung steht
  sendEvent(res, { type: 'ping' });

  // Heartbeat alle 25 Sekunden — verhindert Timeout bei Proxies / Traefik
  const heartbeat = setInterval(() => {
    sendEvent(res, { type: 'ping' });
  }, 25_000);

  // Listener für alle Events
  const listener = (event: SSEEvent) => {
    sendEvent(res, event);
  };

  sseEmitter.on('event', listener);

  // Cleanup wenn Client die Verbindung trennt
  req.on('close', () => {
    clearInterval(heartbeat);
    sseEmitter.off('event', listener);
  });
}

function sendEvent(res: Response, event: SSEEvent): void {
  const payload = JSON.stringify({ type: event.type, data: event.data ?? {} });
  res.write(`data: ${payload}\n\n`);
  // Flush für Node http — wichtig bei Compression-Middleware
  if (typeof (res as any).flush === 'function') {
    (res as any).flush();
  }
}
