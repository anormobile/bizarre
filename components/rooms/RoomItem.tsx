"use client";

import { useUnread } from "@/lib/unread";
import type { RoomSummary } from "@/lib/types";

interface RoomItemProps {
  room: RoomSummary;
  selected: boolean;
  onSelect: (room: RoomSummary) => void;
}

export function RoomItem({ room, selected, onSelect }: RoomItemProps) {
  const unread = useUnread(`room:${room.id}`);

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
      <span className={`truncate font-medium ${unread > 0 ? "font-bold" : ""}`}>#{room.name}</span>
      <span className="ml-2 flex shrink-0 items-center gap-1.5">
        {unread > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
            {unread}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{room.memberCount}</span>
      </span>
    </button>
  );
}
