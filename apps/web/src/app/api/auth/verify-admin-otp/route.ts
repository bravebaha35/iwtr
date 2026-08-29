import { NextRequest } from "next/server";
import { exchangeCredentialsForSession } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  return exchangeCredentialsForSession("auth/login/verify-otp", await req.text());
}
