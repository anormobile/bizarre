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

interface PublicRoomsModalProps {
  onJoined: (room: RoomSummary) => void;
}

export function PublicRoomsModal({ onJoined }: PublicRoomsModalProps) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function fetchCatalog() {
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
  }

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

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (val) fetchCatalog();
        else setSearch("");
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" className="w-full" />}>
        Browse public
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Public rooms</DialogTitle>
        </DialogHeader>
        <input
          type="text"
          placeholder="Search rooms…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">No public rooms to join.</p>
        )}
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {filtered.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">#{room.name}</p>
                {room.description && (
                  <p className="truncate text-xs text-muted-foreground">
                    {room.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {room.memberCount} member{room.memberCount !== 1 ? "s" : ""}
                </p>
              </div>
              <Button
                size="sm"
                disabled={joining === room.id}
                onClick={() => handleJoin(room)}
              >
                {joining === room.id ? "Joining\u2026" : "Join"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
