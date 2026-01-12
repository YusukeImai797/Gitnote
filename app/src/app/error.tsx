"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="text-center">
        <h1 className="mb-2 text-6xl font-bold text-red-600">500</h1>
        <h2 className="mb-4 text-2xl font-semibold text-zinc-800">Something went wrong</h2>
        <p className="mb-2 text-zinc-600">
          An unexpected error occurred. Please try again.
        </p>
        {error.message && (
          <p className="mb-8 text-sm text-zinc-500">
            Error: {error.message}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-block rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-700"
          >
            Try Again
          </button>
          <a
            href="/"
            className="inline-block rounded-lg border border-zinc-300 bg-white px-6 py-3 font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
