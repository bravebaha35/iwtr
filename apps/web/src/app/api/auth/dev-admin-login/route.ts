import { NextRequest } from "next/server";
import { exchangeCredentialsForSession } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  return exchangeCredentialsForSession("auth/dev-admin-login", await req.text());
}
