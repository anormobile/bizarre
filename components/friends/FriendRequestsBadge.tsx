"use client";

interface FriendRequestsBadgeProps {
  count: number;
}

export function FriendRequestsBadge({ count }: FriendRequestsBadgeProps) {
  if (count === 0) return null;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
      {count}
    </span>
  );
}
