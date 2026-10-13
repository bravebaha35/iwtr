import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server-auth";
import { SOCIAL_QUESTIONS_ENABLED } from "@/lib/socialQuestionsFlag";
import { AdSlot } from "@/components/AdSlot";
import { AnonGate } from "@/components/auth/AnonGate";
import { QuestionView } from "@/components/social/QuestionView";

export const metadata: Metadata = {
  title: "Question on IWT Social",
  description: "A question on IWT Social, answered by people who worked there.",
};

// One question's own page, behind the same register prompt as /social: a
// shared link shows a logged-out visitor that prompt, not the question.
export default async function SocialQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!SOCIAL_QUESTIONS_ENABLED) notFound();
  const { id } = await params;
  const jar = await cookies();
  const hasSessionCookie = jar.has(ACCESS_COOKIE) || jar.has(REFRESH_COOKIE);
  return (
    <AnonGate
      assumeAnonymous={!hasSessionCookie}
      title="IWT Social"
      description="Register for free to see what coworkers are asking and join the conversation."
    >
      <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
        <AdSlot />
        <div className="w-full max-w-4xl">
          <QuestionView questionId={id} />
        </div>
        <AdSlot side="right" />
      </div>
    </AnonGate>
  );
}
