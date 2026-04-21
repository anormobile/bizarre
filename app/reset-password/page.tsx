"use client";

import { useState, type FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text">Missing reset token.</p>
        <Link
          href="/forgot-password"
          className="text-center text-sm font-semibold text-primary hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text">
          Password reset. You can sign in with the new password.
        </p>
        <Link
          href="/login"
          className="text-center text-sm font-semibold text-primary hover:underline"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <label className="mb-[5px] text-xs font-semibold tracking-wide text-text-2">New password</label>
      <input
        type="password"
        placeholder="Min 8 characters"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        minLength={8}
        autoFocus
        className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(92,107,192,0.12)]"
      />

      <label className="mb-[5px] text-xs font-semibold tracking-wide text-text-2">Confirm new password</label>
      <input
        type="password"
        placeholder="Repeat password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={8}
        className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(92,107,192,0.12)]"
      />

      {error && (
        <div className="mb-3">
          <p className="text-sm text-unread">{error}</p>
          {error === "invalid or expired token" && (
            <Link
              href="/forgot-password"
              className="mt-1 block text-sm font-medium text-primary hover:underline"
            >
              Request a new reset link
            </Link>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !newPassword || !confirmPassword}
        className="w-full rounded-[10px] bg-primary px-[22px] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Resetting\u2026" : "Reset password"}
      </button>

      <div className="mt-3 text-center">
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex items-center justify-center gap-2.5">
          <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-primary shadow-[0_4px_14px_rgba(92,107,192,0.4)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="white"/>
            </svg>
          </div>
          <span className="text-[22px] font-extrabold tracking-tight text-text">Bizarre</span>
        </div>

        <div className="rounded-[18px] bg-surface px-7 py-[30px] shadow-[0_4px_32px_rgba(0,0,0,0.07),0_1px_3px_rgba(0,0,0,0.05)]">
          <h1 className="mb-1 text-[22px] font-extrabold tracking-tight">Reset password</h1>
          <p className="mb-[22px] text-sm text-text-2">Choose a new password for your account.</p>

          <Suspense fallback={<p className="text-sm text-text-2">Loading...</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
