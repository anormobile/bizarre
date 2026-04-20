"use client";

import { RoomItem } from "@/components/rooms/RoomItem";
import { CreateRoomModal } from "@/components/rooms/CreateRoomModal";
import { PublicRoomsModal } from "@/components/rooms/PublicRoomsModal";
import type { RoomSummary } from "@/lib/types";

interface SidebarProps {
  mine: RoomSummary[];
  selectedRoomId: number | null;
  onSelect: (roomId: number) => void;
  currentUserId: string;
  onMineChange: (next: RoomSummary[]) => void;
}

export function Sidebar({ mine, selectedRoomId, onSelect, onMineChange }: SidebarProps) {
  function handleCreated(room: RoomSummary) {
    onMineChange(
      mine.some((r) => r.id === room.id) ? mine : [room, ...mine],
    );
  }

  function handleJoined(room: RoomSummary) {
    onMineChange(
      mine.some((r) => r.id === room.id)
        ? mine
        : [{ ...room, memberCount: room.memberCount + 1 }, ...mine],
    );
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
            selected={selectedRoomId === room.id}
            onSelect={(r) => onSelect(r.id)}
          />
        ))}
      </nav>
    </aside>
  );
}
