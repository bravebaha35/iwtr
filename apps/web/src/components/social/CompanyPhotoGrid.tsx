"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { SocialFeedPage } from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";

interface Photo {
  postId: string;
  url: string;
  alt: string;
}

function photosOf(page: SocialFeedPage): Photo[] {
  return page.posts.flatMap((post) =>
    post.imageUrls.map((url) => ({ postId: post.id, url, alt: post.caption ?? `${post.companyName} photo` })),
  );
}

/**
 * The company Social tab's Photos view: every photo from the company's
 * posts as a grid, newest post first. A photo opens its post's page. Reads
 * the same per-company feed the Posts view does, a page of posts at a time.
 */
export function CompanyPhotoGrid({ slug }: { slug: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (from: string | null) => {
      setLoading(true);
      setError(null);
      apiGet<SocialFeedPage>(`/social/companies/${slug}/posts${from ? `?cursor=${from}` : ""}`)
        .then((page) => {
          setPhotos((prev) => (from ? [...prev, ...photosOf(page)] : photosOf(page)));
          setCursor(page.nextCursor);
        })
        .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load the photos."))
        .finally(() => setLoading(false));
    },
    [slug],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the first fetch
    load(null);
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      {!loading && !error && photos.length === 0 && <p className="py-6 text-sm text-muted-foreground">No photos yet.</p>}

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-1.5">
          {photos.map((photo) => (
            <li key={photo.url}>
              <Link href={`/social/posts/${photo.postId}`} className="block overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads */}
                <img
                  src={photo.url}
                  alt={photo.alt}
                  loading="lazy"
                  className="aspect-square w-full bg-surface-muted object-cover transition duration-200 hover:scale-[1.03]"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {loading && <p className="text-center text-sm text-muted-foreground">Loading...</p>}
      {!loading && cursor && (
        <button
          type="button"
          onClick={() => load(cursor)}
          className="self-center text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          Show more photos
        </button>
      )}
    </div>
  );
}
