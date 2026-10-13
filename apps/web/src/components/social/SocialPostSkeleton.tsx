// The shape of a post card while its data is on the way: logo, two lines of
// header, the photo block, the action row. Shown instead of a "Loading..."
// line so the page keeps its layout and nothing jumps when the posts arrive.
export function SocialPostSkeleton({ withPhoto = true }: { withPhoto?: boolean }) {
  const bar = "rounded-full bg-surface-muted";
  return (
    <div aria-hidden="true" className="animate-pulse rounded-2xl bg-surface shadow-xs motion-reduce:animate-none">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-9 w-9 rounded-[0.5rem] bg-surface-muted" />
        <div className="flex flex-1 flex-col gap-2">
          <div className={`h-3 w-40 ${bar}`} />
          <div className={`h-2.5 w-24 ${bar}`} />
        </div>
      </div>
      {withPhoto && <div className="aspect-[4/3] w-full bg-surface-muted" />}
      <div className="flex flex-col gap-2 px-4 pt-3">
        <div className={`h-3 w-11/12 ${bar}`} />
        <div className={`h-3 w-2/3 ${bar}`} />
      </div>
      <div className="flex items-center gap-5 px-4 py-3.5">
        <div className={`h-5 w-10 ${bar}`} />
        <div className={`h-5 w-10 ${bar}`} />
        <div className={`ml-auto h-5 w-5 ${bar}`} />
      </div>
    </div>
  );
}

export function SocialFeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading posts" className="flex flex-col gap-5">
      {Array.from({ length: count }, (_, i) => (
        <SocialPostSkeleton key={i} withPhoto={i !== 1} />
      ))}
    </div>
  );
}
