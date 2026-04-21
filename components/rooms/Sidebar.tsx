"use client";

import { RoomItem } from "@/components/rooms/RoomItem";
import { CreateRoomModal } from "@/components/rooms/CreateRoomModal";
import { PublicRoomsModal } from "@/components/rooms/PublicRoomsModal";
import { AddContactModal } from "@/components/friends/AddContactModal";
import { FriendRequestsModal } from "@/components/friends/FriendRequestsModal";
import { InvitationsModal } from "@/components/friends/InvitationsModal";
import { ContactsList } from "@/components/friends/ContactsList";
import type { RoomSummary, FriendView, FriendRequestView } from "@/lib/types";

interface SidebarProps {
  mine: RoomSummary[];
  selectedRoomId: number | null;
  onSelect: (roomId: number) => void;
  currentUserId: string;
  onMineChange: (next: RoomSummary[]) => void;
  friends: FriendView[];
  incoming: FriendRequestView[];
  outgoing: FriendRequestView[];
  onFriendsChange: (next: FriendView[]) => void;
  onIncomingChange: (next: FriendRequestView[]) => void;
  onOutgoingChange: (next: FriendRequestView[]) => void;
  selectedDmUserId: string | null;
  onSelectDm: (userId: string) => void;
}

export function Sidebar({
  mine,
  selectedRoomId,
  onSelect,
  onMineChange,
  friends,
  incoming,
  outgoing,
  onFriendsChange,
  onIncomingChange,
  onOutgoingChange,
  selectedDmUserId,
  onSelectDm,
}: SidebarProps) {
  function handleCreated(room: RoomSummary) {
    onMineChange(
      mine.some((r) => r.id === room.id) ? mine : [room, ...mine],
    );
  }

  function handleJoined(room: RoomSummary) {
    onMineChange(
      mine.some((r) => r.id === room.id)
        ? mine
        : [{ ...room, memberCount: room.memberCount + 1 }, ...mine],
    );
  }

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

  function handleAccepted(friend: FriendView) {
    onIncomingChange(incoming.filter((r) => r.userId !== friend.userId));
    onFriendsChange(
      friends.some((f) => f.userId === friend.userId)
        ? friends
        : [...friends, friend].sort((a, b) => a.username.localeCompare(b.username)),
    );
  }

  function handleDeclined(userId: string) {
    onIncomingChange(incoming.filter((r) => r.userId !== userId));
  }

  function handleCancelledOutgoing(userId: string) {
    onOutgoingChange(outgoing.filter((r) => r.userId !== userId));
  }

  function handleRemoveFriend(userId: string) {
    onFriendsChange(friends.filter((f) => f.userId !== userId));
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col gap-3 border-r p-3 overflow-y-auto">
      <div className="flex flex-col gap-2">
        <CreateRoomModal onCreated={handleCreated} />
        <PublicRoomsModal onJoined={handleJoined} />
        <InvitationsModal onJoined={handleJoined} />
      </div>
      <nav className="flex flex-col gap-0.5">
        {mine.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            No rooms yet
          </p>
        )}
        {mine.map((room) => (
          <RoomItem
            key={room.id}
            room={room}
            selected={selectedRoomId === room.id}
            onSelect={(r) => onSelect(r.id)}
          />
        ))}
      </nav>

      <div className="border-t pt-3">
        <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contacts
        </h3>
        <div className="mb-2 flex gap-1.5">
          <AddContactModal onSent={handleRequestSent} onAutoAccepted={handleAutoAccepted} />
          <FriendRequestsModal
            incoming={incoming}
            outgoing={outgoing}
            onAccepted={handleAccepted}
            onDeclined={handleDeclined}
            onCancelledOutgoing={handleCancelledOutgoing}
          />
        </div>
        <ContactsList friends={friends} selectedUserId={selectedDmUserId} onSelect={onSelectDm} onRemove={handleRemoveFriend} />
      </div>
    </aside>
  );
}
