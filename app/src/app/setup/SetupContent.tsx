"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const error = searchParams.get("error");

  useEffect(() => {
    if (success) {
      setTimeout(() => {
        router.push("/");
      }, 2000);
    }
  }, [success, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm text-center">
        {success && (
          <>
            <div className="text-4xl mb-4">✓</div>
            <h1 className="text-2xl font-semibold text-green-600">Repository Connected!</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Your GitHub repository has been connected successfully.
            </p>
            <p className="mt-4 text-xs text-zinc-400">
              Redirecting to home...
            </p>
          </>
        )}
        {error && (
          <>
            <div className="text-4xl mb-4">✗</div>
            <h1 className="text-2xl font-semibold text-red-600">Setup Failed</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Error: {error}
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
