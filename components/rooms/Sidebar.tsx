"use client";

import { useState, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { RoomItem } from "@/components/rooms/RoomItem";
import { CreateRoomModal } from "@/components/rooms/CreateRoomModal";
import { PublicRoomsModal } from "@/components/rooms/PublicRoomsModal";
import type { RoomSummary, WsMessage } from "@/lib/types";

interface SidebarProps {
  initialMine: RoomSummary[];
  currentUserId: string;
}

export function Sidebar({ initialMine, currentUserId }: SidebarProps) {
  const [mine, setMine] = useState<RoomSummary[]>(initialMine);
  const [selectedId, setSelectedId] = useState<number | null>(null);

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
          break;
        }
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

  function handleCreated(room: RoomSummary) {
    setMine((prev) => {
      if (prev.some((r) => r.id === room.id)) return prev;
      return [room, ...prev];
    });
  }

  function handleJoined(room: RoomSummary) {
    setMine((prev) => {
      if (prev.some((r) => r.id === room.id)) return prev;
      return [{ ...room, memberCount: room.memberCount + 1 }, ...prev];
    });
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col gap-3 border-r p-3">
      <div className="flex flex-col gap-2">
        <CreateRoomModal onCreated={handleCreated} />
        <PublicRoomsModal onJoined={handleJoined} />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {mine.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No rooms yet
          </p>
        )}
        {mine.map((room) => (
          <RoomItem
            key={room.id}
            room={room}
            selected={selectedId === room.id}
            onSelect={(r) => setSelectedId(r.id)}
          />
        ))}
      </nav>
    </aside>
  );
}
