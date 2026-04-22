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
      className={`flex w-full items-center gap-[7px] rounded-lg py-1.5 pl-7 pr-2.5 text-left transition-colors ${
        selected
          ? 'bg-primary-light'
          : 'hover:bg-bg'
      }`}
    >
      <span className={`text-[13px] font-semibold leading-none ${selected ? 'text-primary' : 'text-text-3'}`}>#</span>
      <span className={`flex-1 truncate text-[13px] ${
        selected ? 'font-semibold text-primary' : unread > 0 ? 'font-semibold text-text' : 'font-normal text-text-2'
      }`}>
        {room.name}
      </span>
      {unread > 0 && (
        <span className="min-w-[17px] rounded-[10px] bg-unread px-[5px] py-px text-center text-[10px] font-bold text-white">
          {unread}
        </span>
      )}
    </button>
  );
}
