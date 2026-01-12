"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Repository {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
}

export default function ConnectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchRepos();
    }
  }, [status, router]);

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/github/repos");
      const data = await response.json();

      if (data.repos) {
        setRepos(data.repos);
      } else {
        console.error("Failed to fetch repos:", data.error);
      }
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedRepo) {
      alert("Please select a repository");
      return;
    }

    setConnecting(true);
    try {
      const repo = repos.find(r => r.fullName === selectedRepo);

      const response = await fetch("/api/repos/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoFullName: selectedRepo,
          defaultBranch: repo?.defaultBranch || "main",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to connect");
      }

      router.push("/connect/labels");
    } catch (error: any) {
      console.error("Error connecting repository:", error);
      alert(error.message || "Failed to connect repository");
    } finally {
      setConnecting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            ← Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold mb-2">Connect Repository</h1>
        <p className="text-sm text-zinc-600 mb-8">
          Select a repository to store your notes
        </p>

        {repos.length === 0 ? (
          <div className="rounded-lg bg-white p-8 shadow-sm text-center">
            <p className="text-zinc-600 mb-4">
              No repositories found. Make sure the GitHub App has access to at least one repository.
            </p>
            <a
              href="https://github.com/settings/installations/103674231"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline"
            >
              Configure GitHub App
            </a>
          </div>
        ) : (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="mb-6">
              <label className="mb-2 block text-sm font-medium">
                Repository
              </label>
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-4 py-2 outline-none focus:border-violet-500"
              >
                <option value="">Select a repository...</option>
                {repos.map((repo) => (
                  <option key={repo.id} value={repo.fullName}>
                    {repo.fullName} {repo.private ? "(Private)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleConnect}
              disabled={connecting || !selectedRepo}
              className="rounded-lg bg-violet-600 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {connecting ? "Connecting..." : "Connect Repository"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
