"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface FolderPath {
    id: string | null;
    path: string;
    alias: string;
    is_default: boolean;
}

export default function FolderSettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [folders, setFolders] = useState<FolderPath[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        } else if (status === "authenticated") {
            fetchFolders();
        }
    }, [status, router]);

    const fetchFolders = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/folders");
            const data = await response.json();

            if (data.folders) {
                setFolders(data.folders.map((f: FolderPath) => ({
                    ...f,
                    alias: f.alias || "",
                })));
            }
        } catch (error) {
            console.error("Failed to fetch folders:", error);
            toast.error("Failed to load folders");
        } finally {
            setLoading(false);
        }
    };

    const updateAlias = (id: string | null, path: string, alias: string) => {
        setFolders(prev =>
            prev.map(f =>
                (f.id === id || (f.id === null && f.path === path))
                    ? { ...f, alias }
                    : f
            )
        );
    };

    const setAsDefault = (id: string | null, path: string) => {
        setFolders(prev =>
            prev.map(f => ({
                ...f,
                is_default: (f.id === id || (f.id === null && f.path === path)),
            }))
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch("/api/folders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folders }),
            });

            if (!response.ok) {
                throw new Error("Failed to save folders");
            }

            toast.success("Folder settings saved!");
            router.push("/");
        } catch (error) {
            console.error("Failed to save folders:", error);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const getDisplayPath = (path: string): string => {
        const parts = path.split("/").filter(Boolean);
        if (parts.length <= 2) return path;
        return `.../${parts.slice(-2).join("/")}/`;
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
                <div className="mx-auto max-w-4xl">
                    <button
                        onClick={() => router.push("/")}
                        className="text-sm text-zinc-600 dark:text-muted-foreground hover:text-zinc-900 dark:hover:text-foreground"
                    >
                        ← Back
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-4xl px-4 py-8">
                <h1 className="text-2xl font-semibold text-zinc-900 dark:text-foreground mb-2">フォルダ設定</h1>
                <p className="text-sm text-zinc-600 dark:text-muted-foreground mb-8">
                    保存先フォルダに略称を設定すると、エディタで選択しやすくなります。
                </p>

                <div className="space-y-6">
                    <div className="rounded-lg bg-white dark:bg-card p-6 shadow-sm dark:shadow-lg border border-zinc-200 dark:border-border">
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-foreground mb-4">保存先フォルダ</h2>

                        {folders.length === 0 ? (
                            <p className="text-sm text-zinc-500 dark:text-muted-foreground">
                                フォルダが見つかりません。リポジトリを接続してください。
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {/* Header */}
                                <div className="grid grid-cols-12 gap-4 text-sm font-medium text-zinc-500 dark:text-muted-foreground pb-2 border-b border-zinc-200 dark:border-border">
                                    <div className="col-span-5">パス</div>
                                    <div className="col-span-5">略称（任意）</div>
                                    <div className="col-span-2 text-center">デフォルト</div>
                                </div>

                                {/* Folder rows */}
                                {folders.map((folder) => (
                                    <div
                                        key={folder.id || folder.path}
                                        className="grid grid-cols-12 gap-4 items-center"
                                    >
                                        <div className="col-span-5">
                                            <span
                                                className="text-sm font-mono text-zinc-700 dark:text-zinc-300"
                                                title={folder.path}
                                            >
                                                {getDisplayPath(folder.path)}
                                            </span>
                                        </div>
                                        <div className="col-span-5">
                                            <input
                                                type="text"
                                                value={folder.alias}
                                                onChange={(e) => updateAlias(folder.id, folder.path, e.target.value)}
                                                placeholder="例: 市村先生共同研究"
                                                className="w-full rounded-lg border border-zinc-300 dark:border-border bg-white dark:bg-muted px-3 py-2 text-sm outline-none focus:border-violet-500 dark:focus:border-violet-400"
                                            />
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <input
                                                type="radio"
                                                name="defaultFolder"
                                                checked={folder.is_default}
                                                onChange={() => setAsDefault(folder.id, folder.path)}
                                                className="h-4 w-4 text-violet-600 focus:ring-violet-500"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-lg bg-violet-600 px-6 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                            {saving ? "Saving..." : "保存"}
                        </button>
                        <button
                            onClick={() => router.push("/")}
                            className="rounded-lg bg-zinc-100 dark:bg-muted px-6 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
