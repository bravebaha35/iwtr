import { NextRequest } from "next/server";
import { exchangeLoginForSession } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  return exchangeLoginForSession(await req.text());
}
