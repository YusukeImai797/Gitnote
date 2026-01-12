"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface TagMapping {
  id: string;
  tag_name: string;
  target_path: string;
  color: string;
  description: string;
}

function findBestPathMatch(labelName: string, availablePaths: string[]): string {
  const labelLower = labelName.toLowerCase();

  // Try exact match first
  for (const path of availablePaths) {
    if (path.toLowerCase().includes(labelLower)) {
      return path;
    }
  }

  // Try partial match
  const labelParts = labelLower.split(/[_\-\s]+/);
  for (const path of availablePaths) {
    const pathLower = path.toLowerCase();
    for (const part of labelParts) {
      if (part.length > 2 && pathLower.includes(part)) {
        return path;
      }
    }
  }

  // Default fallback
  return `notes/${labelName}/`;
}

export default function ConnectMappingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mappings, setMappings] = useState<TagMapping[]>([]);
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);
  const [defaultPath, setDefaultPath] = useState<string>("notes/");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchMappings();
    }
  }, [status, router]);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      // Fetch both labels and available paths in parallel
      const [labelsRes, pathsRes] = await Promise.all([
        fetch("/api/labels"),
        fetch("/api/repos/scan-paths"),
      ]);

      const labelsData = await labelsRes.json();
      const pathsData = await pathsRes.json();

      if (pathsData.paths) {
        setAvailablePaths(pathsData.paths);
      }

      if (labelsData.labels) {
        // Auto-assign best matching paths
        const mappingsWithPaths = labelsData.labels.map((label: TagMapping) => {
          // If path is already set to a meaningful value, keep it
          if (label.target_path && !label.target_path.startsWith('notes/')) {
            return label;
          }

          // Otherwise, find best match
          const bestPath = findBestPathMatch(label.tag_name, pathsData.paths || []);
          return { ...label, target_path: bestPath };
        });

        setMappings(mappingsWithPaths);
      } else {
        console.error("Failed to fetch mappings:", labelsData.error);
      }
    } catch (error) {
      console.error("Failed to fetch mappings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePath = (id: string, newPath: string) => {
    setMappings(prev =>
      prev.map(m => (m.id === id ? { ...m, target_path: newPath } : m))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save both label mappings and default path
      const [mappingsRes, defaultRes] = await Promise.all([
        fetch("/api/labels/update-paths", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mappings }),
        }),
        fetch("/api/labels/default", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultPath }),
        }),
      ]);

      if (!mappingsRes.ok) {
        const error = await mappingsRes.json();
        throw new Error(error.error || "Failed to save mappings");
      }

      if (!defaultRes.ok) {
        const error = await defaultRes.json();
        throw new Error(error.error || "Failed to save default path");
      }

      router.push("/");
    } catch (error: any) {
      console.error("Failed to save mappings:", error);
      alert(error.message || "Failed to save mappings");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.push("/");
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (mappings.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <header className="border-b border-zinc-200 bg-white px-4 py-3">
          <div className="mx-auto max-w-4xl">
            <button
              onClick={() => router.push("/connect/labels")}
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              ← Back
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8">
          <h1 className="text-2xl font-semibold mb-2">Path Mapping</h1>
          <p className="text-sm text-zinc-600 mb-8">
            No labels imported. Please go back and import labels first.
          </p>
          <button
            onClick={() => router.push("/connect/labels")}
            className="rounded-lg bg-violet-600 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Import Labels
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <button
            onClick={() => router.push("/connect/labels")}
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            ← Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold mb-2">Configure Label Paths</h1>
        <p className="text-sm text-zinc-600 mb-8">
          Set the folder path where notes with each label will be saved
        </p>

        <div className="space-y-6">
          {/* Default path for unlabeled notes */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Default Path</h2>
            <p className="text-sm text-zinc-600 mb-4">
              Where should notes without labels be saved?
            </p>
            <select
              value={defaultPath}
              onChange={(e) => setDefaultPath(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-violet-500 bg-white"
            >
              {availablePaths.map(path => (
                <option key={path} value={path}>{path}</option>
              ))}
              <option value="notes/">notes/ (Default)</option>
              <option value="inbox/">inbox/</option>
              <option value="drafts/">drafts/</option>
            </select>
          </div>

          {/* Label mappings */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Label Paths</h2>
            <div className="mb-6 space-y-4">
            {mappings.map((mapping) => (
              <div
                key={mapping.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-zinc-200"
              >
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: mapping.color }}
                />
                <div className="flex-1">
                  <div className="font-medium mb-1">{mapping.tag_name}</div>
                  {mapping.description && (
                    <div className="text-sm text-zinc-500 mb-2">
                      {mapping.description}
                    </div>
                  )}
                  <div className="relative">
                    <select
                      value={mapping.target_path}
                      onChange={(e) => updatePath(mapping.id, e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-violet-500 bg-white"
                    >
                      <option value={mapping.target_path}>{mapping.target_path}</option>
                      {availablePaths
                        .filter(p => p !== mapping.target_path)
                        .map(path => (
                          <option key={path} value={path}>{path}</option>
                        ))}
                      <option value={`notes/${mapping.tag_name}/`}>
                        notes/{mapping.tag_name}/ (Default)
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-violet-600 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Confirm"}
            </button>
            <button
              onClick={handleSkip}
              className="rounded-lg bg-zinc-100 px-6 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
            >
              Skip (Use Defaults)
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
