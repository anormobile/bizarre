"use client";

import { useState } from "react";
import { RoomItem } from "@/components/rooms/RoomItem";
import { CreateRoomModal } from "@/components/rooms/CreateRoomModal";
import { ContactsList } from "@/components/friends/ContactsList";
import type { RoomSummary, FriendView } from "@/lib/types";

interface SidebarProps {
  mine: RoomSummary[];
  selectedRoomId: number | null;
  onSelect: (roomId: number) => void;
  onMineChange: (next: RoomSummary[]) => void;
  friends: FriendView[];
  onFriendsChange: (next: FriendView[]) => void;
  selectedDmUserId: string | null;
  onSelectDm: (userId: string) => void;
}

function SidebarSection({ label, open, onToggle, badge, children }: {
  label: string;
  open: boolean;
  onToggle: () => void;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5"
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
        >
          <path d="M6 9L12 15L18 9" stroke="var(--color-text-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-text-3">
          {label}
        </span>
        {badge != null && badge > 0 && (
          <span className="text-[10px] font-bold text-text-3">{badge}</span>
        )}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

export function Sidebar({
  mine,
  selectedRoomId,
  onSelect,
  onMineChange,
  friends,
  onFriendsChange,
  selectedDmUserId,
  onSelectDm,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [sections, setSections] = useState({ rooms: true, private: true, contacts: true });

  function toggleSection(key: keyof typeof sections) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const q = search.toLowerCase();
  const publicRooms = mine.filter((r) => r.visibility === "public" && (!q || r.name.toLowerCase().includes(q)));
  const privateRooms = mine.filter((r) => r.visibility === "private" && (!q || r.name.toLowerCase().includes(q)));
  const filteredFriends = friends.filter((f) => !q || f.username.toLowerCase().includes(q));

  function handleCreated(room: RoomSummary) {
    onMineChange(
      mine.some((r) => r.id === room.id) ? mine : [room, ...mine],
    );
  }

  function handleRemoveFriend(userId: string) {
    onFriendsChange(friends.filter((f) => f.userId !== userId));
  }

  return (
    <aside className="flex w-[230px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-2.5 pb-1.5 pt-2.5">
        <div className="relative">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="8" stroke="var(--color-text-3)" strokeWidth="2"/>
            <path d="M21 21L16.65 16.65" stroke="var(--color-text-3)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-lg border-[1.5px] border-border bg-bg py-1.5 pl-7 pr-2.5 text-[13px] text-text outline-none transition-colors focus:border-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-1">
        <SidebarSection label="Rooms" open={sections.rooms} onToggle={() => toggleSection('rooms')} badge={publicRooms.length}>
          {publicRooms.map((r) => (
            <RoomItem key={r.id} room={r} selected={selectedRoomId === r.id} onSelect={(room) => onSelect(room.id)} />
          ))}
        </SidebarSection>

        <SidebarSection label="Private" open={sections.private} onToggle={() => toggleSection('private')} badge={privateRooms.length}>
          {privateRooms.map((r) => (
            <RoomItem key={r.id} room={r} selected={selectedRoomId === r.id} onSelect={(room) => onSelect(room.id)} />
          ))}
        </SidebarSection>

        <SidebarSection label="Contacts" open={sections.contacts} onToggle={() => toggleSection('contacts')}>
          <ContactsList friends={filteredFriends} selectedUserId={selectedDmUserId} onSelect={onSelectDm} onRemove={handleRemoveFriend} />
        </SidebarSection>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border p-2.5">
        <CreateRoomModal onCreated={handleCreated} />
      </div>
    </aside>
  );
}
