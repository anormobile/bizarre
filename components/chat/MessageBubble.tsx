"use client";

import { useState } from "react";
import type { MessageView, AttachmentView } from "@/lib/types";

interface MessageBubbleProps {
  message: MessageView;
  isOwn: boolean;
  onEdit: (id: number, content: string) => void;
  onDelete: (id: number) => void;
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
          className="max-h-64 max-w-xs rounded-md"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      download={attachment.originalName}
      className="inline-flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 text-sm hover:bg-muted"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
      <span className="truncate max-w-48">{attachment.originalName}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(attachment.sizeBytes)}</span>
    </a>
  );
}

export function MessageBubble({ message, isOwn, onEdit, onDelete }: MessageBubbleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [saving, setSaving] = useState(false);

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

  const time = new Date(message.createdAt).toLocaleTimeString();

  return (
    <div className="group flex flex-col gap-0.5 px-3 py-1 hover:bg-muted/50">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">@{message.username}</span>
        <span className="text-xs text-muted-foreground">{time}</span>
        {message.editedAt && !isDeleted && (
          <span className="text-xs text-muted-foreground italic">(edited)</span>
        )}
        {isOwn && !isDeleted && !editing && (
          <span className="ml-auto hidden gap-2 group-hover:flex">
            <button
              type="button"
              onClick={() => { setDraft(message.content); setEditing(true); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Delete
            </button>
          </span>
        )}
      </div>

      {isDeleted ? (
        <p className="text-sm italic text-muted-foreground">[deleted]</p>
      ) : editing ? (
        <div className="flex flex-col gap-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={3072}
            rows={2}
            className="w-full resize-none rounded-md border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
              if (e.key === "Escape") handleCancel();
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !draft.trim()}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-muted-foreground hover:underline"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {message.content && (
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
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
  );
}
