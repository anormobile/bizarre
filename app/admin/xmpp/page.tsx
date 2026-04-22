"use client";

import { useEffect, useState, useCallback } from "react";
import type { JabberConnection } from "@/lib/types";

type State =
  | { status: "loading" }
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "ok"; connections: JabberConnection[] };

export default function AdminXmppPage() {
  const [state, setState] = useState<State>({ status: "loading" });

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/xmpp/stats");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (res.status === 403) {
        setState({ status: "forbidden" });
        return;
      }
      if (!res.ok) {
        setState({ status: "error" });
        return;
      }
      const data = await res.json();
      setState({ status: "ok", connections: data.connections ?? [] });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 5000);
    return () => clearInterval(id);
  }, [fetchStats]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (state.status === "forbidden") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-500">Admin only</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-500">Unable to reach Jabber server.</p>
      </div>
    );
  }

  const { connections } = state;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Jabber Connections</h1>
      {connections.length === 0 ? (
        <p className="text-zinc-400">No active Jabber connections.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-700">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-700 bg-zinc-800 text-zinc-300">
              <tr>
                <th className="px-4 py-3 font-medium">User (JID)</th>
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Remote IP</th>
                <th className="px-4 py-3 font-medium">Connected since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {connections.map((c) => (
                <tr key={`${c.jid}-${c.since}`} className="hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-mono text-sm">{c.jid}</td>
                  <td className="px-4 py-3">{c.domain}</td>
                  <td className="px-4 py-3 font-mono text-sm">{c.remoteIp}</td>
                  <td className="px-4 py-3">
                    {new Date(c.since).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
