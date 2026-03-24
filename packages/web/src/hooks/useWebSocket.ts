import { useEffect, useRef, useCallback } from 'react';

export type WsEventType =
  | 'machine.position_updated'
  | 'assignment.status_changed'
  | 'alert.created'
  | 'convoy.desync'
  | 'plan.dispatched'
  | 'replan.proposed'
  | 'briefing.ready'
  | 'breakdown.reported'
  | 'anomaly.detected'
  | 'field.completed';

export interface WsMessage {
  event: WsEventType;
  payload: Record<string, unknown>;
}

type Handler = (payload: Record<string, unknown>) => void;

interface UseWebSocketOptions {
  url?: string;
  /** When true, uses a mock emitter instead of a real WebSocket (local dev) */
  mock?: boolean;
  onMessage?: (msg: WsMessage) => void;
  reconnectMs?: number;
}

export function useWebSocket({
  url,
  mock = true,
  onMessage,
  reconnectMs = 3000,
}: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Partial<Record<WsEventType, Handler[]>>>({});
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subscribe = useCallback((event: WsEventType, handler: Handler) => {
    if (!handlersRef.current[event]) handlersRef.current[event] = [];
    handlersRef.current[event]!.push(handler);
    return () => {
      handlersRef.current[event] = handlersRef.current[event]!.filter(h => h !== handler);
    };
  }, []);

  const emit = useCallback((msg: WsMessage) => {
    onMessage?.(msg);
    const handlers = handlersRef.current[msg.event];
    handlers?.forEach(h => h(msg.payload));
  }, [onMessage]);

  useEffect(() => {
    if (mock) {
      // ── Mock mode: simulate machine position updates every 5s ──────────────
      const interval = setInterval(() => {
        emit({
          event: 'machine.position_updated',
          payload: {
            machine_id: `c0${Math.ceil(Math.random() * 8)}`,
            speed_mph: +(Math.random() * 5).toFixed(1),
            fuel_pct: Math.floor(Math.random() * 40 + 50),
          },
        });
      }, 5000);

      // Simulate a breakdown alert after 15s (demo)
      const alertTimer = setTimeout(() => {
        emit({
          event: 'alert.created',
          payload: {
            id: 'al-demo',
            level: 'critical',
            title: 'Elevated engine temp',
            machine_name: 'Combine 14',
            created_at: 'just now',
          },
        });
      }, 15000);

      return () => {
        clearInterval(interval);
        clearTimeout(alertTimer);
      };
    }

    // ── Real WebSocket ────────────────────────────────────────────────────────
    function connect() {
      if (!url) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg: WsMessage = JSON.parse(e.data);
          emit(msg);
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        reconnectTimer.current = setTimeout(connect, reconnectMs);
      };
    }

    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [url, mock, emit, reconnectMs]);

  const send = useCallback((msg: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { subscribe, send };
}
