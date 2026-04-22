'use client';

import { useState, useRef, useEffect } from "react";
import { Avatar } from "@/components/Avatar";
import { PresenceDot } from "@/components/PresenceDot";

export type NavView = 'chat' | 'public' | 'contacts' | 'sessions';

interface TopNavProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
  username: string;
  onSignOut: () => void;
  onChangePassword: () => void;
  onDeleteAccount: () => void;
}

const NAV_ITEMS: { id: NavView; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'public', label: 'Public Rooms' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'sessions', label: 'Sessions' },
];

export function TopNav({ activeView, onViewChange, username, onSignOut, onChangePassword, onDeleteAccount }: TopNavProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [profileOpen]);

  return (
    <div className="relative z-20 flex h-[54px] shrink-0 items-center gap-0.5 border-b border-border bg-surface px-[18px]">
      <div className="mr-5 flex items-center gap-2">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-primary shadow-[0_2px_8px_rgba(92,107,192,0.35)]">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="white"/>
          </svg>
        </div>
        <span className="text-[17px] font-extrabold tracking-tight text-text">Bizarre</span>
      </div>

      <div className="flex flex-1 gap-0.5">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`rounded-lg px-[13px] py-[5px] text-[13px] font-medium transition-all ${
              activeView === item.id
                ? 'bg-primary-light text-primary'
                : 'text-text-2 hover:bg-bg'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setProfileOpen(o => !o)}
          className={`flex items-center gap-2 rounded-[10px] px-2.5 py-[5px] transition-colors ${
            profileOpen ? 'bg-bg' : 'hover:bg-bg'
          }`}
        >
          <div className="relative">
            <Avatar username={username} size={28} />
            <PresenceDot
              status="online"
              size={9}
              borderColor="var(--color-surface)"
              className="absolute -bottom-px -right-px"
            />
          </div>
          <span className="text-[13px] font-semibold text-text">{username}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M6 9L12 15L18 9" stroke="var(--color-text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {profileOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-[100] min-w-[190px] overflow-hidden rounded-[13px] border border-border bg-surface shadow-[0_8px_28px_rgba(0,0,0,0.12)]">
            <div className="border-b border-border px-3.5 pb-2.5 pt-3">
              <div className="text-[13px] font-semibold text-text">{username}</div>
              <div className="text-xs text-text-3">@{username}</div>
            </div>
            <button
              onClick={() => { onChangePassword(); setProfileOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-text transition-colors hover:bg-bg"
            >
              <span className="text-[14px]">🔑</span>
              Change password
            </button>
            <button
              onClick={() => { onDeleteAccount(); setProfileOpen(false); }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-unread transition-colors hover:bg-[#FEF2F2]"
            >
              <span className="text-[14px]">🗑</span>
              Delete account
            </button>
            <button
              onClick={() => { onSignOut(); setProfileOpen(false); }}
              className="flex w-full items-center gap-2.5 border-t border-border px-3.5 py-2.5 text-left text-[13px] text-unread transition-colors hover:bg-[#FEF2F2]"
            >
              <span className="text-[14px]">→</span>
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
