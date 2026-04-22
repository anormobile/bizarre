"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PresenceDot } from "@/components/PresenceDot";
import { usePresence } from "@/hooks/usePresence";
import { useUnread } from "@/lib/unread";
import type { FriendView } from "@/lib/types";

interface ContactItemProps {
  friend: FriendView;
  selected: boolean;
  onSelect: (userId: string) => void;
  onRemove: (userId: string) => void;
}

export function ContactItem({ friend, selected, onSelect, onRemove }: ContactItemProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const status = usePresence(friend.userId);
  const unread = useUnread(`dm:${friend.userId}`);

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/friends/${friend.userId}`, { method: "DELETE" });
      if (res.ok) {
        onRemove(friend.userId);
      } else {
        const data = await res.json();
        setError(data.error ?? "failed");
        setTimeout(() => setError(""), 3000);
      }
    } catch {
      setError("network error");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(friend.userId)}
      className={`group flex w-full items-center gap-2 rounded-lg py-[5px] pl-7 pr-2.5 transition-colors ${
        selected ? 'bg-primary-light' : 'hover:bg-bg'
      }`}
    >
      <div className="relative shrink-0">
        <Avatar username={friend.username} size={22} />
        <PresenceDot
          status={status}
          size={8}
          borderColor="var(--color-surface)"
          className="absolute -bottom-px -right-px"
        />
      </div>
      <span className={`flex-1 truncate text-left text-[13px] ${
        selected
          ? 'font-semibold text-primary'
          : unread > 0
            ? 'font-semibold text-text'
            : status === 'offline'
              ? 'font-normal text-text-3'
              : 'font-normal text-text-2'
      }`}>
        {friend.username}
      </span>
      {unread > 0 && (
        <span className="min-w-[17px] rounded-[10px] bg-unread px-[5px] py-px text-center text-[10px] font-bold text-white">
          {unread}
        </span>
      )}
      {error && <span className="text-[11px] text-unread">{error}</span>}
      <span
        role="button"
        tabIndex={-1}
        onClick={handleRemove}
        className={`hidden text-[11px] text-text-3 group-hover:inline-block ${loading ? 'opacity-50' : 'hover:text-unread'}`}
      >
        ✕
      </span>
    </button>
  );
}
