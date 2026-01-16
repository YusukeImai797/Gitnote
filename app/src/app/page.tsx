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

  // Loading state
  if (status === "loading") {
    return (
      <main className="min-h-screen bg-background bg-paper flex items-center justify-center p-6">
        <div className="animate-fade-in">
          <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center animate-float">
            <span className="material-symbols-outlined text-[24px] text-primary">edit_note</span>
          </div>
        </div>
      </main>
    );
  }

  // Unauthenticated - Show login screen
  if (!isAuthed) {
    return (
      <main className="min-h-screen bg-background bg-paper flex items-center justify-center p-6">
        <div className="fixed top-4 right-4 z-10">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md text-center">
          {/* Logo & Title */}
          <div className="mb-8 animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[40px] text-primary">edit_note</span>
            </div>
            <h1
              className="text-4xl md:text-5xl font-bold mb-3 text-foreground"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Gitnote
            </h1>
            <p
              className="text-lg text-muted-foreground"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Write beautifully. Sync effortlessly.
            </p>
          </div>

          {/* Feature List */}
          <div className="mb-10 space-y-3 text-left animate-fade-in stagger-2" style={{ opacity: 0, animationDelay: '0.1s', animationFillMode: 'forwards' }}>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
              <span style={{ fontFamily: 'var(--font-body)' }}>Markdown editor with Git sync</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
              <span style={{ fontFamily: 'var(--font-body)' }}>Works offline, syncs when ready</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
              <span style={{ fontFamily: 'var(--font-body)' }}>Your notes, your repository</span>
            </div>
          </div>

          {/* Login Button */}
          <div className="animate-fade-in" style={{ opacity: 0, animationDelay: '0.2s', animationFillMode: 'forwards' }}>
            <button
              onClick={() => signIn("github")}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-foreground text-background font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all active:scale-[0.98] btn-press"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Continue with GitHub
            </button>
          </div>

          {/* Footer */}
          <p
            className="mt-8 text-sm text-muted-foreground animate-fade-in"
            style={{ opacity: 0, animationDelay: '0.3s', animationFillMode: 'forwards', fontFamily: 'var(--font-body)' }}
          >
            Your notes are stored in your own GitHub repository
          </p>
        </div>
      </main>
    );
  }

  // Authenticated - Show dashboard
  return (
    <main className="min-h-screen bg-background bg-paper flex items-center justify-center p-6">
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-primary">edit_note</span>
          </div>
          <h1
            className="text-3xl font-bold mb-2 text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Welcome back
          </h1>
          <p className="text-muted-foreground" style={{ fontFamily: 'var(--font-body)' }}>
            {session?.user?.email ?? "GitHub user"}
          </p>
        </div>

        {/* Repository Status Card */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-primary">folder</span>
            <span className="font-semibold text-foreground">Repository</span>
          </div>
          <div className="text-muted-foreground" style={{ fontFamily: 'var(--font-body)' }}>
            {!repoStatus && (
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined animate-sync-rotate text-[18px]">sync</span>
                <span>Checking connection...</span>
              </div>
            )}
            {repoStatus && !repoStatus.connected && (
              <span>No repository connected</span>
            )}
            {repoStatus?.connected && repoStatus.repoConnection && (
              <div>
                <div className="font-mono text-foreground text-sm mb-1">
                  {repoStatus.repoConnection.repoFullName}
                </div>
                <div className="text-xs text-muted-foreground">
                  Branch: {repoStatus.repoConnection.defaultBranch} | Path: {repoStatus.repoConnection.basePath}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {!repoStatus?.connected && (
            <button
              onClick={handleConnectRepo}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg shadow-md hover:shadow-lg hover:scale-[1.01] transition-all active:scale-[0.99] btn-press"
            >
              <span className="material-symbols-outlined">link</span>
              Connect Repository
            </button>
          )}

          {repoStatus?.connected && (
            <>
              <button
                onClick={handleGoToEditor}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-foreground text-background font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all active:scale-[0.99] btn-press"
              >
                <span className="material-symbols-outlined">edit</span>
                Open Editor
              </button>

              <button
                onClick={() => router.push("/library")}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-card border border-border text-foreground font-medium hover:bg-muted transition-all active:scale-[0.99] btn-press"
              >
                <span className="material-symbols-outlined text-[20px]">library_books</span>
                Browse Library
              </button>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => router.push("/settings")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-muted text-muted-foreground font-medium hover:bg-border hover:text-foreground transition-all active:scale-[0.98] btn-press"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
              Settings
            </button>

            <button
              onClick={() => signOut()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-muted text-muted-foreground font-medium hover:bg-error/10 hover:text-error transition-all active:scale-[0.98] btn-press"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
