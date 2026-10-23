import { NextRequest } from "next/server";
import { exchangeCredentialsForSession } from "@/lib/server-auth";
import { forwardedForHeaders } from "@/lib/clientIp";

// A company's shared login: same httpOnly-cookie session as any other login,
// limited by the API to that one company's dashboard.
export async function POST(req: NextRequest) {
  return exchangeCredentialsForSession("auth/company-login", await req.text(), forwardedForHeaders(req.headers));
}
