"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FriendRequestView, FriendView } from "@/lib/types";

interface AddContactModalProps {
  onSent: (view: FriendRequestView) => void;
  onAutoAccepted: (friend: FriendView) => void;
}

export function AddContactModal({ onSent, onAutoAccepted }: AddContactModalProps) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function reset() {
    setUsername("");
    setNote("");
    setError("");
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, note: note || undefined }),
      });
      const data = await res.json();

      if (res.status === 201) {
        setSuccess(true);
        onSent(data.request);
        setTimeout(() => {
          setOpen(false);
        }, 1000);
      } else if (res.status === 200) {
        onAutoAccepted(data.friend);
        setOpen(false);
      } else {
        setError(data.error ?? "something went wrong");
      }
    } catch {
      setError("network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) reset();
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-primary-hover"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
        + Add contact
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>
        {success ? (
          <p className="py-4 text-center text-sm font-semibold text-online">✓ Request sent!</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div>
              <label className="mb-[5px] block text-xs font-semibold text-text-2">Search by username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username…"
                autoFocus
                required
                maxLength={48}
                className="w-full rounded-[9px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-[5px] block text-xs font-semibold text-text-2">Optional note</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Hey! Let's connect."
                rows={2}
                maxLength={200}
                className="w-full resize-none rounded-[9px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
              />
            </div>
            {error && <p className="text-xs text-unread">{error}</p>}
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full rounded-[10px] bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Sending\u2026" : "Send request"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
