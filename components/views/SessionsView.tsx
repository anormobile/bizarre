"use client";

import { useState, useEffect } from "react";

interface SessionData {
  id: string;
  browser: string | null;
  os: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export function SessionsView() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.sessions) setSessions(data.sessions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSignOut(id: string) {
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  }

  function formatLastSeen(iso: string, current: boolean): string {
    if (current) return "Now";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="flex-1 overflow-y-auto p-7">
      <div className="max-w-[560px]">
        <h2 className="mb-1.5 text-xl font-extrabold tracking-tight">Active Sessions</h2>
        <p className="mb-5 text-[13px] text-text-2">These are the browser sessions currently logged into your account.</p>

        {loading && <p className="py-8 text-center text-sm text-text-3">Loading sessions…</p>}

        <div>
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-3.5 border-b border-border px-[22px] py-3.5">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.current ? 'bg-primary-light' : 'bg-bg'}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="3" width="20" height="14" rx="2" stroke={s.current ? 'var(--color-primary)' : 'var(--color-text-3)'} strokeWidth="2"/>
                  <path d="M8 21H16M12 17V21" stroke={s.current ? 'var(--color-primary)' : 'var(--color-text-3)'} strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-text">
                  {s.browser ?? "Unknown"} — {s.os ?? "Unknown"}
                  {s.current && (
                    <span className="rounded-md bg-primary-light px-[7px] py-px text-[11px] font-semibold text-primary">Current</span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-text-3">{s.ip ?? "—"} · {formatLastSeen(s.lastSeenAt, s.current)}</div>
              </div>
              {!s.current && (
                <button
                  onClick={() => handleSignOut(s.id)}
                  className="rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-[5px] text-xs font-medium text-unread transition-colors hover:bg-[#FEE2E2]"
                >
                  Sign out
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
