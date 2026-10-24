export function SnapshotSkeleton() {
  return (
    <div role="status" aria-label="Loading snapshot" className="animate-pulse space-y-4">
      <div className="h-40 rounded-xl bg-zinc-200 dark:bg-zinc-900" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-900" />)}
      </div>
      <div className="h-56 rounded-xl bg-zinc-200 dark:bg-zinc-900" />
    </div>
  );
}

export function ErrorState({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/40">
      <p className="text-base font-semibold text-rose-700 dark:text-rose-300">{title}</p>
      {detail && <p className="mt-1 text-sm text-rose-600/80 dark:text-rose-300/70">{detail}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-4 rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-800">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</p>
      {detail && <p className="mt-1 text-sm text-zinc-500">{detail}</p>}
    </div>
  );
}
