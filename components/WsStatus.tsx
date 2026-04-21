"use client";

import { useCallback, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { WsMessage } from "@/lib/types";

export function WsStatus() {
  const [lastText, setLastText] = useState("");

  const onMessage = useCallback((msg: WsMessage) => {
    if (msg.type === "BROADCAST_TEST") {
      setLastText(msg.payload.text);
    }
  }, []);

  const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3000";
  const url = `${proto}//${host}/ws`;

  const { status } = useWebSocket(url, onMessage);

  return (
    <div className="flex flex-col items-center gap-2 text-sm">
      <p>
        WebSocket:{" "}
        <span data-testid="ws-status" className="font-medium">
          {status}
        </span>
      </p>
      <p data-testid="ws-last-message">{lastText}</p>
    </div>
  );
}
