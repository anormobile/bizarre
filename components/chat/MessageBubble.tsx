"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { MessageView, AttachmentView } from "@/lib/types";

interface MessageBubbleProps {
  message: MessageView;
  isOwn: boolean;
  onEdit: (id: number, content: string) => void;
  onDelete: (id: number) => void;
  onReply?: (message: MessageView) => void;
  viewerRoomRole?: 'owner' | 'admin' | 'member' | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentRenderer({ attachment }: { attachment: AttachmentView }) {
  const url = `/api/attachments/${attachment.id}`;

  if (attachment.mime.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={attachment.originalName}
          className="max-h-64 max-w-xs rounded-[10px]"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      download={attachment.originalName}
      className="mt-1.5 inline-flex items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-2 text-sm hover:border-primary"
    >
      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-text-2/10">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-text">{attachment.originalName}</div>
        <div className="text-[11px] text-text-3">{formatBytes(attachment.sizeBytes)}</div>
      </div>
    </a>
  );
}

export function MessageBubble({ message, isOwn, onEdit, onDelete, onReply, viewerRoomRole }: MessageBubbleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isDeleted = message.deletedAt !== null;

  function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    onEdit(message.id, trimmed);
    setEditing(false);
    setSaving(false);
  }

  function handleCancel() {
    setDraft(message.content);
    setEditing(false);
  }

  const time = new Date(message.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex items-start gap-2.5 px-3.5 py-[5px] transition-colors hover:bg-[oklch(97%_0.005_265)]"
    >
      <Avatar username={message.username} size={32} />
      <div className="min-w-0 flex-1">
        {message.replyTo && (
          <div className="mb-[5px] flex max-w-[420px] gap-2 rounded-r-[7px] border-l-[3px] border-primary bg-bg px-2.5 py-[5px]">
            <span className="truncate text-xs text-text-2">
              <strong className="text-text">@{message.replyTo.username}</strong>: {message.replyTo.content.slice(0, 100)}
            </span>
          </div>
        )}
        <div className="mb-0.5 flex items-baseline gap-2">
          <span className="text-sm font-bold text-text">{message.username}</span>
          <span className="text-[11px] text-text-3">{time}</span>
          {message.editedAt && !isDeleted && (
            <span className="text-[11px] italic text-text-3">edited</span>
          )}
        </div>

        {isDeleted ? (
          <p className="text-sm italic text-text-3">[deleted]</p>
        ) : editing ? (
          <div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              maxLength={3072}
              rows={2}
              className="w-full max-w-[520px] resize-none rounded-lg border-[1.5px] border-primary px-2.5 py-1.5 text-sm text-text outline-none shadow-[0_0_0_3px_rgba(92,107,192,0.12)]"
              style={{ lineHeight: 1.5 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
                if (e.key === "Escape") handleCancel();
              }}
            />
            <div className="mt-[5px] flex gap-1.5">
              <button
                onClick={handleSave}
                disabled={saving || !draft.trim()}
                className="rounded-[7px] bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="rounded-[7px] border border-border px-2.5 py-1 text-xs text-text-2"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {message.content && (
              <p className="text-sm leading-[1.58] text-text" style={{ textWrap: 'pretty' as never }}>{message.content}</p>
            )}
            {message.attachments?.length > 0 && (
              <div className="mt-1 flex flex-col gap-1">
                {message.attachments.map((att) => (
                  <AttachmentRenderer key={att.id} attachment={att} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {hovered && !editing && !isDeleted && (
        <div className="absolute right-3.5 top-[3px] flex overflow-hidden rounded-[9px] border border-border bg-surface shadow-[0_2px_10px_rgba(0,0,0,0.09)]">
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="flex h-7 w-[30px] items-center justify-center text-text-2 transition-colors hover:bg-bg"
              title="Reply"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          )}
          {isOwn && (
            <>
              <button
                onClick={() => { setDraft(message.content); setEditing(true); }}
                className="flex h-7 w-[30px] items-center justify-center border-l border-border text-text-2 transition-colors hover:bg-bg"
                title="Edit"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
              <button
                onClick={() => onDelete(message.id)}
                className="flex h-7 w-[30px] items-center justify-center border-l border-border text-unread transition-colors hover:bg-[#FEF2F2]"
                title="Delete"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </>
          )}
          {!isOwn && message.roomId != null && (viewerRoomRole === "owner" || viewerRoomRole === "admin") && (
            <button
              onClick={() => onDelete(message.id)}
              className="flex h-7 w-[30px] items-center justify-center border-l border-border text-unread transition-colors hover:bg-[#FEF2F2]"
              title="Delete"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
