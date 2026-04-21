"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RoomSummary } from "@/lib/types";

interface CreateRoomModalProps {
  onCreated: (room: RoomSummary) => void;
}

export function CreateRoomModal({ onCreated }: CreateRoomModalProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setVisibility("public");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          visibility,
        }),
      });
      const data = await res.json();

      if (res.status === 201) {
        onCreated(data.room);
        reset();
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
        className="flex w-full items-center justify-center gap-1.5 rounded-[9px] border-[1.5px] border-dashed border-border px-2.5 py-[7px] text-xs text-text-2 transition-colors hover:border-primary hover:text-primary"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
        Create room
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="mb-[5px] block text-xs font-semibold text-text-2">Room name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. my-room"
              autoFocus
              required
              minLength={3}
              maxLength={48}
              pattern="^[a-zA-Z0-9_-]+$"
              className="w-full rounded-[9px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-[5px] block text-xs font-semibold text-text-2">
              Description <span className="font-normal text-text-3">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this room about?"
              rows={2}
              maxLength={256}
              className="w-full resize-none rounded-[9px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-text-2">Visibility</label>
            <div className="flex gap-2.5">
              {([
                { v: 'public' as const, icon: '🌐', desc: 'Anyone can join' },
                { v: 'private' as const, icon: '🔒', desc: 'Invite only' },
              ]).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setVisibility(opt.v)}
                  className={`flex-1 rounded-[10px] border-[1.5px] px-3 py-2.5 text-left transition-all ${
                    visibility === opt.v
                      ? 'border-primary bg-primary-light'
                      : 'border-border hover:border-text-3'
                  }`}
                >
                  <div className={`text-[13px] font-semibold ${visibility === opt.v ? 'text-primary' : 'text-text'}`}>
                    {opt.icon} {opt.v.charAt(0).toUpperCase() + opt.v.slice(1)}
                  </div>
                  <div className="mt-px text-xs text-text-3">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-unread">{error}</p>}
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className={`w-full rounded-[10px] py-2.5 text-sm font-semibold transition-colors ${
              name.trim()
                ? 'bg-primary text-white hover:bg-primary-hover'
                : 'bg-border text-text-3'
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {loading ? "Creating\u2026" : "Create room"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
