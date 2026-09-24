// One-time (and safe to re-run) database setup for Row-Level Security.
//
// 1. Creates the `iwtr_app` login the API runs as (DATABASE_URL) — an
//    ordinary role that owns no tables, so Postgres Row-Level Security
//    applies to it. Schema changes (`prisma db push`) keep running as the
//    table owner through DIRECT_URL.
// 2. Grants it read/write on every table (now and future ones created by
//    the owner), and nothing else — it can't create, alter or drop tables.
// 3. Turns on Row-Level Security for the two most sensitive tables, each
//    gated by a transaction-local flag that only the code meant to touch
//    them sets (see src/common/db/row-access.ts):
//      pii."PiiVault"            <- app.pii_access    (PiiVaultService only)
//      public."SalarySubmission" <- app.salary_access (reviews + benchmark)
//
// Re-run after any `prisma db push` that recreates either table.
//
// Run from apps/api, with DIRECT_URL (the owner) and APP_DB_PASSWORD set:
//   pnpm exec ts-node scripts/setup-db-roles.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const APP_ROLE = "iwtr_app";

const RLS_TABLES: { table: string; policy: string; flag: string }[] = [
  { table: 'pii."PiiVault"', policy: "pii_vault_gate", flag: "app.pii_access" },
  { table: 'public."SalarySubmission"', policy: "salary_submission_gate", flag: "app.salary_access" },
];

async function main() {
  const ownerUrl = process.env.DIRECT_URL;
  const password = process.env.APP_DB_PASSWORD;
  if (!ownerUrl) throw new Error("DIRECT_URL (the table owner's connection string) is not set.");
  if (!password) throw new Error("APP_DB_PASSWORD is not set.");

  const prisma = new PrismaClient({ datasourceUrl: ownerUrl });
  await prisma.$transaction(async (tx) => {
    // The password travels as a bound parameter into a session setting,
    // then format(%L) quotes it inside the DO block — never string-built here.
    await tx.$queryRaw`SELECT set_config('iwtr.app_password', ${password}, true)`;
    await tx.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${APP_ROLE}') THEN
          EXECUTE format('CREATE ROLE ${APP_ROLE} LOGIN PASSWORD %L', current_setting('iwtr.app_password'));
        ELSE
          EXECUTE format('ALTER ROLE ${APP_ROLE} WITH LOGIN PASSWORD %L', current_setting('iwtr.app_password'));
        END IF;
      END
      $$;
    `);

    for (const schema of ["public", "pii"]) {
      await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA ${schema} TO ${APP_ROLE}`);
      await tx.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${APP_ROLE}`);
      await tx.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO ${APP_ROLE}`);
      await tx.$executeRawUnsafe(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE}`,
      );
      await tx.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT USAGE, SELECT ON SEQUENCES TO ${APP_ROLE}`);
    }

    for (const { table, policy, flag } of RLS_TABLES) {
      await tx.$executeRawUnsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await tx.$executeRawUnsafe(`DROP POLICY IF EXISTS ${policy} ON ${table}`);
      await tx.$executeRawUnsafe(
        `CREATE POLICY ${policy} ON ${table} TO ${APP_ROLE}
           USING (current_setting('${flag}', true) = 'on')
           WITH CHECK (current_setting('${flag}', true) = 'on')`,
      );
    }
  });
  await prisma.$disconnect();
  console.log(`Role ${APP_ROLE} ready; Row-Level Security on ${RLS_TABLES.map((t) => t.table).join(", ")}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
