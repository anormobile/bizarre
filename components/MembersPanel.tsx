"use client";

import { useState } from "react";
import { PresenceDot } from "@/components/PresenceDot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RoomMemberView } from "@/lib/types";

interface MembersPanelProps {
  roomId: number;
  members: RoomMemberView[];
  currentUserId: string;
}

export function MembersPanel({ roomId, members, currentUserId }: MembersPanelProps) {
  const [banTarget, setBanTarget] = useState<RoomMemberView | null>(null);
  const [banning, setBanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewerRole = members.find((m) => m.userId === currentUserId)?.role ?? null;

  function canBan(member: RoomMemberView): boolean {
    if (member.userId === currentUserId) return false;
    if (viewerRole === "owner") return true;
    if (viewerRole === "admin" && member.role === "member") return true;
    return false;
  }

  async function handleBan() {
    if (!banTarget) return;
    setBanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/members/${banTarget.userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "failed" }));
        setError(body.error ?? "failed");
        setBanning(false);
        return;
      }
      setBanTarget(null);
    } catch {
      setError("network error");
    } finally {
      setBanning(false);
    }
  }

  const roleBadge = (role: string) => {
    if (role === "owner") return <span className="rounded bg-amber-500/20 px-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">owner</span>;
    if (role === "admin") return <span className="rounded bg-blue-500/20 px-1 text-[10px] font-medium text-blue-700 dark:text-blue-400">admin</span>;
    return null;
  };

  return (
    <aside className="flex w-56 shrink-0 flex-col border-l">
      <div className="border-b px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">
          Members — {members.length}
        </span>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {members.map((m) => (
          <li
            key={m.userId}
            className="group flex items-center gap-2 px-3 py-1.5 text-sm"
          >
            <PresenceDot status={m.status} />
            <span className="truncate">@{m.username}</span>
            {roleBadge(m.role)}
            {canBan(m) && (
              <Button
                size="xs"
                variant="destructive"
                className="ml-auto hidden group-hover:inline-flex"
                onClick={() => { setError(null); setBanTarget(m); }}
              >
                Ban
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={banTarget !== null} onOpenChange={(open) => { if (!open) setBanTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban @{banTarget?.username}?</DialogTitle>
            <DialogDescription>
              This will remove the user from the room and prevent them from rejoining.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)} disabled={banning}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBan} disabled={banning}>
              {banning ? "Banning…" : "Confirm Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
