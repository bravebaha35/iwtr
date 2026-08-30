import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { NARRATIVE_MODEL, SYSTEM_PROMPT } from "./company-narrative.prompt";

/**
 * Thin wrapper around the Anthropic SDK for the one call this app makes.
 * Reads ANTHROPIC_API_KEY once at construction. When it is unset the service
 * reports `available === false` and callers skip generation entirely — the
 * feature is designed to no-op without a key (same posture as GOOGLE_CLIENT_ID
 * / IYZICO_*). Never routed through requireSecret(): this is not a security
 * secret and its absence must not block boot.
 */
@Injectable()
export class NarrativeGeneratorService {
  private readonly client: Anthropic | null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    // maxRetries: 0 — this runs on a synchronous page-view path (Task 6 awaits
    // it during SSR) with an 8s budget. The SDK default (2 retries with
    // exponential backoff, timeout applied per attempt) would stretch a
    // persistent overload to ~20-30s. A failed call just falls back to the
    // stored narrative / numbers line, so retrying here buys nothing.
    this.client = apiKey ? new Anthropic({ apiKey, maxRetries: 0 }) : null;
  }

  get available(): boolean {
    return this.client !== null;
  }

  async generate(userMessage: string): Promise<string> {
    if (!this.client) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const message = await this.client.messages.create(
      {
        model: NARRATIVE_MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      { timeout: 8000 },
    );

    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
  }
}
