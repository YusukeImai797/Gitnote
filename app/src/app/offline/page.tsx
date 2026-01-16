"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      // Automatically redirect when back online
      router.push("/");
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [router]);

  const handleRetry = () => {
    if (navigator.onLine) {
      router.push("/");
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
            <span className="material-symbols-outlined text-6xl text-muted-foreground">
              cloud_off
            </span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-foreground">
          {isOnline ? "接続を確認中..." : "オフラインです"}
        </h1>

        {/* Message */}
        <p className="text-muted-foreground leading-relaxed">
          {isOnline
            ? "インターネット接続が回復しました。ページを再読み込みしています..."
            : "インターネット接続がありません。接続を確認してから、もう一度お試しください。"}
        </p>

        {/* Retry Button */}
        {!isOnline && (
          <button
            onClick={handleRetry}
            className="w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 active:scale-95 transition-all"
          >
            再試行
          </button>
        )}

        {/* Home Link */}
        <button
          onClick={() => router.push("/")}
          className="w-full px-6 py-2 rounded-xl text-muted-foreground hover:bg-subtle transition-colors"
        >
          ホームに戻る
        </button>

        {/* App Info */}
        <div className="pt-8 space-y-2">
          <p className="text-sm text-muted-foreground">
            Gitnote は PWA として動作します
          </p>
          <p className="text-xs text-muted-foreground opacity-75">
            オフライン時も一部の機能が利用可能です
          </p>
        </div>
      </div>
    </div>
  );
}
