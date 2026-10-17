import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server-auth";
import { AdSlot } from "@/components/AdSlot";
import { AnonGate } from "@/components/auth/AnonGate";
import { SocialPostView } from "@/components/social/SocialPostView";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return {
    title: t("Post on IWT Social"),
    description: t("A company post on IWT Social, with anonymous comments from people who worked there."),
  };
}

// One post's own page, behind the same register prompt as /social: a shared
// link shows a logged-out visitor that prompt, not the post.
export default async function SocialPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jar = await cookies();
  const hasSessionCookie = jar.has(ACCESS_COOKIE) || jar.has(REFRESH_COOKIE);
  return (
    <AnonGate
      assumeAnonymous={!hasSessionCookie}
      title="IWT Social"
      description="Register for free to see what coworkers are posting and join the conversation."
    >
      <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
        <AdSlot />
        <div className="w-full max-w-4xl">
          <SocialPostView postId={id} />
        </div>
        <AdSlot side="right" />
      </div>
    </AnonGate>
  );
}
