"use client";

import { ContactItem } from "@/components/friends/ContactItem";
import type { FriendView } from "@/lib/types";

interface ContactsListProps {
  friends: FriendView[];
  selectedUserId: string | null;
  onSelect: (userId: string) => void;
  onRemove: (userId: string) => void;
}

export function ContactsList({ friends, selectedUserId, onSelect, onRemove }: ContactsListProps) {
  if (friends.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-text-3">No contacts yet</p>
    );
  }

  return (
    <div className="flex flex-col">
      {friends.map((f) => (
        <ContactItem
          key={f.userId}
          friend={f}
          selected={selectedUserId === f.userId}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
