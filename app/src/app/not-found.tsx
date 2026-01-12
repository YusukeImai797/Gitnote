import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="text-center">
        <h1 className="mb-2 text-6xl font-bold text-violet-600">404</h1>
        <h2 className="mb-4 text-2xl font-semibold text-zinc-800">Page Not Found</h2>
        <p className="mb-8 text-zinc-600">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-700"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
