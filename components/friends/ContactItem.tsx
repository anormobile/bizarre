"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FriendView } from "@/lib/types";

interface ContactItemProps {
  friend: FriendView;
  onRemove: (userId: string) => void;
}

export function ContactItem({ friend, onRemove }: ContactItemProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRemove() {
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
    <div className="group flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
      <span className="truncate font-medium">@{friend.username}</span>
      <div className="flex items-center gap-1">
        {error && <span className="text-[11px] text-destructive">{error}</span>}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100"
          onClick={handleRemove}
          disabled={loading}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
