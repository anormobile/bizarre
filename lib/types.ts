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

export type MemberLeftReason = 'leave' | 'delete' | 'banned';

export type MemberLeftMessage = WsMessageBase<
  "MEMBER_LEFT",
  { roomId: number; userId: string; reason: MemberLeftReason }
>;

export interface UserBanNotifyMessage extends WsMessageBase<
  'USER_BAN_NOTIFY',
  { roomId: number }
> {}

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
  | { roomId: number; dmId?: undefined; message: MessageView }
  | { dmId: number; roomId?: undefined; message: MessageView }
>;

export type MessageEditedMessage = WsMessageBase<
  "MESSAGE_EDITED",
  | { roomId: number; dmId?: undefined; messageId: number; content: string; editedAt: string }
  | { dmId: number; roomId?: undefined; messageId: number; content: string; editedAt: string }
>;

export type MessageDeletedMessage = WsMessageBase<
  "MESSAGE_DELETED",
  | { roomId: number; dmId?: undefined; messageId: number }
  | { dmId: number; roomId?: undefined; messageId: number }
>;

export type FriendRequestReceivedMessage = WsMessageBase<
  "FRIEND_REQUEST_RECEIVED",
  { fromUserId: string; fromUsername: string; note: string | null }
>;

export type FriendRequestAcceptedMessage = WsMessageBase<
  "FRIEND_REQUEST_ACCEPTED",
  { userId: string; username: string }
>;

export type FriendRequestDeclinedMessage = WsMessageBase<
  "FRIEND_REQUEST_DECLINED",
  { userId: string }
>;

export type PresenceStatus = 'online' | 'afk' | 'offline';

export interface PresenceChangedMessage extends WsMessageBase<
  'PRESENCE_CHANGED',
  { userId: string; status: PresenceStatus }
> {}

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
  | FriendRequestAcceptedMessage
  | FriendRequestDeclinedMessage
  | PresenceChangedMessage
  | UserBanNotifyMessage;

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

export interface AttachmentView {
  id: number;
  messageId: number;
  originalName: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
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
  attachments: AttachmentView[];
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
  status?: PresenceStatus;
}

export interface FriendRequestView {
  userId: string;
  username: string;
  note: string | null;
  createdAt: string;
}

export interface DmRow {
  id: number;
  user_a: string;
  user_b: string;
  created_at: Date;
}

export interface DmThreadView {
  dmId: number;
  userId: string;
  username: string;
  lastMessage: MessageView | null;
  lastActivityAt: string;
}

export interface RoomMemberView {
  userId: string;
  username: string;
  role: "owner" | "admin" | "member";
  status: PresenceStatus;
}
