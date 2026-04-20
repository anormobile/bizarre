"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <DialogTrigger render={<Button variant="outline" size="sm" className="flex-1 text-xs" />}>
        Add contact
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a contact</DialogTitle>
        </DialogHeader>
        {success ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Request sent!</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="friend-username" className="text-xs font-medium text-muted-foreground">
                Username
              </label>
              <Input
                id="friend-username"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={48}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="friend-note" className="text-xs font-medium text-muted-foreground">
                Note (optional)
              </label>
              <textarea
                id="friend-note"
                placeholder="Hey, let's connect!"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                rows={2}
                className="rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Sending\u2026" : "Send request"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
