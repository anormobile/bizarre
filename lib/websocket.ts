import sql from "@/lib/db";
import type { WsMessage, PresenceStatus } from "@/lib/types";

type WsLike = { readyState: number; send: (data: string) => void };

const OPEN = 1;

declare global {
  // eslint-disable-next-line no-var
  var __bizarreWsConnections__: Map<string, Set<WsLike>> | undefined;
}

export function broadcast(userIds: string[], msg: WsMessage): number {
  const map = globalThis.__bizarreWsConnections__;
  if (!map) return 0;

  const json = JSON.stringify(msg);
  let count = 0;

  for (const uid of userIds) {
    const sockets = map.get(uid);
    if (!sockets) continue;
    for (const ws of sockets) {
      if (ws.readyState !== OPEN) continue;
      try {
        ws.send(json);
        count++;
      } catch {
        /* swallow per-socket errors */
      }
    }
  }

  return count;
}

export async function getPresenceMap(userIds: string[]): Promise<Record<string, PresenceStatus>> {
  if (userIds.length === 0) return {};
  const rows = await sql<{ user_id: string; status: PresenceStatus }[]>`
    SELECT user_id, status FROM user_presence WHERE user_id = ANY(${userIds})
  `;
  const map: Record<string, PresenceStatus> = {};
  for (const row of rows) {
    map[row.user_id] = row.status;
  }
  return map;
}
