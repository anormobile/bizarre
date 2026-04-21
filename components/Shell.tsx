"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Sidebar } from "@/components/rooms/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { DmChatArea } from "@/components/chat/DmChatArea";
import type { EventBus } from "@/components/chat/ChatArea";
import { setPresenceBulk } from "@/hooks/usePresence";
import { MembersPanel } from "@/components/MembersPanel";
import type { RoomSummary, WsMessage, FriendView, FriendRequestView, RoomMemberView, PresenceStatus } from "@/lib/types";

interface ShellProps {
  initialMine: RoomSummary[];
  currentUserId: string;
  currentUsername: string;
}

export function Shell({ initialMine, currentUserId, currentUsername }: ShellProps) {
  const [mine, setMine] = useState<RoomSummary[]>(initialMine);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedDmUserId, setSelectedDmUserId] = useState<string | null>(null);

  const [roomMembers, setRoomMembers] = useState<RoomMemberView[]>([]);

  const [friends, setFriends] = useState<FriendView[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestView[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestView[]>([]);

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

  const subscribersRef = useRef<Set<(msg: WsMessage) => void>>(new Set());

  const eventBus = useMemo<EventBus>(() => ({
    subscribe(cb: (msg: WsMessage) => void) {
      subscribersRef.current.add(cb);
      return () => { subscribersRef.current.delete(cb); };
    },
  }), []);

  const onMessage = useCallback(
    (msg: WsMessage) => {
      switch (msg.type) {
        case "ROOM_UPDATED": {
          const { roomId, name, description, visibility } = msg.payload;
          setMine((prev) => {
            const existing = prev.find((r) => r.id === roomId);
            if (existing) {
              return prev.map((r) =>
                r.id === roomId ? { ...r, name, description, visibility } : r,
              );
            }
            fetch(`/api/rooms/${roomId}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data?.room) {
                  setMine((p) => {
                    if (p.some((r) => r.id === roomId)) return p;
                    return [data.room as RoomSummary, ...p];
                  });
                }
              })
              .catch(() => {});
            return prev;
          });
          break;
        }
        case "MEMBER_JOINED": {
          const { roomId, userId, username, role } = msg.payload;
          if (userId === currentUserId) {
            setMine((prev) => {
              if (prev.some((r) => r.id === roomId)) return prev;
              fetch(`/api/rooms/${roomId}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                  if (data?.room) {
                    setMine((p) => {
                      if (p.some((r) => r.id === roomId)) return p;
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
                r.id === roomId ? { ...r, memberCount: r.memberCount + 1 } : r,
              ),
            );
          }
          setRoomMembers((prev) => {
            if (prev.length === 0) return prev;
            if (prev.some((m) => m.userId === userId)) return prev;
            return [...prev, { userId, username, role, status: "offline" as const }];
          });
          break;
        }
        case "MEMBER_LEFT": {
          const { roomId, userId } = msg.payload;
          if (userId === currentUserId) {
            setMine((prev) => prev.filter((r) => r.id !== roomId));
            setSelectedRoomId((sel) => (sel === roomId ? null : sel));
          } else {
            setMine((prev) =>
              prev.map((r) =>
                r.id === roomId
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
          setMine((prev) => prev.filter((r) => Number(r.id) !== Number(roomId)));
          setSelectedRoomId((sel) => (Number(sel) === Number(roomId) ? null : sel));
          break;
        }
        case "ROOM_DELETED": {
          const { roomId } = msg.payload;
          setMine((prev) => prev.filter((r) => r.id !== roomId));
          setSelectedRoomId((sel) => (sel === roomId ? null : sel));
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
  useWebSocket(`${proto}//${host}/ws`, onMessage);

  const handleSelectRoom = useCallback((roomId: number) => {
    setSelectedRoomId(roomId);
    setSelectedDmUserId(null);
  }, []);

  const handleSelectDm = useCallback((userId: string) => {
    setSelectedDmUserId(userId);
    setSelectedRoomId(null);
  }, []);

  const selectedRoom = mine.find((r) => r.id === selectedRoomId) ?? null;
  const selectedFriend = friends.find((f) => f.userId === selectedDmUserId) ?? null;
  const viewerRoomRole = roomMembers.find((m) => m.userId === currentUserId)?.role ?? null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar
        mine={mine}
        selectedRoomId={selectedRoomId}
        onSelect={handleSelectRoom}
        currentUserId={currentUserId}
        onMineChange={setMine}
        friends={friends}
        incoming={incoming}
        outgoing={outgoing}
        onFriendsChange={setFriends}
        onIncomingChange={setIncoming}
        onOutgoingChange={setOutgoing}
        selectedDmUserId={selectedDmUserId}
        onSelectDm={handleSelectDm}
      />
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
            members={roomMembers}
            currentUserId={currentUserId}
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
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">Select a room or contact to view messages.</p>
          </div>
        </main>
      )}
    </div>
  );
}
