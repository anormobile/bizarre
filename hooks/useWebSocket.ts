"use client";

import { useEffect, useRef, useCallback } from "react";
import type { WsMessage } from "@/lib/types";

const MAX_BACKOFF_MS = 10_000;

export function useWebSocket(
  url: string,
  onMessage: (msg: WsMessage) => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(1_000);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1_000;
    };

    ws.onmessage = (event) => {
      try {
        const data: WsMessage = JSON.parse(event.data as string);
        onMessageRef.current(data);
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onclose = () => {
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
}
