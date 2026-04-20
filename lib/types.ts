export type WsMessage = { type: "PING"; payload: { ts: number } };

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  browser: string | null;
  os: string | null;
  ip: string | null;
  created_at: Date;
  last_seen_at: Date;
}
