"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PresenceDot } from "@/components/PresenceDot";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { RoomMemberView, RoomSummary } from "@/lib/types";

interface MembersPanelProps {
  roomId: number;
  room: RoomSummary;
  members: RoomMemberView[];
  currentUserId: string;
  onManage?: () => void;
  onInvite?: () => void;
}

export function MembersPanel({ roomId, room, members, currentUserId, onManage, onInvite }: MembersPanelProps) {
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

  const grouped = {
    owner: members.filter((m) => m.role === "owner"),
    admin: members.filter((m) => m.role === "admin"),
    member: members.filter((m) => m.role === "member"),
  };

  function MemberRow({ m }: { m: RoomMemberView }) {
    return (
      <div className="group flex items-center gap-2 rounded-lg px-2 py-1">
        <div className="relative shrink-0">
          <Avatar username={m.username} size={26} />
          <PresenceDot
            status={m.status}
            size={9}
            borderColor="var(--color-surface)"
            className="absolute -bottom-px -right-px"
          />
        </div>
        <span className={`flex-1 truncate text-xs font-medium ${m.status === 'offline' ? 'text-text-3' : 'text-text'}`}>
          {m.username}
        </span>
        {m.role === "owner" && (
          <span className="rounded bg-primary-light px-[5px] py-px text-[9px] font-bold tracking-wide text-primary">OWNER</span>
        )}
        {m.role === "admin" && (
          <span className="rounded bg-[#FCE4EC] px-[5px] py-px text-[9px] font-bold text-[#EC407A]">ADMIN</span>
        )}
        {canBan(m) && (
          <button
            onClick={() => { setError(null); setBanTarget(m); }}
            className="hidden rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[10px] font-medium text-unread group-hover:inline-flex"
          >
            Ban
          </button>
        )}
      </div>
    );
  }

  function Section({ label, items }: { label: string; items: RoomMemberView[] }) {
    if (items.length === 0) return null;
    return (
      <div className="mb-1.5">
        <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-text-3">{label}</div>
        {items.map((m) => <MemberRow key={m.userId} m={m} />)}
      </div>
    );
  }

  return (
    <aside className="flex w-[210px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="border-b border-border px-3.5 py-3">
        <div className="text-[13px] font-bold text-text">#{room.name}</div>
        {room.description && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-text-3">{room.description}</p>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[11px]">{room.visibility === "public" ? "🌐 Public" : "🔒 Private"}</span>
          <span className="text-[11px] text-text-3">{members.length} members</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
        <Section label="Owner" items={grouped.owner} />
        <Section label="Admins" items={grouped.admin} />
        <Section label={`Members (${grouped.member.length})`} items={grouped.member} />
      </div>

      <div className="flex gap-1.5 border-t border-border p-2.5">
        {onInvite && (
          <button
            onClick={onInvite}
            className="flex-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium text-text-2 transition-colors hover:border-primary hover:text-primary"
          >
            Invite
          </button>
        )}
        {onManage && (
          <button
            onClick={onManage}
            className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Manage
          </button>
        )}
      </div>

      <Dialog open={banTarget !== null} onOpenChange={(open) => { if (!open) setBanTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban @{banTarget?.username}?</DialogTitle>
            <DialogDescription>
              This will remove the user from the room and prevent them from rejoining.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-unread">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanTarget(null)} disabled={banning}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBan} disabled={banning}>
              {banning ? "Banning\u2026" : "Confirm Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
