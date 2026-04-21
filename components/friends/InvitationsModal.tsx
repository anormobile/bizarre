"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
}

export function InvitationsModal({ onJoined }: InvitationsModalProps) {
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
        setOpen(val);
        if (val) fetchInvitations();
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" className="w-full" />}>
        Invitations{invitations.length > 0 ? ` (${invitations.length})` : ""}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Room Invitations</DialogTitle>
        </DialogHeader>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && invitations.length === 0 && (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        )}
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {invitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">#{inv.roomName}</p>
                <p className="text-xs text-muted-foreground">from @{inv.invitedByUsername}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => handleAccept(inv)}>Accept</Button>
                <Button size="sm" variant="outline" onClick={() => handleDecline(inv)}>Decline</Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
