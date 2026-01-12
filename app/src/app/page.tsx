"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

interface RepoConnection {
  connected: boolean;
  repoConnection: {
    provider: string;
    repoFullName: string;
    defaultBranch: string;
    basePath: string;
  } | null;
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAuthed = status === "authenticated";
  const [repoStatus, setRepoStatus] = useState<RepoConnection | null>(null);

  useEffect(() => {
    if (isAuthed) {
      fetchRepoStatus();
    }
  }, [isAuthed]);

  const fetchRepoStatus = async () => {
    try {
      const res = await fetch("/api/repos/current");
      const data = await res.json();
      setRepoStatus(data);
    } catch (error) {
      console.error("Failed to fetch repo status:", error);
    }
  };

  const handleConnectRepo = () => {
    router.push("/connect");
  };

  const handleGoToEditor = () => {
    router.push("/editor");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-background font-sans text-zinc-900 dark:text-foreground">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      <main className="w-full max-w-xl rounded-2xl bg-white dark:bg-card p-8 shadow-sm dark:shadow-lg border border-transparent dark:border-border">
        <h1 className="text-2xl font-semibold">Gitnote</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-muted-foreground">
          Stress-free Markdown editor synced to Git.
        </p>

        <div className="mt-6 rounded-lg border border-zinc-100 dark:border-border bg-zinc-50 dark:bg-muted p-4 text-sm">
          <div className="font-medium">Authentication Status</div>
          <div className="mt-1 text-zinc-600 dark:text-muted-foreground">
            {status === "loading" && "Loading session..."}
            {status === "unauthenticated" && "Signed out"}
            {isAuthed && `Signed in as ${session.user?.email ?? "GitHub user"}`}
          </div>
        </div>

        {isAuthed && (
          <div className="mt-4 rounded-lg border border-zinc-100 dark:border-border bg-zinc-50 dark:bg-muted p-4 text-sm">
            <div className="font-medium">Repository Connection</div>
            <div className="mt-1 text-zinc-600 dark:text-muted-foreground">
              {!repoStatus && "Checking..."}
              {repoStatus && !repoStatus.connected && "Not connected"}
              {repoStatus?.connected && repoStatus.repoConnection && (
                <div>
                  <div>Connected to: <span className="font-mono">{repoStatus.repoConnection.repoFullName}</span></div>
                  <div className="mt-1 text-xs">
                    Branch: {repoStatus.repoConnection.defaultBranch} | Path: {repoStatus.repoConnection.basePath}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {!isAuthed && (
            <button
              className="rounded-lg bg-black dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-black hover:bg-zinc-800 dark:hover:bg-zinc-200"
              onClick={() => signIn("github")}
            >
              Continue with GitHub
            </button>
          )}
          {isAuthed && !repoStatus?.connected && (
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={handleConnectRepo}
            >
              Connect Repository
            </button>
          )}
          {isAuthed && repoStatus?.connected && (
            <>
              <button
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                onClick={handleGoToEditor}
              >
                Open Editor
              </button>
              <button
                className="rounded-lg border border-zinc-200 dark:border-border px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-muted"
                onClick={() => router.push("/library")}
              >
                Library
              </button>
            </>
          )}
          {isAuthed && (
            <>
              <button
                className="rounded-lg border border-zinc-200 dark:border-border px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-muted"
                onClick={() => router.push("/settings")}
              >
                Settings
              </button>
              <button
                className="rounded-lg border border-zinc-200 dark:border-border px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-muted"
                onClick={() => signOut()}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

