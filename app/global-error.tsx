"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p>{error.message}</p>
        <button
          onClick={reset}
          className="rounded-md bg-black px-4 py-2 text-white"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
