'use client';

import { useSyncExternalStore } from "react";

const unreadMap = new Map<string, number>();
const listeners = new Set<() => void>();

function notify() {
  for (const cb of listeners) cb();
}

export function increment(key: string): void {
  unreadMap.set(key, (unreadMap.get(key) ?? 0) + 1);
  notify();
}

export function clear(key: string): void {
  if (unreadMap.get(key)) {
    unreadMap.set(key, 0);
    notify();
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useUnread(key: string): number {
  return useSyncExternalStore(
    subscribe,
    () => unreadMap.get(key) ?? 0,
    () => 0,
  );
}
