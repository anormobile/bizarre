'use client';

import type { PresenceStatus } from "@/lib/types";

export function PresenceDot({ status }: { status: PresenceStatus }) {
  const bg = status === "online" ? "bg-green-500" : "bg-zinc-500";
  return (
    <span
      aria-label={`presence-${status}`}
      className={`inline-block h-2 w-2 rounded-full ${bg}`}
    />
  );
}
