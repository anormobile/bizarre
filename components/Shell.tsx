"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Sidebar } from "@/components/rooms/Sidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import type { EventBus } from "@/components/chat/ChatArea";
import type { RoomSummary, WsMessage } from "@/lib/types";

interface ShellProps {
  initialMine: RoomSummary[];
  currentUserId: string;
  currentUsername: string;
}

export function Shell({ initialMine, currentUserId, currentUsername }: ShellProps) {
  const [mine, setMine] = useState<RoomSummary[]>(initialMine);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

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
          const { roomId, userId } = msg.payload;
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
          break;
        }
        case "ROOM_DELETED": {
          const { roomId } = msg.payload;
          setMine((prev) => prev.filter((r) => r.id !== roomId));
          setSelectedRoomId((sel) => (sel === roomId ? null : sel));
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

  const selectedRoom = mine.find((r) => r.id === selectedRoomId) ?? null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar
        mine={mine}
        selectedRoomId={selectedRoomId}
        onSelect={setSelectedRoomId}
        currentUserId={currentUserId}
        onMineChange={setMine}
      />
      {selectedRoom ? (
        <ChatArea
          room={selectedRoom}
          currentUserId={currentUserId}
          currentUsername={currentUsername}
          eventBus={eventBus}
        />
      ) : (
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">Select a room to view messages.</p>
          </div>
        </main>
      )}
    </div>
  );
}
