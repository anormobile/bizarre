"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { MessageView } from "@/lib/types";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

interface ReplyingTo {
  id: number;
  content: string;
  username: string;
}

interface MessageInputProps {
  roomId?: number;
  dmId?: number;
  dmUserId?: string;
  onSent?: (message: MessageView) => void;
  replyingTo?: ReplyingTo | null;
  onClearReply?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageInput({ roomId, dmId, dmUserId, onSent, replyingTo, onClearReply }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [focused, setFocused] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!emojiOpen) return;
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [emojiOpen]);

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
        if (replyingTo) payload.replyToId = replyingTo.id;

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
        onClearReply?.();
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
  }, [content, roomId, dmId, dmUserId, sending, selectedFile, onSent, replyingTo, onClearReply]);

  const EMOJIS = [
    '😀','😂','🥹','😍','🤩','😘','😜','🤪','😎','🥳',
    '😭','😤','🤯','🫡','🤔','🫠','😴','🤮','👻','💀',
    '👋','👍','👎','👏','🙌','🤝','✌️','🤞','💪','🫶',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥',
    '🔥','✨','🎉','💯','⭐','🌈','☀️','🌙','🍕','☕',
  ];

  const insertEmoji = useCallback((emoji: string) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart ?? content.length;
      const end = ta.selectionEnd ?? content.length;
      const next = content.slice(0, start) + emoji + content.slice(end);
      setContent(next);
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + emoji.length;
        ta.setSelectionRange(pos, pos);
      });
    } else {
      setContent(prev => prev + emoji);
    }
    setEmojiOpen(false);
  }, [content]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-surface px-3.5 pb-3 pt-2.5">
      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-[3px] border-primary bg-primary-light px-2.5 py-[5px]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="var(--color-primary)" strokeWidth="2"/></svg>
          <span className="flex-1 truncate text-xs text-primary">
            Replying to <strong>@{replyingTo.username}</strong>: {replyingTo.content.slice(0, 80)}
          </span>
          <button onClick={onClearReply} className="px-0.5 text-base leading-none text-primary hover:text-primary-hover">×</button>
        </div>
      )}
      {error && <p className="mb-1.5 text-xs text-unread">{error}</p>}
      {selectedFile && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm">
          <span className="truncate">{selectedFile.name}</span>
          <span className="shrink-0 text-xs text-text-3">{formatBytes(selectedFile.size)}</span>
          <button onClick={removeFile} className="ml-auto shrink-0 text-text-3 hover:text-text" aria-label="Remove file">✕</button>
        </div>
      )}
      <div
        className={`flex items-end gap-2 rounded-[13px] border-[1.5px] bg-bg px-1.5 py-1 transition-all ${
          focused ? 'border-primary shadow-[0_0_0_3px_rgba(92,107,192,0.1)]' : 'border-border'
        }`}
      >
        <div className="flex gap-px self-end pb-1">
          <div ref={emojiRef} className="relative">
            <button
              type="button"
              onClick={() => setEmojiOpen(o => !o)}
              disabled={sending}
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-3 transition-colors hover:text-primary disabled:opacity-50"
              title="Emoji"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/><path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="9.5" r="1" fill="currentColor"/><circle cx="15" cy="9.5" r="1" fill="currentColor"/></svg>
            </button>
            {emojiOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-2 grid w-[280px] grid-cols-10 gap-0.5 rounded-xl border border-border bg-surface p-2 shadow-[0_8px_28px_rgba(0,0,0,0.12)]">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-base hover:bg-bg"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-3 transition-colors hover:text-primary disabled:opacity-50"
            title="Attach file"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21.44 11.05L12.25 20.24a5.5 5.5 0 01-7.78-7.78l9.19-9.19a3.5 3.5 0 014.95 4.95L9.42 17.41a1.5 1.5 0 01-2.12-2.12l8.19-8.18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="absolute w-0 h-0 overflow-hidden opacity-0"
          onChange={handleFileSelect}
        />
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of Array.from(items)) {
              if (item.kind === "file") {
                const f = item.getAsFile();
                if (f) {
                  e.preventDefault();
                  const err = validateFile(f);
                  if (err) { setError(err); return; }
                  setSelectedFile(f);
                  return;
                }
              }
            }
          }}
          placeholder="Message…"
          maxLength={3072}
          rows={1}
          disabled={sending}
          className="flex-1 resize-none border-none bg-transparent py-[5px] text-sm leading-[1.55] text-text outline-none placeholder:text-text-3"
          style={{ maxHeight: 110, overflowY: 'auto' }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={sending || (!content.trim() && !selectedFile)}
          className={`mb-px flex h-[33px] w-[33px] shrink-0 items-center justify-center self-end rounded-[9px] transition-colors ${
            content.trim() || selectedFile ? 'bg-primary' : 'bg-border'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div className="mt-1 pl-0.5 text-[11px] text-text-3">
        Enter to send · Shift+Enter for newline
      </div>
    </div>
  );
}
