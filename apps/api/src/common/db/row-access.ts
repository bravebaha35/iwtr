import type { Prisma } from "@prisma/client";

/**
 * Database-level (Postgres Row-Level Security) gates on the two most
 * sensitive tables — see prisma/sql/row-level-security.sql:
 *
 *   pii."PiiVault"             readable/writable only with app.pii_access = 'on'
 *   public."SalarySubmission"  readable/writable only with app.salary_access = 'on'
 *
 * The API connects as a non-owner role (iwtr_app), so without the flag
 * every query on those tables simply sees zero rows and every write is
 * refused — even a stray query from the wrong module, or an injected one.
 * The flag is set with `set_config(..., true)`, i.e. LOCAL to the current
 * transaction, so it can never leak onto another request sharing the same
 * pooled connection.
 */
export type RowAccessScope = "app.pii_access" | "app.salary_access";

export const PII_ACCESS: RowAccessScope = "app.pii_access";
export const SALARY_ACCESS: RowAccessScope = "app.salary_access";

type TxClient = Prisma.TransactionClient;
type ClientWithTransactions = {
  $transaction<R>(fn: (tx: TxClient) => Promise<R>, options?: { timeout?: number }): Promise<R>;
};

/** Turns the gate on for the rest of an already-open transaction. */
export async function enableRowAccess(tx: TxClient, scope: RowAccessScope): Promise<void> {
  await tx.$queryRaw`SELECT set_config(${scope}, 'on', true)`;
}

/** Runs `fn` in a new transaction with the gate on. */
export function withRowAccess<R>(
  client: ClientWithTransactions,
  scope: RowAccessScope,
  fn: (tx: TxClient) => Promise<R>,
): Promise<R> {
  return client.$transaction(async (tx) => {
    await enableRowAccess(tx, scope);
    return fn(tx);
  });
}
