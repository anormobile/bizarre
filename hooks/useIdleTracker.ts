'use client';

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL = 20_000;

export function useIdleTracker(
  send: (data: string) => void,
  idleThresholdMs: number = 60_000,
) {
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    function onActivity() {
      lastActivityRef.current = Date.now();
    }

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart", "focus"] as const;
    for (const ev of events) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    let lastSentStatus = "";

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const status = elapsed >= idleThresholdMs ? "afk" : "online";
      const msg = JSON.stringify({
        type: "PRESENCE_HEARTBEAT",
        payload: { status },
      });
      send(msg);
      if (status !== lastSentStatus) {
        lastSentStatus = status;
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(interval);
      for (const ev of events) {
        window.removeEventListener(ev, onActivity);
      }
    };
  }, [send, idleThresholdMs]);
}
