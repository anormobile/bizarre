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

export interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: Date;
  deleted_at: Date | null;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
}
