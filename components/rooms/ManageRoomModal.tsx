"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/Avatar";
import type { RoomSummary, RoomMemberView, RoomBanView } from "@/lib/types";

type Tab = "members" | "admins" | "banned" | "invite" | "settings";

interface ManageRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: RoomSummary;
  members: RoomMemberView[];
  currentUserId: string;
  onRoomUpdated?: (room: Partial<RoomSummary>) => void;
  onRoomDeleted?: () => void;
  onMembersRefresh?: () => void;
}

export function ManageRoomModal({
  open,
  onOpenChange,
  room,
  members,
  currentUserId,
  onRoomUpdated,
  onRoomDeleted,
  onMembersRefresh,
}: ManageRoomModalProps) {
  const [tab, setTab] = useState<Tab>("members");
  const viewerRole = members.find((m) => m.userId === currentUserId)?.role ?? null;
  const isOwnerOrAdmin = viewerRole === "owner" || viewerRole === "admin";

  const visibleTabs: Tab[] = isOwnerOrAdmin
    ? ["members", "admins", "banned", "invite", "settings"]
    : ["members", "invite", "settings"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Manage #{room.name}</DialogTitle>
        </DialogHeader>
        <div className="flex overflow-hidden rounded-lg border border-border">
          {visibleTabs.map((t, i) => (
            <button
              key={t}
              className={`flex-1 py-2.5 text-[13px] font-medium capitalize transition-colors ${
                i !== 0 ? "border-l border-border" : ""
              } ${tab === t ? "bg-primary-light text-primary" : "text-text-2 hover:bg-bg"}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "members" && (
          <MembersTab members={members} currentUserId={currentUserId} roomId={room.id} viewerRole={viewerRole} />
        )}
        {tab === "admins" && isOwnerOrAdmin && (
          <AdminsTab members={members} currentUserId={currentUserId} roomId={room.id} viewerRole={viewerRole} onMembersRefresh={onMembersRefresh} />
        )}
        {tab === "banned" && isOwnerOrAdmin && (
          <BannedTab roomId={room.id} />
        )}
        {tab === "invite" && (
          <InviteTab roomId={room.id} />
        )}
        {tab === "settings" && isOwnerOrAdmin && (
          <SettingsTab room={room} onRoomUpdated={onRoomUpdated} onRoomDeleted={onRoomDeleted} onClose={() => onOpenChange(false)} />
        )}
        {tab === "settings" && !isOwnerOrAdmin && (
          <p className="py-6 text-center text-sm text-text-3">Only the owner or admins can change settings.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MembersTab({
  members,
  currentUserId,
  roomId,
  viewerRole,
}: {
  members: RoomMemberView[];
  currentUserId: string;
  roomId: number;
  viewerRole: string | null;
}) {
  const [banningId, setBanningId] = useState<string | null>(null);

  function canBan(m: RoomMemberView) {
    if (m.userId === currentUserId) return false;
    if (viewerRole === "owner") return true;
    if (viewerRole === "admin" && m.role === "member") return true;
    return false;
  }

  async function handleBan(userId: string) {
    setBanningId(userId);
    try {
      await fetch(`/api/rooms/${roomId}/members/${userId}`, { method: "DELETE" });
    } catch { /* ignore */ }
    setBanningId(null);
  }

  const roleBadge = (role: string) => {
    if (role === "owner") return <span className="rounded bg-primary-light px-[5px] py-px text-[9px] font-bold text-primary">OWNER</span>;
    if (role === "admin") return <span className="rounded bg-[#FCE4EC] px-[5px] py-px text-[9px] font-bold text-[#EC407A]">ADMIN</span>;
    if (role === "pending") return <span className="rounded bg-border px-[5px] py-px text-[9px] font-bold text-text-3">PENDING</span>;
    return null;
  };

  return (
    <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
      {members.map((m) => (
        <div key={m.userId} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <Avatar username={m.username} size={28} />
          <span className="flex-1 truncate text-sm font-medium text-text">{m.username}</span>
          {roleBadge(m.role)}
          {m.role !== "pending" && canBan(m) && (
            <button
              onClick={() => handleBan(m.userId)}
              disabled={banningId === m.userId}
              className="hidden rounded bg-[#FEF2F2] px-2 py-0.5 text-[10px] font-medium text-unread group-hover:inline-flex disabled:opacity-50"
            >
              {banningId === m.userId ? "\u2026" : "Ban"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminsTab({
  members,
  currentUserId,
  roomId,
  viewerRole,
  onMembersRefresh,
}: {
  members: RoomMemberView[];
  currentUserId: string;
  roomId: number;
  viewerRole: string | null;
  onMembersRefresh?: () => void;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const admins = members.filter((m) => m.role === "owner" || m.role === "admin");
  const plainMembers = members.filter((m) => m.role === "member");

  const roleBadge = (role: string) => {
    if (role === "owner") return <span className="rounded bg-primary-light px-[5px] py-px text-[9px] font-bold text-primary">OWNER</span>;
    if (role === "admin") return <span className="rounded bg-[#FCE4EC] px-[5px] py-px text-[9px] font-bold text-[#EC407A]">ADMIN</span>;
    return null;
  };

  async function handleRoleChange(userId: string, newRole: "admin" | "member") {
    setLoadingId(userId);
    setErrorId(null);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        onMembersRefresh?.();
      } else {
        const data = await res.json().catch(() => ({ error: "failed" }));
        setErrorId(userId);
        setErrorMsg(data.error ?? "failed");
      }
    } catch {
      setErrorId(userId);
      setErrorMsg("network error");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-text-2">Admins</p>
        <div className="flex flex-col gap-1">
          {admins.map((m) => (
            <div key={m.userId} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5">
              <Avatar username={m.username} size={28} />
              <span className="flex-1 truncate text-sm font-medium text-text">{m.username}</span>
              {roleBadge(m.role)}
              {viewerRole === "owner" && m.role === "admin" && (
                <button
                  onClick={() => handleRoleChange(m.userId, "member")}
                  disabled={loadingId === m.userId}
                  className="hidden rounded bg-[#FEF2F2] px-2 py-0.5 text-[10px] font-medium text-unread group-hover:inline-flex disabled:opacity-50"
                >
                  {loadingId === m.userId ? "\u2026" : "Remove admin"}
                </button>
              )}
              {errorId === m.userId && <span className="text-[10px] text-unread">{errorMsg}</span>}
            </div>
          ))}
        </div>
      </div>

      {((viewerRole === "owner") || (viewerRole === "admin")) && plainMembers.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-text-2">Promote member</p>
          <div className="flex flex-col gap-1">
            {plainMembers.map((m) => (
              <div key={m.userId} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <Avatar username={m.username} size={28} />
                <span className="flex-1 truncate text-sm font-medium text-text">{m.username}</span>
                <button
                  onClick={() => handleRoleChange(m.userId, "admin")}
                  disabled={loadingId === m.userId}
                  className="hidden rounded bg-primary-light px-2 py-0.5 text-[10px] font-medium text-primary group-hover:inline-flex disabled:opacity-50"
                >
                  {loadingId === m.userId ? "\u2026" : "Make admin"}
                </button>
                {errorId === m.userId && <span className="text-[10px] text-unread">{errorMsg}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BannedTab({ roomId }: { roomId: number }) {
  const [bans, setBans] = useState<RoomBanView[]>([]);
  const [loading, setLoading] = useState(true);
  const [unbanningId, setUnbanningId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/rooms/${roomId}/bans`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.bans) setBans(data.bans);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roomId]);

  async function handleUnban(userId: string) {
    setUnbanningId(userId);
    setErrorId(null);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/bans/${userId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setBans((prev) => prev.filter((b) => b.userId !== userId));
      } else {
        const data = await res.json().catch(() => ({ error: "failed" }));
        setErrorId(userId);
        setErrorMsg(data.error ?? "failed");
      }
    } catch {
      setErrorId(userId);
      setErrorMsg("network error");
    } finally {
      setUnbanningId(null);
    }
  }

  if (loading) {
    return <p className="py-6 text-center text-sm text-text-3">Loading…</p>;
  }

  if (bans.length === 0) {
    return <p className="py-6 text-center text-sm text-text-3">No banned users.</p>;
  }

  return (
    <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
      {bans.map((b) => (
        <div key={b.userId} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <Avatar username={b.username} size={28} />
          <div className="flex flex-1 flex-col truncate">
            <span className="text-sm font-medium text-text">{b.username}</span>
            <span className="text-[10px] text-text-3">
              {b.bannedByUsername ? `Banned by ${b.bannedByUsername}` : "Banned"} · {new Date(b.bannedAt).toLocaleString()}
            </span>
          </div>
          <button
            onClick={() => handleUnban(b.userId)}
            disabled={unbanningId === b.userId}
            className="hidden rounded bg-primary-light px-2 py-0.5 text-[10px] font-medium text-primary group-hover:inline-flex disabled:opacity-50"
          >
            {unbanningId === b.userId ? "\u2026" : "Unban"}
          </button>
          {errorId === b.userId && <span className="text-[10px] text-unread">{errorMsg}</span>}
        </div>
      ))}
    </div>
  );
}

function InviteTab({ roomId }: { roomId: number }) {
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/rooms/${roomId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (res.ok || res.status === 201) {
        setSuccess(`Invited ${username}`);
        setUsername("");
      } else {
        const data = await res.json().catch(() => ({ error: "failed" }));
        setError(data.error ?? "failed");
      }
    } catch {
      setError("network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleInvite} className="flex flex-col gap-3">
      <div>
        <label className="mb-[5px] block text-xs font-semibold text-text-2">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username to invite…"
          autoFocus
          required
          className="w-full rounded-[9px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
        />
      </div>
      {error && <p className="text-xs text-unread">{error}</p>}
      {success && <p className="text-xs font-semibold text-online">{success}</p>}
      <button
        type="submit"
        disabled={sending || !username.trim()}
        className="w-full rounded-[10px] bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending ? "Inviting\u2026" : "Send Invitation"}
      </button>
    </form>
  );
}

function SettingsTab({
  room,
  onRoomUpdated,
  onRoomDeleted,
  onClose,
}: {
  room: RoomSummary;
  onRoomUpdated?: (room: Partial<RoomSummary>) => void;
  onRoomDeleted?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? "");
  const [visibility, setVisibility] = useState(room.visibility);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(room.name);
    setDescription(room.description ?? "");
    setVisibility(room.visibility);
  }, [room]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null, visibility }),
      });
      if (res.ok) {
        onRoomUpdated?.({ name, description: description || null, visibility });
      } else {
        const data = await res.json().catch(() => ({ error: "failed" }));
        setError(data.error ?? "failed");
      }
    } catch {
      setError("network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this room? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      if (res.ok) {
        onRoomDeleted?.();
        onClose();
      } else {
        setError("failed to delete");
      }
    } catch {
      setError("network error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-3.5">
      <div>
        <label className="mb-[5px] block text-xs font-semibold text-text-2">Room name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={3}
          maxLength={48}
          className="w-full rounded-[9px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-[5px] block text-xs font-semibold text-text-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={256}
          className="w-full resize-none rounded-[9px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold text-text-2">Visibility</label>
        <div className="flex gap-2.5">
          {([
            { v: "public" as const, icon: "🌐", desc: "Anyone can join" },
            { v: "private" as const, icon: "🔒", desc: "Invite only" },
          ]).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setVisibility(opt.v)}
              className={`flex-1 rounded-[10px] border-[1.5px] px-3 py-2.5 text-left transition-all ${
                visibility === opt.v ? "border-primary bg-primary-light" : "border-border hover:border-text-3"
              }`}
            >
              <div className={`text-[13px] font-semibold ${visibility === opt.v ? "text-primary" : "text-text"}`}>
                {opt.icon} {opt.v.charAt(0).toUpperCase() + opt.v.slice(1)}
              </div>
              <div className="mt-px text-xs text-text-3">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-xs text-unread">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-[10px] bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        {saving ? "Saving\u2026" : "Save changes"}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="w-full rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] py-2.5 text-sm font-semibold text-unread transition-colors hover:bg-[#FEE2E2] disabled:opacity-50"
      >
        {deleting ? "Deleting\u2026" : "Delete room"}
      </button>
    </form>
  );
}
