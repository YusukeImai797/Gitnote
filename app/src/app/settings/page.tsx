"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";

interface RepoConnection {
  connected: boolean;
  repoConnection: {
    provider: string;
    repoFullName: string;
    defaultBranch: string;
    basePath: string;
  } | null;
}

interface Label {
  id: string;
  tag_name: string;
  target_path: string;
  color: string;
  description: string;
  is_default: boolean;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [repoStatus, setRepoStatus] = useState<RepoConnection | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [formData, setFormData] = useState({
    repoFullName: "",
    defaultBranch: "main",
    basePath: "notes",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchRepoStatus();
    }
  }, [status, router]);

  const fetchRepoStatus = async () => {
    setLoading(true);
    try {
      const [repoRes, labelsRes] = await Promise.all([
        fetch("/api/repos/current"),
        fetch("/api/labels"),
      ]);

      const repoData = await repoRes.json();
      const labelsData = await labelsRes.json();

      setRepoStatus(repoData);
      setLabels(labelsData.labels || []);

      if (repoData.connected && repoData.repoConnection) {
        setFormData({
          repoFullName: repoData.repoConnection.repoFullName,
          defaultBranch: repoData.repoConnection.defaultBranch,
          basePath: repoData.repoConnection.basePath,
        });
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncLabels = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/labels/sync", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to sync labels");
      }

      toast.success("Labels synced successfully!");
      fetchRepoStatus();
    } catch (error) {
      console.error("Error syncing labels:", error);
      toast.error("Failed to sync labels");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!confirm("Are you sure you want to delete this label? Notes with this label will not be affected.")) {
      return;
    }

    try {
      const response = await fetch(`/api/labels/${labelId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete label");
      }

      toast.success("Label deleted successfully!");
      fetchRepoStatus();
    } catch (error) {
      console.error("Error deleting label:", error);
      toast.error("Failed to delete label");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/repos/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(`Failed to update: ${error.error}`);
        return;
      }

      toast.success("Repository settings updated successfully!");
      fetchRepoStatus();
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReconnect = () => {
    window.location.href = "/api/github/app/install";
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-background">
      <header className="border-b border-zinc-200 dark:border-border bg-white dark:bg-card px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-xl font-semibold">Settings</h1>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg border border-zinc-200 dark:border-border px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-muted"
          >
            Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <section className="mb-8 rounded-lg bg-white dark:bg-card p-6 shadow-sm dark:shadow-lg border border-transparent dark:border-border">
          <h2 className="mb-4 text-lg font-semibold">Account</h2>
          <div className="mb-4 rounded-lg border border-zinc-200 dark:border-border bg-zinc-50 dark:bg-muted p-4">
            <div className="text-sm text-zinc-600 dark:text-muted-foreground">
              Signed in as: <span className="font-medium">{session?.user?.email}</span>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Sign Out
          </button>
        </section>

        <section className="mb-8 rounded-lg bg-white dark:bg-card p-6 shadow-sm dark:shadow-lg border border-transparent dark:border-border">
          <h2 className="mb-4 text-lg font-semibold">Repository Connection</h2>

          {!repoStatus?.connected ? (
            <div>
              <p className="mb-4 text-sm text-zinc-600 dark:text-muted-foreground">
                No repository connected. Connect a GitHub repository to start syncing your notes.
              </p>
              <button
                onClick={handleReconnect}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Connect Repository
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave}>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Repository (owner/repo)
                </label>
                <input
                  type="text"
                  value={formData.repoFullName}
                  onChange={(e) =>
                    setFormData({ ...formData, repoFullName: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-300 dark:border-border bg-transparent px-4 py-2 text-sm outline-none focus:border-violet-500 dark:focus:border-violet-400"
                  placeholder="username/repository"
                  required
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Example: johndoe/my-notes
                </p>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Default Branch
                </label>
                <input
                  type="text"
                  value={formData.defaultBranch}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultBranch: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm outline-none focus:border-violet-500"
                  placeholder="main"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Base Path
                </label>
                <input
                  type="text"
                  value={formData.basePath}
                  onChange={(e) =>
                    setFormData({ ...formData, basePath: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm outline-none focus:border-violet-500"
                  placeholder="notes"
                  required
                />
                <p className="mt-1 text-xs text-zinc-500">
                  The folder where notes will be saved (e.g., "notes" or "docs")
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={handleReconnect}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100"
                >
                  Reconnect GitHub App
                </button>
              </div>
            </form>
          )}
        </section>

        {repoStatus?.connected && (
          <section className="mb-8 rounded-lg bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Label Management</h2>
              <button
                onClick={handleSyncLabels}
                disabled={syncing}
                className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
              >
                {syncing ? "Syncing..." : "Sync from GitHub"}
              </button>
            </div>

            <p className="mb-4 text-sm text-zinc-600">
              Manage your labels and their save paths. Labels are synced with GitHub Issues Labels.
            </p>

            {labels.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
                <p className="text-sm text-zinc-500">No labels configured yet.</p>
                <button
                  onClick={() => router.push("/connect/labels")}
                  className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Import Labels
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {labels.map((label) => (
                  <div
                    key={label.id}
                    className="flex items-center gap-4 rounded-lg border border-zinc-200 p-4"
                  >
                    <span
                      className="h-4 w-4 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{label.tag_name}</span>
                        {label.is_default && (
                          <span className="rounded-full bg-zinc-100 dark:bg-muted px-2 py-0.5 text-xs text-zinc-600 dark:text-muted-foreground">
                            Default
                          </span>
                        )}
                      </div>
                      {label.description && (
                        <p className="mt-1 text-sm text-zinc-500 dark:text-muted-foreground">{label.description}</p>
                      )}
                    </div>
                    {!label.is_default && (
                      <button
                        onClick={() => handleDeleteLabel(label.id)}
                        className="flex-shrink-0 rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => router.push("/connect/labels")}
                className="rounded-lg border border-zinc-300 dark:border-border px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-muted"
              >
                Manage Labels
              </button>
              <button
                onClick={() => router.push("/connect/folders")}
                className="rounded-lg border border-zinc-300 dark:border-border px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-muted"
              >
                Configure Folders
              </button>
            </div>
          </section>
        )}

        <section className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Google Drive Sync</h2>
          <p className="mb-4 text-sm text-zinc-600">
            Google Drive synchronization is coming soon.
          </p>
          <button
            disabled
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-400"
          >
            Coming Soon
          </button>
        </section>
      </main>
    </div>
  );
}
