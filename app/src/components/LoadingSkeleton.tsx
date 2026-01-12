export function PageLoadingSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-violet-600" />
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    </div>
  );
}

export function NoteCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg bg-white p-4 shadow-sm">
      <div className="mb-3 h-6 w-3/4 rounded bg-zinc-200" />
      <div className="mb-3 flex gap-2">
        <div className="h-6 w-16 rounded-full bg-zinc-200" />
        <div className="h-6 w-20 rounded-full bg-zinc-200" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 rounded bg-zinc-200" />
        <div className="h-4 w-24 rounded bg-zinc-200" />
      </div>
    </div>
  );
}

export function LibrarySkeleton() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="h-7 w-32 animate-pulse rounded bg-zinc-200" />
          <div className="flex gap-3">
            <div className="h-9 w-24 animate-pulse rounded-lg bg-zinc-200" />
            <div className="h-9 w-20 animate-pulse rounded-lg bg-zinc-200" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 h-10 w-full animate-pulse rounded-lg bg-zinc-200" />
        <div className="mb-6 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-zinc-200" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <NoteCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
