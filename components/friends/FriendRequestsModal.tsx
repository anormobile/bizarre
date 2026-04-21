"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-text-2 transition-colors hover:border-primary hover:text-primary"
      >
        Requests
        <FriendRequestsBadge count={incoming.length} />
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Friend requests</DialogTitle>
        </DialogHeader>
        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            className={`flex-1 py-2.5 text-[13px] font-medium transition-colors ${tab === 'incoming' ? 'bg-primary-light text-primary' : 'text-text-2 hover:bg-bg'}`}
            onClick={() => setTab("incoming")}
          >
            Incoming ({incoming.length})
          </button>
          <button
            className={`flex-1 border-l border-border py-2.5 text-[13px] font-medium transition-colors ${tab === 'outgoing' ? 'bg-primary-light text-primary' : 'text-text-2 hover:bg-bg'}`}
            onClick={() => setTab("outgoing")}
          >
            Outgoing ({outgoing.length})
          </button>
        </div>
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {tab === "incoming" && (
            incoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-3">No requests</p>
            ) : (
              incoming.map((r) => (
                <IncomingRow key={r.userId} req={r} onAccepted={onAccepted} onDeclined={onDeclined} />
              ))
            )
          )}
          {tab === "outgoing" && (
            outgoing.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-3">No requests</p>
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">@{req.username}</p>
        {req.note && <p className="truncate text-xs text-text-3">{req.note}</p>}
        {error && <p className="text-[11px] text-unread">{error}</p>}
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={handleAccept}
          disabled={loading !== null}
          className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading === "accept" ? "\u2026" : "Accept"}
        </button>
        <button
          onClick={handleDecline}
          disabled={loading !== null}
          className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-text-2 disabled:opacity-50"
        >
          {loading === "decline" ? "\u2026" : "Decline"}
        </button>
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">@{req.username}</p>
        {req.note && <p className="truncate text-xs text-text-3">{req.note}</p>}
        {error && <p className="text-[11px] text-unread">{error}</p>}
      </div>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="rounded-lg border border-border px-3 py-1 text-xs font-medium text-text-2 disabled:opacity-50"
      >
        {loading ? "\u2026" : "Cancel"}
      </button>
    </div>
  );
}
