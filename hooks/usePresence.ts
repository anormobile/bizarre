'use client';

import { useSyncExternalStore } from "react";
import type { PresenceStatus } from "@/lib/types";

const presenceMap = new Map<string, PresenceStatus>();
const listeners = new Set<() => void>();

function notify() {
  for (const cb of listeners) {
    cb();
  }
}

export function setPresence(userId: string, status: PresenceStatus): void {
  presenceMap.set(userId, status);
  notify();
}

export function setPresenceBulk(entries: Record<string, PresenceStatus>): void {
  for (const [userId, status] of Object.entries(entries)) {
    presenceMap.set(userId, status);
  }
  notify();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function usePresence(userId: string): PresenceStatus {
  return useSyncExternalStore(
    subscribe,
    () => presenceMap.get(userId) ?? "offline",
    () => "offline",
  );
}
