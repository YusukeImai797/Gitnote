"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string;
}

export default function ConnectLabelsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [labels, setLabels] = useState<GitHubLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLabels, setSelectedLabels] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchLabels();
    }
  }, [status, router]);

  const fetchLabels = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/labels/github");
      const data = await response.json();

      if (data.labels) {
        setLabels(data.labels);
        // Pre-select all labels by default
        setSelectedLabels(new Set(data.labels.map((l: GitHubLabel) => l.id)));
      } else {
        console.error("Failed to fetch labels:", data.error);
      }
    } catch (error) {
      console.error("Failed to fetch labels:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLabel = (id: number) => {
    setSelectedLabels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const response = await fetch("/api/labels/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labelIds: Array.from(selectedLabels),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import labels");
      }

      router.push("/connect/mapping");
    } catch (error: any) {
      console.error("Failed to import labels:", error);
      alert(error.message || "Failed to import labels");
    } finally {
      setImporting(false);
    }
  };

  const handleSkip = () => {
    router.push("/");
  };

  const selectAll = () => {
    setSelectedLabels(new Set(labels.map(l => l.id)));
  };

  const deselectAll = () => {
    setSelectedLabels(new Set());
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
            onClick={() => router.push("/connect")}
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            ← Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold mb-2">Import Labels</h1>
        <p className="text-sm text-zinc-600 mb-8">
          Select labels from your GitHub repository to import
        </p>

        {labels.length === 0 ? (
          <div className="rounded-lg bg-white p-8 shadow-sm text-center">
            <p className="text-zinc-600 mb-4">
              No labels found in the repository. You can skip this step and create labels later.
            </p>
            <button
              onClick={handleSkip}
              className="rounded-lg bg-zinc-600 px-6 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            >
              Skip
            </button>
          </div>
        ) : (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="mb-4 flex gap-2">
              <button
                onClick={selectAll}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
              >
                Deselect All
              </button>
            </div>

            <div className="mb-6 space-y-2">
              {labels.map((label) => (
                <label
                  key={label.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedLabels.has(label.id)}
                    onChange={() => toggleLabel(label.id)}
                    className="w-4 h-4 text-violet-600 rounded"
                  />
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: `#${label.color}` }}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{label.name}</div>
                    {label.description && (
                      <div className="text-sm text-zinc-500">{label.description}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={importing || selectedLabels.size === 0}
                className="rounded-lg bg-violet-600 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {importing ? "Importing..." : `Import Selected (${selectedLabels.size})`}
              </button>
              <button
                onClick={handleSkip}
                className="rounded-lg bg-zinc-100 px-6 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
