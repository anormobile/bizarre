"use client";

import { ContactItem } from "@/components/friends/ContactItem";
import type { FriendView } from "@/lib/types";

interface ContactsListProps {
  friends: FriendView[];
  onRemove: (userId: string) => void;
}

export function ContactsList({ friends, onRemove }: ContactsListProps) {
  if (friends.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">No contacts yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {friends.map((f) => (
        <ContactItem key={f.userId} friend={f} onRemove={onRemove} />
      ))}
    </div>
  );
}
