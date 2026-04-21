"use client";

import { forwardRef } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { MessageView } from "@/lib/types";

interface MessageListProps {
  messages: MessageView[];
  currentUserId: string;
  onEdit: (id: number, content: string) => void;
  onDelete: (id: number) => void;
  onReply?: (message: MessageView) => void;
  onScroll?: () => void;
  viewerRoomRole?: 'owner' | 'admin' | 'member' | null;
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="h-px flex-1 bg-border" />
      <span className="rounded-[20px] border border-border bg-bg px-2.5 py-px text-[11px] font-semibold text-text-3">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function getDateLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  function MessageList({ messages, currentUserId, onEdit, onDelete, onReply, onScroll, viewerRoomRole }, ref) {
    let lastDate = "";

    return (
      <div ref={ref} onScroll={onScroll} className="flex flex-1 flex-col overflow-y-auto py-1.5">
        {messages.length === 0 && (
          <DateDivider label="Today" />
        )}
        {messages.map((msg) => {
          const msgDate = getDateLabel(msg.createdAt);
          let divider: React.ReactNode = null;
          if (msgDate !== lastDate) {
            lastDate = msgDate;
            divider = <DateDivider key={`date-${msgDate}-${msg.id}`} label={msgDate} />;
          }
          return (
            <div key={msg.id}>
              {divider}
              <MessageBubble
                message={msg}
                isOwn={msg.userId === currentUserId}
                onEdit={onEdit}
                onDelete={onDelete}
                onReply={onReply}
                viewerRoomRole={viewerRoomRole}
              />
            </div>
          );
        })}
      </div>
    );
  },
);
