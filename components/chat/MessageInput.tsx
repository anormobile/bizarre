"use client";

import { useState, useRef, useCallback } from "react";
import type { MessageView } from "@/lib/types";

interface MessageInputProps {
  roomId?: number;
  dmId?: number;
  dmUserId?: string;
  onSent?: (message: MessageView) => void;
}

export function MessageInput({ roomId, dmId, dmUserId, onSent }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    let payload: Record<string, unknown>;
    if (roomId) {
      payload = { roomId, content: trimmed };
    } else if (dmId) {
      payload = { dmId, content: trimmed };
    } else {
      payload = { userId: dmUserId, content: trimmed };
    }

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 201) {
        const data = await res.json();
        setContent("");
        onSent?.(data.message as MessageView);
      } else {
        const data = await res.json().catch(() => ({ error: "request failed" }));
        setError(data.error ?? "request failed");
      }
    } catch {
      setError("network error");
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [content, roomId, dmId, dmUserId, sending, onSent]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t p-3">
      {error && (
        <p className="mb-1 text-xs text-destructive">{error}</p>
      )}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          maxLength={3072}
          rows={3}
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          disabled={sending}
        />
        <button
          type="button"
          onClick={submit}
          disabled={sending || !content.trim()}
          className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
