// The shape of the Home and Jobs card grids while the first page is on the
// way: banner, logo, name, two lines, footer - in the same grid as the real
// cards, so nothing jumps when they arrive. Shown instead of a "Loading..."
// line; it costs no request of its own.
export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  const bar = "rounded-full bg-surface-muted";
  return (
    <div
      role="status"
      aria-label="Loading"
      className="grid grid-cols-1 gap-5 compact:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden="true" className="animate-pulse overflow-hidden rounded-xl bg-surface shadow-xs motion-reduce:animate-none">
          <div className="h-16 w-full bg-surface-muted" />
          <div className="-mt-6 ml-4 h-12 w-12 rounded-[0.6rem] border-4 border-surface bg-surface-muted" />
          <div className="flex flex-col gap-2.5 px-4 pb-4 pt-3">
            <div className={`h-4 w-3/4 ${bar}`} />
            <div className={`h-3 w-1/2 ${bar}`} />
            <div className={`mt-3 h-3 w-11/12 ${bar}`} />
            <div className={`h-3 w-2/3 ${bar}`} />
            <div className={`mt-4 h-3 w-1/3 ${bar}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
