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
import { FriendRequestsBadge } from "@/components/friends/FriendRequestsBadge";
import type { FriendRequestView, FriendView } from "@/lib/types";

interface FriendRequestsModalProps {
  incoming: FriendRequestView[];
  outgoing: FriendRequestView[];
  onAccepted: (friend: FriendView) => void;
  onDeclined: (userId: string) => void;
  onCancelledOutgoing: (userId: string) => void;
}

export function FriendRequestsModal({
  incoming,
  outgoing,
  onAccepted,
  onDeclined,
  onCancelledOutgoing,
}: FriendRequestsModalProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" />}>
        Requests
        <FriendRequestsBadge count={incoming.length} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Friend requests</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 rounded-md bg-muted p-0.5">
          <button
            className={`flex-1 rounded-sm px-3 py-1 text-xs font-medium transition-colors ${tab === "incoming" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("incoming")}
          >
            Incoming ({incoming.length})
          </button>
          <button
            className={`flex-1 rounded-sm px-3 py-1 text-xs font-medium transition-colors ${tab === "outgoing" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab("outgoing")}
          >
            Outgoing ({outgoing.length})
          </button>
        </div>
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {tab === "incoming" && (
            incoming.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No requests</p>
            ) : (
              incoming.map((r) => (
                <IncomingRow key={r.userId} req={r} onAccepted={onAccepted} onDeclined={onDeclined} />
              ))
            )
          )}
          {tab === "outgoing" && (
            outgoing.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No requests</p>
            ) : (
              outgoing.map((r) => (
                <OutgoingRow key={r.userId} req={r} onCancelled={onCancelledOutgoing} />
              ))
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IncomingRow({
  req,
  onAccepted,
  onDeclined,
}: {
  req: FriendRequestView;
  onAccepted: (friend: FriendView) => void;
  onDeclined: (userId: string) => void;
}) {
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState("");

  async function handleAccept() {
    setLoading("accept");
    setError("");
    try {
      const res = await fetch(`/api/friends/requests/${req.userId}/accept`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        onAccepted(data.friend);
      } else {
        setError(data.error ?? "failed");
      }
    } catch {
      setError("network error");
    } finally {
      setLoading(null);
    }
  }

  async function handleDecline() {
    setLoading("decline");
    setError("");
    try {
      const res = await fetch(`/api/friends/requests/${req.userId}/decline`, { method: "POST" });
      if (res.ok) {
        onDeclined(req.userId);
      } else {
        const data = await res.json();
        setError(data.error ?? "failed");
      }
    } catch {
      setError("network error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">@{req.username}</p>
        {req.note && <p className="truncate text-xs text-muted-foreground">{req.note}</p>}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
      <div className="flex gap-1">
        <Button size="sm" className="h-7 px-2 text-xs" onClick={handleAccept} disabled={loading !== null}>
          {loading === "accept" ? "\u2026" : "Accept"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={handleDecline}
          disabled={loading !== null}
        >
          {loading === "decline" ? "\u2026" : "Decline"}
        </Button>
      </div>
    </div>
  );
}

function OutgoingRow({
  req,
  onCancelled,
}: {
  req: FriendRequestView;
  onCancelled: (userId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/friends/requests/${req.userId}/decline`, { method: "POST" });
      if (res.ok) {
        onCancelled(req.userId);
      } else {
        const data = await res.json();
        setError(data.error ?? "failed");
      }
    } catch {
      setError("network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">@{req.username}</p>
        {req.note && <p className="truncate text-xs text-muted-foreground">{req.note}</p>}
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={handleCancel}
        disabled={loading}
      >
        {loading ? "\u2026" : "Cancel"}
      </Button>
    </div>
  );
}
