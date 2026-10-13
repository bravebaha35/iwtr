"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PublicSocialQuestion } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { QuestionCard, QuestionSkeleton } from "./QuestionCard";

/**
 * One question on its own page (/social/questions/:id) with every answer -
 * where a copied link, a card's time link and a notification lead.
 */
export function QuestionView({ questionId }: { questionId: string }) {
  const router = useRouter();
  // undefined = still loading, null = not there (deleted, or its company hidden).
  const [question, setQuestion] = useState<PublicSocialQuestion | null | undefined>(undefined);

  useEffect(() => {
    apiGet<PublicSocialQuestion>(`/social/questions/${questionId}`)
      .then(setQuestion)
      .catch(() => setQuestion(null));
  }, [questionId]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link href="/social?tab=questions" className="self-start text-sm font-semibold text-muted-foreground transition hover:text-foreground">
        <span aria-hidden="true">&larr;</span> Questions
      </Link>

      {question === undefined && (
        <div role="status" aria-label="Loading the question">
          <QuestionSkeleton />
        </div>
      )}
      {question === null && <p className="py-6 text-sm text-muted-foreground">This question isn&apos;t available any more.</p>}
      {question && (
        <QuestionCard question={question} linkToPage={false} onChanged={setQuestion} onDeleted={() => router.push("/social?tab=questions")} />
      )}
    </div>
  );
}
