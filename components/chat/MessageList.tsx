"use client";

import { forwardRef } from "react";
import { MessageBubble } from "@/components/chat/MessageBubble";
import type { MessageView } from "@/lib/types";

interface MessageListProps {
  messages: MessageView[];
  currentUserId: string;
  onEdit: (id: number, content: string) => void;
  onDelete: (id: number) => void;
  onScroll?: () => void;
}

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  function MessageList({ messages, currentUserId, onEdit, onDelete, onScroll }, ref) {
    return (
      <div ref={ref} onScroll={onScroll} className="flex flex-1 flex-col overflow-y-auto">
        {messages.length === 0 && (
          <p className="m-auto text-sm text-muted-foreground">No messages yet</p>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.userId === currentUserId}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    );
  },
);
