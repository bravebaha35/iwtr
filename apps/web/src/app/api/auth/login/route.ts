import { NextRequest } from "next/server";
import { exchangeLoginForSession } from "@/lib/server-auth";
import { forwardedForHeaders } from "@/lib/clientIp";

export async function POST(req: NextRequest) {
  return exchangeLoginForSession(await req.text(), forwardedForHeaders(req.headers));
}
