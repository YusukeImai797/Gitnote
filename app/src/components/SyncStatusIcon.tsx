import type { SyncStatus } from "@/types";

interface SyncStatusIconProps {
  status: SyncStatus;
  className?: string;
}

export function SyncStatusIcon({ status, className = "h-4 w-4" }: SyncStatusIconProps) {
  switch (status) {
    case "syncing":
      return (
        <svg className={`${className} animate-sync-rotate text-violet-500`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      );
    case "synced":
      return (
        <svg className={`${className} animate-sync-success text-green-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case "conflict":
      return (
        <svg className={`${className} animate-sync-error text-red-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case "error":
      return (
        <svg className={`${className} animate-sync-error text-red-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    default:
      return null;
  }
}

interface SyncStatusDisplayProps {
  status: SyncStatus;
  lastSaved?: Date | null;
}

export function SyncStatusDisplay({ status, lastSaved }: SyncStatusDisplayProps) {
  const statusText: Record<SyncStatus, string> = {
    syncing: "Syncing...",
    synced: "Synced",
    conflict: "Conflict",
    error: "Error",
    idle: "Drafting"
  };

  const statusColors: Record<SyncStatus, string> = {
    syncing: "text-violet-500 dark:text-violet-400",
    synced: "text-green-600 dark:text-green-400",
    conflict: "text-red-600 dark:text-red-400",
    error: "text-red-600 dark:text-red-400",
    idle: "text-muted-foreground"
  };

  return (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest">
      <SyncStatusIcon status={status} />
      <span className={`transition-colors ${statusColors[status]} ${status === "syncing" ? "animate-pulse" : ""}`}>
        {statusText[status]}
      </span>
      {status === "synced" && lastSaved && (
        <span className="text-muted-foreground text-[10px] normal-case">
          · {formatTimeAgo(lastSaved)}
        </span>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);

  if (diffSecs < 10) return "just now";
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
