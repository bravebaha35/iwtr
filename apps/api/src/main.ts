import "dotenv/config";
import "reflect-metadata";
import { join } from "path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter";
import { transportSecurity, trustProxySetting } from "./common/http/transport-security";
import { isProductionEnv } from "./config/env";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Whose X-Forwarded-For to believe for req.ip (rate limits, the 5651
  // traffic log). apps/web passes the visitor's address in it (see
  // apps/web/src/lib/clientIp.ts); a header from anyone else is ignored.
  // Default "loopback": web and API on the same machine. Behind a host's
  // proxy, or with web on another machine, set API_TRUST_PROXY to that
  // address range or hop count (Express "trust proxy" syntax).
  app.set("trust proxy", trustProxySetting(process.env.API_TRUST_PROXY));
  app.disable("x-powered-by");
  // HSTS on every response, and HTTP -> HTTPS redirects in production (see
  // transport-security.ts).
  app.use(transportSecurity({ production: isProductionEnv() }));
  // No browser ever sends apps/api a cookie: apps/web's own httpOnly cookies
  // are scoped to its own origin and never leave it — every authenticated
  // browser call goes through its same-origin proxy (Bearer token, attached
  // server-side), and the one direct-to-API browser-adjacent call
  // (apiGetPublic) is itself a Next.js Server Component fetch, not browser
  // JS. `credentials: true` here would only ever matter if that changed, so
  // leave it off rather than widen the trust boundary for a case that never
  // happens today.
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: false });
  // Uploaded company logos (OwnerService.uploadLogo) — served outside the
  // "v1" API prefix, at the same plain-file path the upload response's URL
  // points to. Dev-safe local disk default, same pattern as iyzico/Google
  // sign-in: works fully now, needs real cloud object storage before a
  // production deploy (see project notes).
  app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads/" });
  app.setGlobalPrefix("v1");
  app.useGlobalFilters(new PrismaExceptionFilter());
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/v1`);
}

bootstrap().catch((err: unknown) => {
  // A failed start (port taken, bad config, DB unreachable at boot) must end
  // the process with an error, not leave an unhandled rejection behind.
  // eslint-disable-next-line no-console
  console.error("API failed to start", err);
  process.exit(1);
});
