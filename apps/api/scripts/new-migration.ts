// Turns a change in prisma/schema.prisma into a migration file and applies it
// to the local database. Replaces `prisma db push` for schema changes.
//
// Why not `prisma migrate dev`: it refuses to run without an interactive
// terminal, which is how schema changes are made in this repo. This does the
// same job in steps that need no prompt:
//   1. checks the local database has every existing migration and nothing else
//      (so the new file only holds the new change);
//   2. writes the SQL that takes the database to the schema into
//      prisma/migrations/<timestamp>_<name>/migration.sql;
//   3. applies it (`prisma migrate deploy`), regenerates the Prisma client and
//      re-runs setup-db-roles.ts (grants + Row-Level Security).
//
// Run from apps/api (stop the API dev server first on Windows, or step 3's
// client regeneration fails with EPERM):
//   pnpm db:migration add_job_salary_range
//
// Read the generated SQL before committing it: renaming a column, for
// example, comes out as "drop + add", which loses that column's data - edit
// the file into a RENAME before it reaches a database with real data.

import "dotenv/config";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const PRISMA_CLI = require.resolve("prisma/build/index.js");
const SCHEMA = "prisma/schema.prisma";

function prisma(args: string[], opts: { capture?: boolean; allowFail?: boolean } = {}): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [PRISMA_CLI, ...args], {
      encoding: "utf8",
      stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    return { code: 0, out: out ?? "" };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    if (!opts.allowFail) {
      if (e.stderr) process.stderr.write(e.stderr);
      throw new Error(`prisma ${args[0]} ${args[1] ?? ""} failed`);
    }
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

function main() {
  const name = (process.argv[2] ?? "").trim();
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error('Give the migration a short name in lower_snake_case, e.g. "pnpm db:migration add_job_salary_range".');
  }
  const ownerUrl = process.env.DIRECT_URL;
  if (!ownerUrl) throw new Error("DIRECT_URL (the table owner's connection string) is not set.");

  // 1. The local database must be exactly "all migrations so far".
  const status = prisma(["migrate", "status", "--schema", SCHEMA], { capture: true, allowFail: true });
  if (status.code !== 0) {
    process.stderr.write(status.out);
    throw new Error("The local database is not in step with prisma/migrations (see above). Fix that first.");
  }

  // 2. What it takes to get from the database to the schema.
  const diff = prisma(["migrate", "diff", "--from-url", ownerUrl, "--to-schema-datamodel", SCHEMA, "--script"], {
    capture: true,
  }).out;
  if (diff.includes("This is an empty migration")) {
    console.log("No schema changes - nothing to do.");
    return;
  }

  const dir = join("prisma", "migrations", `${timestamp()}_${name}`);
  if (existsSync(dir)) throw new Error(`${dir} already exists.`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "migration.sql"), diff, "utf8");
  console.log(`Wrote ${join(dir, "migration.sql")}`);

  // 3. Apply it here, refresh the client, put grants and RLS back.
  prisma(["migrate", "deploy", "--schema", SCHEMA]);
  prisma(["generate", "--schema", SCHEMA]);
  execFileSync(process.execPath, [require.resolve("ts-node/dist/bin.js"), join("scripts", "setup-db-roles.ts")], {
    stdio: "inherit",
  });
  console.log("Done. Read the SQL file above before committing it.");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
