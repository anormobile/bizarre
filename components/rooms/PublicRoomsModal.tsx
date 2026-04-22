"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RoomSummary } from "@/lib/types";

interface PublicRoomsModalProps {
  onJoined: (room: RoomSummary) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: boolean;
}

export function PublicRoomsModal({ onJoined, open: controlledOpen, onOpenChange, trigger = false }: PublicRoomsModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [catalog, setCatalog] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      if (res.ok) {
        setCatalog(data.publicCatalog);
      }
    } catch {
      setError("failed to load rooms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchCatalog();
  }, [isOpen, fetchCatalog]);

  async function handleJoin(room: RoomSummary) {
    setJoining(room.id);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${room.id}/join`, { method: "POST" });
      if (res.ok) {
        setCatalog((prev) => prev.filter((r) => r.id !== room.id));
        onJoined(room);
      } else {
        const data = await res.json();
        setError(data.error ?? "failed to join");
      }
    } catch {
      setError("network error");
    } finally {
      setJoining(null);
    }
  }

  const trimmed = search.toLowerCase().trim();
  const filtered = trimmed
    ? catalog.filter((r) => r.name.toLowerCase().includes(trimmed))
    : catalog;

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (val) fetchCatalog();
    else setSearch("");
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && (
        <button
          type="button"
          onClick={() => handleOpenChange(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-[9px] border-[1.5px] border-dashed border-border px-2.5 py-[7px] text-xs text-text-2 transition-colors hover:border-primary hover:text-primary"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M2 12H22" stroke="currentColor" strokeWidth="2"/><path d="M12 2C14.5 5 15.5 8 15.5 12C15.5 16 14.5 19 12 22" stroke="currentColor" strokeWidth="2"/><path d="M12 2C9.5 5 8.5 8 8.5 12C8.5 16 9.5 19 12 22" stroke="currentColor" strokeWidth="2"/></svg>
          Browse public
        </button>
      )}
      <DialogContent className="sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle>Public Rooms</DialogTitle>
        </DialogHeader>
        <input
          type="text"
          placeholder="Search rooms…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="mb-3 w-full rounded-[9px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
        />
        {loading && <p className="text-sm text-text-3">Loading…</p>}
        {error && <p className="text-xs text-unread">{error}</p>}
        {!loading && filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-text-3">No rooms found</p>
        )}
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {filtered.map((room) => (
            <div
              key={room.id}
              className="flex items-center gap-3.5 rounded-xl border border-border bg-surface px-3.5 py-3 transition-colors hover:border-primary"
            >
              <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] bg-primary-light">
                <span className="text-base font-bold text-primary">#</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-text">{room.name}</div>
                {room.description && (
                  <div className="truncate text-[13px] text-text-2">{room.description}</div>
                )}
                <div className="mt-0.5 text-[11px] text-text-3">{room.memberCount} members</div>
              </div>
              {room.joined ? (
                <span className="shrink-0 rounded-lg bg-bg px-4 py-1.5 text-[13px] font-semibold text-text-3">
                  Joined
                </span>
              ) : (
                <button
                  onClick={() => handleJoin(room)}
                  disabled={joining === room.id}
                  className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {joining === room.id ? "Joining\u2026" : "Join"}
                </button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
