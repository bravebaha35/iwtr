import "dotenv/config";
import "reflect-metadata";
import { join } from "path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true });
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

bootstrap();
