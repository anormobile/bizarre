"use client";

import type { RoomSummary } from "@/lib/types";

interface RoomItemProps {
  room: RoomSummary;
  selected: boolean;
  onSelect: (room: RoomSummary) => void;
}

export function RoomItem({ room, selected, onSelect }: RoomItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(room)}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        selected
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-muted"
      }`}
    >
      <span className="truncate font-medium">#{room.name}</span>
      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
        {room.memberCount}
      </span>
    </button>
  );
}
