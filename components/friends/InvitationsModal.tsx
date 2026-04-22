"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RoomSummary } from "@/lib/types";

interface Invitation {
  id: number;
  roomId: number;
  roomName: string;
  invitedByUsername: string;
  createdAt: string;
}

interface InvitationsModalProps {
  onJoined?: (room: RoomSummary) => void;
  inviteCount?: number;
  onCountReset?: () => void;
}

export function InvitationsModal({ onJoined, inviteCount = 0, onCountReset }: InvitationsModalProps) {
  const [open, setOpen] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchInvitations() {
    setLoading(true);
    try {
      const res = await fetch("/api/invitations");
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.invitations);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  function handleOpen() {
    setOpen(true);
    fetchInvitations();
    onCountReset?.();
  }

  async function handleAccept(inv: Invitation) {
    const res = await fetch(`/api/invitations/${inv.id}/accept`, { method: "POST" });
    if (res.ok) {
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      const data = await res.json();
      if (data.room && onJoined) {
        onJoined({
          id: data.room.id,
          name: data.room.name,
          description: data.room.description,
          visibility: data.room.visibility,
          ownerId: "",
          memberCount: 1,
        });
      }
    }
  }

  async function handleDecline(inv: Invitation) {
    const res = await fetch(`/api/invitations/${inv.id}/decline`, { method: "POST" });
    if (res.ok) {
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (val) handleOpen();
        else setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center justify-between rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-2 transition-colors hover:border-primary hover:text-primary"
      >
        <span>Invitations</span>
        {inviteCount > 0 && (
          <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-unread px-1 text-[10px] font-bold text-white">
            {inviteCount}
          </span>
        )}
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Room Invitations</DialogTitle>
        </DialogHeader>
        {loading && <p className="text-sm text-text-3">Loading…</p>}
        {!loading && invitations.length === 0 && (
          <p className="py-4 text-center text-sm text-text-3">No pending invitations.</p>
        )}
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {invitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">#{inv.roomName}</p>
                <p className="text-xs text-text-3">from @{inv.invitedByUsername}</p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleAccept(inv)}
                  className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(inv)}
                  className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-text-2"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
