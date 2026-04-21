"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FriendRequestView, FriendView, UserSummary } from "@/lib/types";

interface AddContactModalProps {
  onSent: (view: FriendRequestView) => void;
  onAutoAccepted: (friend: FriendView) => void;
}

export function AddContactModal({ onSent, onAutoAccepted }: AddContactModalProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingFor, setSendingFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function reset() {
    setQuery("");
    setResults([]);
    setError("");
    setSendingFor(null);
  }

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.users ?? []);
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  async function handleSend(user: UserSummary) {
    setSendingFor(user.userId);
    setError("");
    try {
      const res = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username }),
      });
      const data = await res.json();

      if (res.status === 201) {
        onSent(data.request);
        setResults((prev) =>
          prev.map((u) =>
            u.userId === user.userId ? { ...u, friendship: "pending_outgoing" } : u,
          ),
        );
      } else if (res.status === 200) {
        onAutoAccepted(data.friend);
        setResults((prev) =>
          prev.map((u) =>
            u.userId === user.userId ? { ...u, friendship: "confirmed" } : u,
          ),
        );
      } else {
        setError(data.error ?? "something went wrong");
      }
    } catch {
      setError("network error");
    } finally {
      setSendingFor(null);
    }
  }

  function statusLabel(f: UserSummary["friendship"]) {
    switch (f) {
      case "confirmed": return "Friends";
      case "pending_outgoing": return "Pending";
      case "pending_incoming": return "Accept?";
      default: return null;
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
        className="flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-hover"
      >
        + Add contact
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
        </DialogHeader>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username…"
          autoFocus
          maxLength={48}
          className="w-full rounded-[9px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
        />

        {error && <p className="text-xs text-unread">{error}</p>}

        {searching && <p className="py-2 text-center text-xs text-text-3">Searching…</p>}

        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="py-4 text-center text-sm text-text-3">No users found</p>
        )}

        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {results.map((user) => {
            const label = statusLabel(user.friendship);
            return (
              <div
                key={user.userId}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2.5"
              >
                <span className="truncate text-sm font-semibold text-text">
                  {user.username}
                </span>
                {user.friendship === "none" ? (
                  <button
                    onClick={() => handleSend(user)}
                    disabled={sendingFor === user.userId}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                  >
                    {sendingFor === user.userId ? "Sending\u2026" : "Send request"}
                  </button>
                ) : (
                  <span className="shrink-0 rounded-lg bg-bg px-3 py-1 text-xs font-medium text-text-3">
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
