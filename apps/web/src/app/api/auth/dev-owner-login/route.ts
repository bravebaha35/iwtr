import { NextRequest } from "next/server";
import { exchangeCredentialsForSession } from "@/lib/server-auth";
import { forwardedForHeaders } from "@/lib/clientIp";

export async function POST(req: NextRequest) {
  return exchangeCredentialsForSession("auth/dev-owner-login", await req.text(), forwardedForHeaders(req.headers));
}
