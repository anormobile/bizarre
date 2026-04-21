"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fd.get("email") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setSubmitted(true);
      if (data.resetUrl) setResetUrl(data.resetUrl);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="mb-1 text-[22px] font-extrabold tracking-tight">Forgot password</h1>
          <p className="mb-[22px] text-sm text-text-2">
            Enter your email to receive a password reset link.
          </p>

          {submitted ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text">
                If the account exists, a reset link has been generated. In development, see the server log or the response payload.
              </p>
              {resetUrl && (
                <a
                  href={resetUrl}
                  className="break-all text-sm font-medium text-primary hover:underline"
                >
                  {resetUrl}
                </a>
              )}
              <Link
                href="/login"
                className="mt-2 text-center text-sm font-semibold text-primary hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col">
              <label className="mb-[5px] text-xs font-semibold tracking-wide text-text-2">Email</label>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoFocus
                className="mb-3.5 w-full rounded-[10px] border-[1.5px] border-border bg-surface px-[13px] py-2.5 text-sm text-text outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(92,107,192,0.12)]"
              />

              {error && <p className="mb-3 text-sm text-unread">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-[10px] bg-primary px-[22px] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Sending\u2026" : "Send reset link"}
              </button>

              <div className="mt-3 text-center">
                <Link href="/login" className="text-sm font-medium text-primary hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
