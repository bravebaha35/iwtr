"use client";

import { useEffect, useState } from "react";
import type { TrendingToday as TrendingTodayData } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { SocialPostCard } from "./SocialPostCard";

// Fetched once on mount - a lightweight teaser above the regular
// chronological feed, not paginated, not refetched on scroll. Renders
// nothing at all if neither list has anything today (e.g. very early in
// the day) rather than an empty "Trending" heading with nothing under it.
export function TrendingToday() {
  const [data, setData] = useState<TrendingTodayData | null>(null);

  useEffect(() => {
    apiGet<TrendingTodayData>("/social/trending")
      .then(setData)
      .catch(() => setData({ mostLiked: [], mostCommented: [] }));
  }, []);

  if (!data || (data.mostLiked.length === 0 && data.mostCommented.length === 0)) return null;

  return (
    <div className="mb-6 flex flex-col gap-6">
      {data.mostLiked.length > 0 && (
        <div>
          <h2 className="mb-3 font-grotesk text-sm font-bold uppercase tracking-wide text-foreground">
            Most Liked Today
          </h2>
          <div className="flex flex-col gap-4">
            {data.mostLiked.map((post) => (
              <SocialPostCard
                key={post.id}
                post={post}
                onChanged={(p) =>
                  setData((prev) =>
                    prev ? { ...prev, mostLiked: prev.mostLiked.map((x) => (x.id === p.id ? p : x)) } : prev,
                  )
                }
              />
            ))}
          </div>
        </div>
      )}
      {data.mostCommented.length > 0 && (
        <div>
          <h2 className="mb-3 font-grotesk text-sm font-bold uppercase tracking-wide text-foreground">
            Most Commented Today
          </h2>
          <div className="flex flex-col gap-4">
            {data.mostCommented.map((post) => (
              <SocialPostCard
                key={post.id}
                post={post}
                onChanged={(p) =>
                  setData((prev) =>
                    prev ? { ...prev, mostCommented: prev.mostCommented.map((x) => (x.id === p.id ? p : x)) } : prev,
                  )
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
