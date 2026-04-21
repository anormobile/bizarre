"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <Button variant="outline" disabled={loading} onClick={handleLogout}>
      {loading ? "Signing out\u2026" : "Sign out"}
    </Button>
  );
}
