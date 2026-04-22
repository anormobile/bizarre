"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useIdleTracker } from "@/hooks/useIdleTracker";
import { TopNav, type NavView } from "@/components/TopNav";
import { Sidebar } from "@/components/rooms/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { DmChatArea } from "@/components/chat/DmChatArea";
import type { EventBus } from "@/components/chat/ChatArea";
import { setPresenceBulk } from "@/hooks/usePresence";
import { increment, clear } from "@/lib/unread";
import { MembersPanel } from "@/components/MembersPanel";
import { ManageRoomModal } from "@/components/rooms/ManageRoomModal";
import { ContactsView } from "@/components/views/ContactsView";
import { SessionsView } from "@/components/views/SessionsView";
import { PublicRoomsModal } from "@/components/rooms/PublicRoomsModal";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { DeleteAccountModal } from "@/components/auth/DeleteAccountModal";
import type { RoomSummary, WsMessage, FriendView, FriendRequestView, RoomMemberView, PresenceStatus } from "@/lib/types";

interface ShellProps {
  initialMine: RoomSummary[];
  currentUserId: string;
  currentUsername: string;
  afkIdleMs?: number;
}

export function Shell({ initialMine, currentUserId, currentUsername, afkIdleMs }: ShellProps) {
  const [mine, setMine] = useState<RoomSummary[]>(initialMine);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedDmUserId, setSelectedDmUserId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NavView>('chat');
  const [publicRoomsOpen, setPublicRoomsOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [manageRoomOpen, setManageRoomOpen] = useState(false);

  const [roomMembers, setRoomMembers] = useState<RoomMemberView[]>([]);

  const [friends, setFriends] = useState<FriendView[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestView[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestView[]>([]);
  const [inviteCount, setInviteCount] = useState(0);

  useEffect(() => {
    fetch("/api/friends")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.friends) {
          setFriends(data.friends);
          const entries: Record<string, PresenceStatus> = {};
          for (const f of data.friends as FriendView[]) {
            if (f.status) entries[f.userId] = f.status;
          }
          setPresenceBulk(entries);
        }
      })
      .catch(() => {});
    fetch("/api/friends/requests")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          if (data.incoming) setIncoming(data.incoming);
          if (data.outgoing) setOutgoing(data.outgoing);
        }
      })
      .catch(() => {});
    fetch("/api/invitations")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.invitations) setInviteCount(data.invitations.length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedRoomId === null) {
      setRoomMembers([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/rooms/${selectedRoomId}/members`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.members) return;
        setRoomMembers(data.members);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedRoomId]);

  const selectedRoomIdRef = useRef(selectedRoomId);
  selectedRoomIdRef.current = selectedRoomId;
  const selectedDmUserIdRef = useRef(selectedDmUserId);
  selectedDmUserIdRef.current = selectedDmUserId;

  const subscribersRef = useRef<Set<(msg: WsMessage) => void>>(new Set());

  const eventBus = useMemo<EventBus>(() => ({
    subscribe(cb: (msg: WsMessage) => void) {
      subscribersRef.current.add(cb);
      return () => { subscribersRef.current.delete(cb); };
    },
  }), []);

  const onMessage = useCallback(
    (msg: WsMessage) => {
      const rid = (a: number | string | null | undefined, b: number | string | null | undefined) =>
        a != null && b != null && Number(a) === Number(b);

      switch (msg.type) {
        case "ROOM_UPDATED": {
          const { roomId, name, description, visibility } = msg.payload;
          setMine((prev) => {
            const existing = prev.find((r) => rid(r.id, roomId));
            if (existing) {
              return prev.map((r) =>
                rid(r.id, roomId) ? { ...r, name, description, visibility } : r,
              );
            }
            return prev;
          });
          break;
        }
        case "MEMBER_JOINED": {
          const { roomId, userId, username, role } = msg.payload;
          if (userId === currentUserId) {
            setMine((prev) => {
              if (prev.some((r) => rid(r.id, roomId))) return prev;
              fetch(`/api/rooms/${roomId}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                  if (data?.room) {
                    setMine((p) => {
                      if (p.some((r) => rid(r.id, data.room.id))) return p;
                      return [data.room as RoomSummary, ...p];
                    });
                  }
                })
                .catch(() => {});
              return prev;
            });
          } else {
            setMine((prev) =>
              prev.map((r) =>
                rid(r.id, roomId) ? { ...r, memberCount: r.memberCount + 1 } : r,
              ),
            );
          }
          setRoomMembers((prev) => {
            if (prev.length === 0) return prev;
            const filtered = prev.filter((m) => !(m.userId === userId && m.role === "pending"));
            if (filtered.some((m) => m.userId === userId)) return filtered;
            return [...filtered, { userId, username, role, status: "offline" as const }];
          });
          break;
        }
        case "MEMBER_LEFT": {
          const { roomId, userId } = msg.payload;
          if (userId === currentUserId) {
            setMine((prev) => prev.filter((r) => !rid(r.id, roomId)));
            setSelectedRoomId((sel) => (rid(sel, roomId) ? null : sel));
          } else {
            setMine((prev) =>
              prev.map((r) =>
                rid(r.id, roomId)
                  ? { ...r, memberCount: Math.max(0, r.memberCount - 1) }
                  : r,
              ),
            );
          }
          setRoomMembers((prev) => prev.filter((m) => m.userId !== userId));
          break;
        }
        case "USER_BAN_NOTIFY": {
          const { roomId } = msg.payload;
          setMine((prev) => prev.filter((r) => !rid(r.id, roomId)));
          setSelectedRoomId((sel) => (rid(sel, roomId) ? null : sel));
          break;
        }
        case "ROOM_DELETED": {
          const { roomId } = msg.payload;
          setMine((prev) => prev.filter((r) => !rid(r.id, roomId)));
          setSelectedRoomId((sel) => (rid(sel, roomId) ? null : sel));
          break;
        }
        case "FRIEND_REQUEST_RECEIVED": {
          const { fromUserId, fromUsername, note } = msg.payload;
          setIncoming((prev) => {
            if (prev.some((r) => r.userId === fromUserId)) return prev;
            return [{ userId: fromUserId, username: fromUsername, note, createdAt: new Date().toISOString() }, ...prev];
          });
          break;
        }
        case "FRIEND_REQUEST_ACCEPTED": {
          const { userId, username } = msg.payload;
          setOutgoing((prev) => prev.filter((r) => r.userId !== userId));
          setFriends((prev) => {
            if (prev.some((f) => f.userId === userId)) return prev;
            return [...prev, { userId, username, since: new Date().toISOString() }].sort((a, b) =>
              a.username.localeCompare(b.username),
            );
          });
          break;
        }
        case "FRIEND_REQUEST_DECLINED": {
          const { userId } = msg.payload;
          setOutgoing((prev) => prev.filter((r) => r.userId !== userId));
          break;
        }
        case "ROOM_INVITATION_RECEIVED": {
          setInviteCount((prev) => prev + 1);
          break;
        }
        case "ROOM_MEMBER_ROLE_CHANGED": {
          const { roomId, userId, role } = msg.payload;
          setRoomMembers(prev => prev.map(m =>
            m.userId === userId ? { ...m, role } : m
          ));
          if (rid(selectedRoomIdRef.current, roomId)) {
            fetch(`/api/rooms/${roomId}/members`)
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => { if (data?.members) setRoomMembers(data.members); })
              .catch(() => {});
          }
          break;
        }
      }

      if (msg.type === "MESSAGE_NEW") {
        const m = msg.payload.message;
        if (m.userId !== currentUserId) {
          if ("roomId" in msg.payload && msg.payload.roomId != null) {
            if (!rid(selectedRoomIdRef.current, msg.payload.roomId)) {
              increment(`room:${msg.payload.roomId}`);
            }
          } else if ("dmId" in msg.payload && msg.payload.dmId != null) {
            if (selectedDmUserIdRef.current !== m.userId) {
              increment(`dm:${m.userId}`);
            }
          }
        }
      }

      for (const cb of subscribersRef.current) {
        try { cb(msg); } catch { /* ignore subscriber errors */ }
      }
    },
    [currentUserId],
  );

  const proto =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "wss:"
      : "ws:";
  const host =
    typeof window !== "undefined" ? window.location.host : "localhost:3000";
  const { send: wsSend } = useWebSocket(`${proto}//${host}/ws`, onMessage);

  useIdleTracker(wsSend, afkIdleMs);

  const handleSelectRoom = useCallback((roomId: number) => {
    setSelectedRoomId(roomId);
    setSelectedDmUserId(null);
    clear(`room:${roomId}`);
  }, []);

  const handleSelectDm = useCallback((userId: string) => {
    setSelectedDmUserId(userId);
    setSelectedRoomId(null);
    clear(`dm:${userId}`);
  }, []);

  const selectedRoom = mine.find((r) => selectedRoomId != null && Number(r.id) === Number(selectedRoomId)) ?? null;
  const selectedFriend = friends.find((f) => f.userId === selectedDmUserId) ?? null;
  const viewerRoomRole = (() => {
    const role = roomMembers.find((m) => m.userId === currentUserId)?.role ?? null;
    if (role === "pending") return null;
    return role;
  })();

  type FriendStatus = 'self' | 'friends' | 'request_sent' | 'request_received' | 'blocked' | 'strangers';
  const friendStatusByUserId = useMemo(() => {
    const map = new Map<string, FriendStatus>();
    map.set(currentUserId, 'self');
    for (const f of friends) map.set(f.userId, 'friends');
    for (const r of outgoing) map.set(r.userId, 'request_sent');
    for (const r of incoming) map.set(r.userId, 'request_received');
    return map;
  }, [currentUserId, friends, outgoing, incoming]);

  const refetchFriendData = useCallback(() => {
    fetch("/api/friends")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.friends) setFriends(data.friends); })
      .catch(() => {});
    fetch("/api/friends/requests")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          if (data.incoming) setIncoming(data.incoming);
          if (data.outgoing) setOutgoing(data.outgoing);
        }
      })
      .catch(() => {});
  }, []);

  function handleViewChange(view: NavView) {
    if (view === 'public') {
      setPublicRoomsOpen(true);
      return;
    }
    setActiveView(view);
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function handleJoined(room: RoomSummary) {
    setMine((prev) =>
      prev.some((r) => Number(r.id) === Number(room.id))
        ? prev
        : [{ ...room, memberCount: room.memberCount + 1 }, ...prev],
    );
  }

  async function handleLeaveRoom(roomId: number) {
    const res = await fetch(`/api/rooms/${roomId}/leave`, { method: "POST" });
    if (res.ok) {
      setMine((prev) => prev.filter((r) => Number(r.id) !== Number(roomId)));
      setSelectedRoomId((sel) => (sel != null && Number(sel) === Number(roomId) ? null : sel));
    }
  }

  function handleContactMessage(userId: string) {
    setSelectedDmUserId(userId);
    setSelectedRoomId(null);
    setActiveView('chat');
    clear(`dm:${userId}`);
  }

  return (
    <div className="flex h-screen flex-col bg-bg">
      <TopNav
        activeView={activeView}
        onViewChange={handleViewChange}
        username={currentUsername}
        onSignOut={handleSignOut}
        onChangePassword={() => setChangePasswordOpen(true)}
        onDeleteAccount={() => setDeleteAccountOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        {activeView === 'chat' && (
          <>
            {selectedRoom ? (
              <>
                <ChatArea
                  room={selectedRoom}
                  currentUserId={currentUserId}
                  currentUsername={currentUsername}
                  eventBus={eventBus}
                  viewerRoomRole={viewerRoomRole}
                />
                <MembersPanel
                  roomId={selectedRoom.id}
                  room={selectedRoom}
                  members={roomMembers}
                  currentUserId={currentUserId}
                  onManage={() => setManageRoomOpen(true)}
                  onInvite={() => { setManageRoomOpen(true); }}
                  onLeave={() => handleLeaveRoom(selectedRoom.id)}
                  friendStatusByUserId={friendStatusByUserId}
                  onFriendStatusChange={refetchFriendData}
                />
              </>
            ) : selectedFriend ? (
              <DmChatArea
                friendUserId={selectedFriend.userId}
                friendUsername={selectedFriend.username}
                currentUserId={currentUserId}
                eventBus={eventBus}
              />
            ) : (
              <main className="flex flex-1 flex-col items-center justify-center gap-3.5 text-text-3">
                <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-border">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="text-center">
                  <p className="mb-1 text-[15px] font-semibold text-text-2">No conversation selected</p>
                  <p className="text-[13px]">Pick a room or contact from the sidebar</p>
                </div>
              </main>
            )}
            <Sidebar
              mine={mine}
              selectedRoomId={selectedRoomId}
              onSelect={handleSelectRoom}
              onMineChange={setMine}
              friends={friends}
              onFriendsChange={setFriends}
              selectedDmUserId={selectedDmUserId}
              onSelectDm={handleSelectDm}
              inviteCount={inviteCount}
              onInviteCountReset={() => setInviteCount(0)}
              onJoinedRoom={handleJoined}
            />
          </>
        )}

        {activeView === 'contacts' && (
          <ContactsView
            friends={friends}
            onSelectContact={handleContactMessage}
            onFriendsChange={setFriends}
            onIncomingChange={setIncoming}
            onOutgoingChange={setOutgoing}
            incoming={incoming}
            outgoing={outgoing}
          />
        )}

        {activeView === 'sessions' && (
          <SessionsView />
        )}
      </div>

      <PublicRoomsModal
        open={publicRoomsOpen}
        onOpenChange={setPublicRoomsOpen}
        onJoined={handleJoined}
      />
      <ChangePasswordModal
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
      <DeleteAccountModal
        open={deleteAccountOpen}
        onOpenChange={setDeleteAccountOpen}
      />
      {selectedRoom && (
        <ManageRoomModal
          open={manageRoomOpen}
          onOpenChange={setManageRoomOpen}
          room={selectedRoom}
          members={roomMembers}
          currentUserId={currentUserId}
          onRoomUpdated={(partial) => {
            setMine((prev) =>
              prev.map((r) => (Number(r.id) === Number(selectedRoom.id) ? { ...r, ...partial } : r)),
            );
          }}
          onRoomDeleted={() => {
            setMine((prev) => prev.filter((r) => Number(r.id) !== Number(selectedRoom.id)));
            setSelectedRoomId(null);
          }}
          onMembersRefresh={() => {
            fetch(`/api/rooms/${selectedRoom.id}/members`)
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => { if (data?.members) setRoomMembers(data.members); })
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
