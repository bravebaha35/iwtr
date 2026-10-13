import { CanActivate, Injectable, NotFoundException } from "@nestjs/common";

// Questions put member-written public text on the site, so the Terms have to
// cover it before launch. One switch: SOCIAL_QUESTIONS_ENABLED=true|false.
// Left unset it is on everywhere except production, so the feature can be
// built and tried locally and stays dark on the live site until it is turned
// on there on purpose. apps/web has the matching switch
// (NEXT_PUBLIC_SOCIAL_QUESTIONS_ENABLED, lib/socialQuestionsFlag.ts).
export function socialQuestionsEnabled(): boolean {
  const raw = process.env.SOCIAL_QUESTIONS_ENABLED;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return process.env.NODE_ENV !== "production";
}

// While the switch is off every Questions route answers 404, as if it did
// not exist.
@Injectable()
export class SocialQuestionsEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!socialQuestionsEnabled()) throw new NotFoundException();
    return true;
  }
}
