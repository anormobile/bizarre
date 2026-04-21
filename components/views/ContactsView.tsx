"use client";

import { Avatar } from "@/components/Avatar";
import { PresenceDot } from "@/components/PresenceDot";
import { usePresence } from "@/hooks/usePresence";
import { AddContactModal } from "@/components/friends/AddContactModal";
import type { FriendView, FriendRequestView } from "@/lib/types";

interface ContactsViewProps {
  friends: FriendView[];
  onSelectContact: (userId: string) => void;
  onFriendsChange: (next: FriendView[]) => void;
  onIncomingChange: (next: FriendRequestView[]) => void;
  onOutgoingChange: (next: FriendRequestView[]) => void;
  incoming: FriendRequestView[];
  outgoing: FriendRequestView[];
}

function ContactCard({ friend, onMessage }: { friend: FriendView; onMessage: () => void }) {
  const status = usePresence(friend.userId);

  return (
    <div
      onClick={onMessage}
      className="flex cursor-pointer items-center gap-3.5 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-primary"
    >
      <div className="relative">
        <Avatar username={friend.username} size={40} />
        <PresenceDot
          status={status}
          size={12}
          borderColor="var(--color-surface)"
          className="absolute -bottom-0 -right-0"
        />
      </div>
      <div className="flex-1">
        <div className="text-sm font-bold text-text">{friend.username}</div>
        <div className="text-xs capitalize text-text-3">@{friend.username} · {status}</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onMessage(); }}
        className="rounded-lg bg-primary-light px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
      >
        Message
      </button>
    </div>
  );
}

export function ContactsView({
  friends,
  onSelectContact,
  onFriendsChange,
  onIncomingChange,
  onOutgoingChange,
  incoming,
  outgoing,
}: ContactsViewProps) {
  function handleRequestSent(view: FriendRequestView) {
    onOutgoingChange([view, ...outgoing]);
  }

  function handleAutoAccepted(friend: FriendView) {
    onFriendsChange(
      friends.some((f) => f.userId === friend.userId)
        ? friends
        : [...friends, friend].sort((a, b) => a.username.localeCompare(b.username)),
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-7">
      <div className="max-w-[560px]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-extrabold tracking-tight">Contacts</h2>
          <AddContactModal onSent={handleRequestSent} onAutoAccepted={handleAutoAccepted} />
        </div>

        {friends.length === 0 && (
          <p className="py-8 text-center text-sm text-text-3">No contacts yet. Add someone to get started!</p>
        )}

        <div className="flex flex-col gap-2">
          {friends.map((f) => (
            <ContactCard
              key={f.userId}
              friend={f}
              onMessage={() => onSelectContact(f.userId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
