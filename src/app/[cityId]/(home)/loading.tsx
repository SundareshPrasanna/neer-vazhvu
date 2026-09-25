// Scoped to the (home) group: at the [cityId] level it would stream every
// subpage, and a streamed notFound() answers 200 instead of 404.
export default function CityDashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <p className="sr-only" role="status">
        Loading dashboard
      </p>
      <div className="animate-pulse space-y-8" aria-hidden="true">
        <div className="h-6 w-40 rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-56 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-32 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
          ))}
        </div>
        <div className="h-72 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
      </div>
    </div>
  );
}
