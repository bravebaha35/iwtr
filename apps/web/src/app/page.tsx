import { cookies } from "next/headers";
import { HomeClient } from "@/components/HomeClient";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server-auth";

// The homepage routes on auth state (see HomeClient). Whether a session
// cookie exists at all is known here on the server, which lets a logged-out
// visitor's register prompt be part of the server-rendered page.
export default async function Home() {
  const jar = await cookies();
  return <HomeClient hasSessionCookie={jar.has(ACCESS_COOKIE) || jar.has(REFRESH_COOKIE)} />;
}
