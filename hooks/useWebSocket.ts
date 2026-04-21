"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { setPresence } from "@/hooks/usePresence";
import type { WsMessage } from "@/lib/types";

const MAX_BACKOFF_MS = 10_000;

export interface WsHandle {
  status: "connecting" | "connected";
  send: (data: string) => void;
}

export function useWebSocket(
  url: string,
  onMessage: (msg: WsMessage) => void,
): WsHandle {
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1_000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1_000;
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data: WsMessage = JSON.parse(event.data as string);
        if (data.type === "PRESENCE_CHANGED") {
          setPresence(data.payload.userId, data.payload.status);
        }
        onMessageRef.current(data);
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onclose = () => {
      setConnected(false);
      timerRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        connect();
      }, backoffRef.current);
    };
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { status: connected ? "connected" : "connecting", send };
}
