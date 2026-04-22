"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import type { RoomSummary, MessageView, WsMessage } from "@/lib/types";

export interface EventBus {
  subscribe: (cb: (msg: WsMessage) => void) => () => void;
}

interface ChatAreaProps {
  room: RoomSummary;
  currentUserId: string;
  currentUsername: string;
  eventBus: EventBus;
  viewerRoomRole?: 'owner' | 'admin' | 'member' | null;
}

export function ChatArea({ room, currentUserId, eventBus, viewerRoomRole }: ChatAreaProps) {
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [replyingTo, setReplyingTo] = useState<{ id: number; content: string; username: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const loadingOlder = useRef(false);

  const fetchMessages = useCallback(async (roomId: number, before?: number) => {
    const params = new URLSearchParams({ limit: "50" });
    if (before !== undefined) params.set("before", String(before));
    const res = await fetch(`/api/rooms/${roomId}/messages?${params}`);
    if (!res.ok) return null;
    return res.json() as Promise<{ messages: MessageView[]; nextCursor: number | null }>;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setNextCursor(null);
    setInitialLoad(true);
    setLoading(true);

    fetchMessages(room.id).then((data) => {
      if (cancelled || !data) return;
      setMessages(data.messages.reverse());
      setNextCursor(data.nextCursor);
      setLoading(false);
      setInitialLoad(false);
    });

    return () => { cancelled = true; };
  }, [room.id, fetchMessages]);

  useEffect(() => {
    if (!initialLoad && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [initialLoad]);

  useEffect(() => {
    const unsub = eventBus.subscribe((msg) => {
      if (msg.type === "MESSAGE_NEW" && Number(msg.payload.roomId) === Number(room.id)) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.payload.message.id)) return prev;
          return [...prev, msg.payload.message];
        });
        requestAnimationFrame(() => {
          const el = listRef.current;
          if (!el) return;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (atBottom) el.scrollTop = el.scrollHeight;
        });
      }
      if (msg.type === "MESSAGE_EDITED" && Number(msg.payload.roomId) === Number(room.id)) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.payload.messageId
              ? { ...m, content: msg.payload.content, editedAt: msg.payload.editedAt }
              : m,
          ),
        );
      }
      if (msg.type === "MESSAGE_DELETED" && Number(msg.payload.roomId) === Number(room.id)) {
        setMessages((prev) =>
          prev.map((m) =>
            Number(m.id) === Number(msg.payload.messageId)
              ? { ...m, content: "", deletedAt: new Date().toISOString() }
              : m,
          ),
        );
      }
    });
    return unsub;
  }, [eventBus, room.id]);

  function handleScroll() {
    const el = listRef.current;
    if (!el || loadingOlder.current || nextCursor === null) return;
    if (el.scrollTop < 80) {
      loadingOlder.current = true;
      setLoading(true);
      const oldHeight = el.scrollHeight;
      const oldTop = el.scrollTop;
      fetchMessages(room.id, nextCursor).then((data) => {
        loadingOlder.current = false;
        setLoading(false);
        if (!data) return;
        const older = data.messages.reverse();
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const deduped = older.filter((m) => !ids.has(m.id));
          return [...deduped, ...prev];
        });
        setNextCursor(data.nextCursor);
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight - oldHeight + oldTop;
          }
        });
      });
    }
  }

  async function handleEdit(id: number, content: string) {
    const res = await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) return;
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/messages/${id}`, { method: "DELETE" });
    if (!res.ok) return;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-surface">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-[11px]">
        <div>
          <h2 className="text-[15px] font-bold text-text">#{room.name}</h2>
          {room.description && (
            <p className="mt-px text-xs text-text-2">{room.description}</p>
          )}
        </div>
      </div>
      {loading && messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-text-3">Loading messages…</p>
        </div>
      ) : (
        <MessageList
          ref={listRef}
          messages={messages}
          currentUserId={currentUserId}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onReply={(msg) => setReplyingTo({ id: msg.id, content: msg.content, username: msg.username })}
          onScroll={handleScroll}
          viewerRoomRole={viewerRoomRole}
        />
      )}
      <MessageInput
        roomId={room.id}
        replyingTo={replyingTo}
        onClearReply={() => setReplyingTo(null)}
        onSent={(msg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          requestAnimationFrame(() => {
            if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
          });
        }}
      />
    </div>
  );
}
