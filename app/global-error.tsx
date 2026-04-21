"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F2F3F8", color: "#1C1D2E" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem" }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, color: "#5C6BC0", margin: 0 }}>Bizarre</h1>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Something went wrong</h2>
          <p style={{ color: "#6B7280", margin: 0 }}>A critical error occurred. Please try again.</p>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              onClick={reset}
              style={{ padding: "0.625rem 1.25rem", borderRadius: "0.5rem", background: "#5C6BC0", color: "#fff", border: "none", fontWeight: 500, fontSize: "0.875rem", cursor: "pointer" }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{ padding: "0.625rem 1.25rem", borderRadius: "0.5rem", background: "transparent", color: "#1C1D2E", border: "1px solid #E4E6EF", fontWeight: 500, fontSize: "0.875rem", textDecoration: "none", cursor: "pointer" }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
