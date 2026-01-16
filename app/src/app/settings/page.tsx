"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";
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
      <div className="flex min-h-screen items-center justify-center bg-background bg-paper">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-paper">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-4">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Settings
          </h1>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
          >
            Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-6 pb-24 animate-fade-in">
        {/* Account Section */}
        <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Account
          </h2>
          <div className="mb-4 rounded-xl border border-border bg-muted/50 p-4">
            <div className="text-sm text-muted-foreground">
              Signed in as: <span className="font-medium text-foreground">{session?.user?.email}</span>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="px-4 py-2 rounded-xl bg-error/10 text-error font-semibold hover:bg-error/20 transition-colors"
          >
            Sign out
          </button>
        </section>

        {/* Appearance Section */}
        <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Appearance
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Toggle dark or light mode</p>
            </div>
            <ThemeToggle />
          </div>
        </section>

        {/* Repository Section */}
        <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Repository
          </h2>

          {!repoStatus?.connected ? (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">
                No repository connected. Connect a GitHub repository to start syncing your notes.
              </p>
              <button
                onClick={handleReconnect}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
              >
                Connect Repository
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Repository (owner/repo)
                </label>
                <input
                  type="text"
                  value={formData.repoFullName}
                  onChange={(e) =>
                    setFormData({ ...formData, repoFullName: e.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="username/repository"
                  required
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Example: johndoe/my-notes
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Default Branch
                </label>
                <input
                  type="text"
                  value={formData.defaultBranch}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultBranch: e.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="main"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Base Path
                </label>
                <input
                  type="text"
                  value={formData.basePath}
                  onChange={(e) =>
                    setFormData({ ...formData, basePath: e.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="notes"
                  required
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  The folder where notes will be saved (e.g., "notes" or "docs")
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={handleReconnect}
                  className="px-4 py-2 rounded-xl border border-border font-semibold hover:bg-muted transition-colors"
                >
                  Reconnect GitHub App
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Label Management Section */}
        {repoStatus?.connected && (
          <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Labels
              </h2>
              <button
                onClick={handleSyncLabels}
                disabled={syncing}
                className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 disabled:opacity-50 transition-colors"
              >
                {syncing ? "Syncing..." : "Sync from GitHub"}
              </button>
            </div>

            <p className="mb-4 text-sm text-muted-foreground">
              Manage your labels and their save paths. Labels are synced with GitHub Issues Labels.
            </p>

            {labels.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/50 p-8 text-center">
                <p className="text-sm text-muted-foreground mb-4">No labels configured yet.</p>
                <button
                  onClick={() => router.push("/connect/labels")}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
                >
                  Import Labels
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {labels.map((label) => (
                  <div
                    key={label.id}
                    className="flex items-center gap-4 rounded-xl border border-border bg-background p-4"
                  >
                    <span
                      className="h-4 w-4 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{label.tag_name}</span>
                        {label.is_default && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            Default
                          </span>
                        )}
                      </div>
                      {label.description && (
                        <p className="mt-1 text-sm text-muted-foreground truncate">{label.description}</p>
                      )}
                    </div>
                    {!label.is_default && (
                      <button
                        onClick={() => handleDeleteLabel(label.id)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-error/10 text-error text-sm font-semibold hover:bg-error/20 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={() => router.push("/connect/labels")}
                className="px-4 py-2 rounded-xl border border-border font-semibold hover:bg-muted transition-colors"
              >
                Manage Labels
              </button>
            </div>
          </section>
        )}

        {/* Folders Section */}
        {repoStatus?.connected && (
          <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Folders
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Configure folder paths and aliases for organizing your notes.
            </p>
            <button
              onClick={() => router.push("/connect/folders")}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all active:scale-[0.98]"
            >
              Configure Folders
            </button>
          </section>
        )}

        {/* Google Drive Section */}
        <section className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Google Drive
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Google Drive synchronization is coming soon.
          </p>
          <button
            disabled
            className="px-4 py-2 rounded-xl border border-border text-muted-foreground font-semibold cursor-not-allowed opacity-50"
          >
            Coming Soon
          </button>
        </section>
      </main>
    </div>
  );
}
