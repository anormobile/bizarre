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
      <DialogTrigger render={<Button size="sm" className="w-full" />}>
        Create room
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="room-name" className="text-xs font-medium text-muted-foreground">
              Name
            </label>
            <Input
              id="room-name"
              placeholder="general"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={3}
              maxLength={48}
              pattern="^[a-zA-Z0-9_-]+$"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="room-desc" className="text-xs font-medium text-muted-foreground">
              Description (optional)
            </label>
            <Input
              id="room-desc"
              placeholder="A place for everyone"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={256}
            />
          </div>
          <fieldset className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === "public"}
                onChange={() => setVisibility("public")}
                className="accent-primary"
              />
              Public
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="visibility"
                value="private"
                checked={visibility === "private"}
                onChange={() => setVisibility("private")}
                className="accent-primary"
              />
              Private
            </label>
          </fieldset>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating\u2026" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
