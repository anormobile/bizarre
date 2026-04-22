'use client';

import type { PresenceStatus } from "@/lib/types";

interface PresenceDotProps {
  status: PresenceStatus;
  size?: number;
  borderColor?: string;
  className?: string;
}

export function PresenceDot({ status, size = 9, borderColor, className = '' }: PresenceDotProps) {
  const bg = status === 'online' ? 'bg-online' : status === 'afk' ? 'bg-afk' : 'bg-offline';

  return (
    <span
      aria-label={`presence-${status}`}
      className={`inline-block shrink-0 rounded-full ${bg} ${className}`}
      style={{
        width: size,
        height: size,
        border: borderColor ? `2px solid ${borderColor}` : undefined,
        boxSizing: 'border-box',
      }}
    />
  );
}
