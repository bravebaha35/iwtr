import { redirect } from "next/navigation";

// Private messages moved into the dock on IWT Social. Old links (bookmarks,
// notifications sent before the move: /messages?c=<conversationId>) land
// there with the same conversation opened.
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  redirect(c ? `/social?openChat=${encodeURIComponent(c)}` : "/social");
}
