"use client";

import { useState, useRef, useCallback } from "react";
import type { MessageView } from "@/lib/types";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

interface MessageInputProps {
  roomId?: number;
  dmId?: number;
  dmUserId?: string;
  onSent?: (message: MessageView) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageInput({ roomId, dmId, dmUserId, onSent }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > MAX_ATTACHMENT_BYTES) return "file too large";
    if (file.type.startsWith("image/") && file.size > MAX_IMAGE_BYTES) return "image too large";
    return null;
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const err = validateFile(file);
      if (err) {
        setError(err);
        e.target.value = "";
        return;
      }
      setError(null);
      setSelectedFile(file);
    }
    e.target.value = "";
  }, [validateFile]);

  const removeFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const submit = useCallback(async () => {
    const trimmed = content.trim();
    if (sending) return;
    if (!selectedFile && !trimmed) return;

    setSending(true);
    setError(null);

    try {
      let res: Response;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("content", trimmed);
        if (roomId) formData.append("roomId", String(roomId));
        else if (dmId) formData.append("dmId", String(dmId));
        else if (dmUserId) formData.append("userId", dmUserId);

        res = await fetch("/api/attachments", {
          method: "POST",
          body: formData,
        });
      } else {
        const payload: Record<string, unknown> = { content: trimmed };
        if (roomId) payload.roomId = roomId;
        else if (dmId) payload.dmId = dmId;
        else payload.userId = dmUserId;

        res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (res.status === 201) {
        const data = await res.json();
        setContent("");
        setSelectedFile(null);
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
  }, [content, roomId, dmId, dmUserId, sending, selectedFile, onSent]);

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
      {selectedFile && (
        <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm">
          <span className="truncate">{selectedFile.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatBytes(selectedFile.size)}
          </span>
          <button
            type="button"
            onClick={removeFile}
            className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Remove file"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="self-end rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Attach"
          title="Attach file"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
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
          disabled={sending || (!content.trim() && !selectedFile)}
          className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
