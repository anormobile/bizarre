"use client";

import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-text">
      <h1 className="text-5xl font-extrabold text-primary">Oops</h1>
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-text-2">An unexpected error occurred. Please try again.</p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text transition hover:bg-surface"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
