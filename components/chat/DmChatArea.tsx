"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import type { EventBus } from "@/components/chat/ChatArea";
import type { MessageView } from "@/lib/types";

interface DmChatAreaProps {
  friendUserId: string;
  friendUsername: string;
  currentUserId: string;
  eventBus: EventBus;
}

export function DmChatArea({ friendUserId, friendUsername, currentUserId, eventBus }: DmChatAreaProps) {
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [notFriends, setNotFriends] = useState(false);
  const [dmId, setDmId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const loadingOlder = useRef(false);

  const fetchMessages = useCallback(async (userId: string, before?: number) => {
    const params = new URLSearchParams({ limit: "50" });
    if (before !== undefined) params.set("before", String(before));
    const res = await fetch(`/api/dms/${userId}/messages?${params}`);
    if (res.status === 403) return "not_friends" as const;
    if (!res.ok) return null;
    return res.json() as Promise<{ messages: MessageView[]; nextCursor: number | null }>;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setNextCursor(null);
    setInitialLoad(true);
    setLoading(true);
    setNotFriends(false);
    setDmId(null);

    fetchMessages(friendUserId).then((data) => {
      if (cancelled) return;
      if (data === "not_friends") {
        setNotFriends(true);
        setLoading(false);
        setInitialLoad(false);
        return;
      }
      if (!data) {
        setLoading(false);
        setInitialLoad(false);
        return;
      }
      const reversed = data.messages.reverse();
      setMessages(reversed);
      setNextCursor(data.nextCursor);
      if (reversed.length > 0 && reversed[0]!.dmId !== null) {
        setDmId(reversed[0]!.dmId);
      }
      setLoading(false);
      setInitialLoad(false);
    });

    return () => { cancelled = true; };
  }, [friendUserId, fetchMessages]);

  useEffect(() => {
    if (!initialLoad && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [initialLoad]);

  useEffect(() => {
    const unsub = eventBus.subscribe((msg) => {
      if (msg.type === "MESSAGE_NEW" && "dmId" in msg.payload && msg.payload.dmId !== undefined) {
        if (dmId !== null && msg.payload.dmId === dmId) {
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
        } else if (dmId === null) {
          const m = msg.payload.message;
          const participants = [currentUserId, friendUserId].sort();
          const msgParticipants = [m.userId, m.userId === currentUserId ? friendUserId : currentUserId].sort();
          if (participants[0] === msgParticipants[0] && participants[1] === msgParticipants[1]) {
            setDmId(msg.payload.dmId);
            setMessages((prev) => {
              if (prev.some((existing) => existing.id === m.id)) return prev;
              return [...prev, m];
            });
            requestAnimationFrame(() => {
              const el = listRef.current;
              if (!el) return;
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              if (atBottom) el.scrollTop = el.scrollHeight;
            });
          }
        }
      }
      if (msg.type === "MESSAGE_EDITED" && "dmId" in msg.payload && msg.payload.dmId !== undefined && msg.payload.dmId === dmId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.payload.messageId
              ? { ...m, content: msg.payload.content, editedAt: msg.payload.editedAt }
              : m,
          ),
        );
      }
      if (msg.type === "MESSAGE_DELETED" && "dmId" in msg.payload && msg.payload.dmId !== undefined && msg.payload.dmId === dmId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.payload.messageId
              ? { ...m, content: "", deletedAt: new Date().toISOString() }
              : m,
          ),
        );
      }
    });
    return unsub;
  }, [eventBus, dmId, currentUserId, friendUserId]);

  function handleScroll() {
    const el = listRef.current;
    if (!el || loadingOlder.current || nextCursor === null) return;
    if (el.scrollTop < 80) {
      loadingOlder.current = true;
      setLoading(true);
      const oldHeight = el.scrollHeight;
      const oldTop = el.scrollTop;
      fetchMessages(friendUserId, nextCursor).then((data) => {
        loadingOlder.current = false;
        setLoading(false);
        if (!data || data === "not_friends") return;
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

  function handleSent(message: MessageView) {
    if (message.dmId !== null && dmId === null) {
      setDmId(message.dmId);
    }
  }

  async function handleEdit(id: number, content: string) {
    await fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }

  async function handleDelete(id: number) {
    await fetch(`/api/messages/${id}`, { method: "DELETE" });
  }

  if (notFriends) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center border-b px-4 py-2">
          <span className="text-sm font-semibold">@{friendUsername}</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">You are no longer friends with this user.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center border-b px-4 py-2">
        <span className="text-sm font-semibold">@{friendUsername}</span>
      </div>
      {loading && messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading messages…</p>
        </div>
      ) : (
        <MessageList
          ref={listRef}
          messages={messages}
          currentUserId={currentUserId}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onScroll={handleScroll}
        />
      )}
      <MessageInput
        dmId={dmId ?? undefined}
        dmUserId={dmId === null ? friendUserId : undefined}
        onSent={handleSent}
      />
    </div>
  );
}
