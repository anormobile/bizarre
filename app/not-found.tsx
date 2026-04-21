import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-text">
      <h1 className="text-6xl font-extrabold text-primary">404</h1>
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="text-text-2">The page you're looking for doesn't exist or was moved.</p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-hover"
      >
        Go home
      </Link>
    </div>
  );
}
