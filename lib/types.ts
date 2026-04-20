export interface WsMessageBase<T extends string, P> {
  type: T;
  payload: P;
  timestamp: number;
}

export type BroadcastTestMessage = WsMessageBase<
  "BROADCAST_TEST",
  { text: string }
>;

export type MemberJoinedMessage = WsMessageBase<
  "MEMBER_JOINED",
  { roomId: number; userId: string; username: string; role: "owner" | "admin" | "member" }
>;

export type MemberLeftMessage = WsMessageBase<
  "MEMBER_LEFT",
  { roomId: number; userId: string; reason: "leave" | "delete" }
>;

export type RoomUpdatedMessage = WsMessageBase<
  "ROOM_UPDATED",
  { roomId: number; name: string; description: string | null; visibility: "public" | "private" }
>;

export type RoomDeletedMessage = WsMessageBase<
  "ROOM_DELETED",
  { roomId: number }
>;

export type MessageNewMessage = WsMessageBase<
  "MESSAGE_NEW",
  { roomId: number; message: MessageView }
>;

export type MessageEditedMessage = WsMessageBase<
  "MESSAGE_EDITED",
  { roomId: number; messageId: number; content: string; editedAt: string }
>;

export type MessageDeletedMessage = WsMessageBase<
  "MESSAGE_DELETED",
  { roomId: number; messageId: number }
>;

export type FriendRequestReceivedMessage = WsMessageBase<
  "FRIEND_REQUEST_RECEIVED",
  { fromUserId: string; fromUsername: string; note: string | null }
>;

export type FriendRequestAcceptedMessage = WsMessageBase<
  "FRIEND_REQUEST_ACCEPTED",
  { userId: string; username: string }
>;

export type WsMessage =
  | BroadcastTestMessage
  | MemberJoinedMessage
  | MemberLeftMessage
  | RoomUpdatedMessage
  | RoomDeletedMessage
  | MessageNewMessage
  | MessageEditedMessage
  | MessageDeletedMessage
  | FriendRequestReceivedMessage
  | FriendRequestAcceptedMessage;

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

export interface RoomRow {
  id: number;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  owner_id: string;
  created_at: Date;
  deleted_at: Date | null;
}

export interface RoomMemberRow {
  room_id: number;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: Date;
}

export interface MessageRow {
  id: number;
  room_id: number | null;
  dm_id: number | null;
  user_id: string;
  content: string;
  reply_to_id: number | null;
  edited_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
}

export interface MessageView {
  id: number;
  roomId: number | null;
  dmId: number | null;
  userId: string;
  username: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface RoomSummary {
  id: number;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  ownerId: string;
  memberCount: number;
  joinedAt?: string;
}

export interface FriendshipRow {
  user_a: string;
  user_b: string;
  status: "pending" | "confirmed";
  requested_by: string;
  note: string | null;
  created_at: Date;
}

export interface UserSummary {
  userId: string;
  username: string;
  friendship: "none" | "pending_outgoing" | "pending_incoming" | "confirmed";
}

export interface FriendView {
  userId: string;
  username: string;
  since: string;
}

export interface FriendRequestView {
  userId: string;
  username: string;
  note: string | null;
  createdAt: string;
}
