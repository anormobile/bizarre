"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountModal({ open, onOpenChange }: DeleteAccountModalProps) {
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setPassword("");
    setConfirmed(false);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onOpenChange(false);
        window.location.assign("/login");
        return;
      }
      const data = await res.json().catch(() => ({ error: "request failed" }));
      const msg = data.error === "invalid password" ? "Incorrect password." : (data.error ?? "request failed");
      setError(msg);
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
        onOpenChange(val);
        if (!val) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-text-2">
          This action is permanent. All your rooms, messages, and data will be removed.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="mb-[5px] block text-xs font-semibold text-text-2">Current password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-[9px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(92,107,192,0.12)]"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-[15px] w-[15px] rounded border-border accent-primary"
            />
            <span className="text-sm text-text-2">I understand this is permanent</span>
          </label>
          {error && <p className="text-xs text-unread">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password || !confirmed}
            className="w-full rounded-[10px] bg-unread py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Deleting\u2026" : "Delete my account"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
