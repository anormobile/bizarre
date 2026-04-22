"use client";

interface FriendRequestsBadgeProps {
  count: number;
}

export function FriendRequestsBadge({ count }: FriendRequestsBadgeProps) {
  if (count === 0) return null;
  return (
    <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-unread px-1 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}
