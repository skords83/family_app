// frontend/hooks/useSSE.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';

export type SSEEventType =
  | 'task_updated'
  | 'points_updated'
  | 'reward_claimed'
  | 'shopping_updated'
  | 'config_updated'
  | 'ping';

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}

type SSEHandler = (event: SSEEvent) => void;

/**
 * Subscribt auf den SSE-Stream des Backends.
 * Reconnect mit Exponential Backoff bei Verbindungsabbruch.
 *
 * @param handlers  Map von EventType → Callback
 *
 * @example
 * useSSE({
 *   task_updated: () => refetchTasks(),
 *   points_updated: (e) => refetchPoints(e.data.user_id as string),
 * });
 */
export function useSSE(handlers: Partial<Record<SSEEventType, SSEHandler>>): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers; // immer aktuelle Callbacks ohne Re-Subscribe

  const retryDelay = useRef(1_000);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/events`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event: SSEEvent = JSON.parse(e.data);

        if (event.type === 'ping') {
          retryDelay.current = 1_000; // Reset Backoff bei erfolgreichem Heartbeat
          return;
        }

        const handler = handlersRef.current[event.type];
        handler?.(event);
      } catch {
        // Kaputtes JSON ignorieren
      }
    };

    es.onopen = () => {
      retryDelay.current = 1_000;
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;

      // Exponential Backoff: 1s → 2s → 4s → max 30s
      const delay = Math.min(retryDelay.current, 30_000);
      retryDelay.current = Math.min(delay * 2, 30_000);

      setTimeout(connect, delay);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);
}
