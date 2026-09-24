import { enableRowAccess, PII_ACCESS, SALARY_ACCESS, withRowAccess } from "../row-access";

it("turns the gate on inside a transaction, scoped to that transaction (set_config is_local = true)", async () => {
  const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
  const client = { $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)) };

  const result = await withRowAccess(client as never, PII_ACCESS, async () => "done");

  expect(result).toBe("done");
  expect(client.$transaction).toHaveBeenCalledTimes(1);
  const [strings, scope] = tx.$queryRaw.mock.calls[0];
  expect(strings.join("?")).toBe("SELECT set_config(?, 'on', true)");
  // The flag name is a bound parameter, never string-built SQL.
  expect(scope).toBe("app.pii_access");
});

it("can enable the gate on an already-open transaction", async () => {
  const tx = { $queryRaw: jest.fn().mockResolvedValue([]) };
  await enableRowAccess(tx as never, SALARY_ACCESS);
  expect(tx.$queryRaw.mock.calls[0][1]).toBe("app.salary_access");
});
