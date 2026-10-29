import { jobSalaryInputSchema, normalizePerks, searchPerks } from "@iwtr/shared-types";
import { salaryColumns, sameSalary, sectorAverage, toJobSalary } from "../job-salary.util";

describe("job salary helpers", () => {
  it("reads a posting made before salaries existed as no salary", () => {
    expect(toJobSalary({ salaryAmount: null, salaryCurrency: null, salaryAtInterview: false })).toBeNull();
    expect(toJobSalary({})).toBeNull();
  });

  it("keeps the currency the owner picked, never converting it", () => {
    expect(toJobSalary({ salaryAmount: 2500, salaryCurrency: "USD", salaryAtInterview: false })).toEqual({
      amount: 2500,
      currency: "USD",
      atInterview: false,
    });
  });

  it("stores 'shared at the interview' without an amount", () => {
    expect(salaryColumns({ atInterview: true, amount: 40000, currency: "TRY" })).toEqual({
      salaryAmount: null,
      salaryCurrency: null,
      salaryAtInterview: true,
    });
    expect(toJobSalary({ salaryAtInterview: true })).toEqual({ amount: null, currency: null, atInterview: true });
  });

  it("tells a changed salary from the same one", () => {
    const stored = { salaryAmount: 40000, salaryCurrency: "TRY" as const, salaryAtInterview: false };
    expect(sameSalary(salaryColumns({ atInterview: false, amount: 40000, currency: "TRY" }), stored)).toBe(true);
    expect(sameSalary(salaryColumns({ atInterview: false, amount: 40000, currency: "EUR" }), stored)).toBe(false);
  });

  it("refuses an amount without a currency unless the interview tick is on", () => {
    expect(jobSalaryInputSchema.safeParse({ atInterview: false, amount: 30000 }).success).toBe(false);
    expect(jobSalaryInputSchema.safeParse({ atInterview: false }).success).toBe(false);
    expect(jobSalaryInputSchema.safeParse({ atInterview: true }).success).toBe(true);
    expect(jobSalaryInputSchema.safeParse({ atInterview: false, amount: 30000, currency: "TRY" }).success).toBe(true);
    expect(jobSalaryInputSchema.safeParse({ atInterview: false, amount: 1.5, currency: "TRY" }).success).toBe(false);
  });
});

describe("sectorAverage", () => {
  it("shows nothing until three different companies have posted a salary", () => {
    const rows = [
      { companyId: "a", salaryAmount: 30000 },
      { companyId: "a", salaryAmount: 32000 },
      { companyId: "b", salaryAmount: 40000 },
    ];
    expect(sectorAverage(rows)).toEqual({ averageMonthlyTry: null, postingCount: 3 });
  });

  it("counts each company once, so one company's many ads can't pull the figure", () => {
    const rows = [
      { companyId: "a", salaryAmount: 30000 },
      { companyId: "a", salaryAmount: 30000 },
      { companyId: "a", salaryAmount: 30000 },
      { companyId: "b", salaryAmount: 40000 },
      { companyId: "c", salaryAmount: 50000 },
    ];
    expect(sectorAverage(rows)).toEqual({ averageMonthlyTry: 40000, postingCount: 5 });
  });
});

describe("perks catalogue", () => {
  it("suggests Yemek Kartı for 'yem' and Meal card for 'meal'", () => {
    expect(searchPerks("yem")[0].key).toBe("MEAL_CARD");
    expect(searchPerks("meal").map((p) => p.key)).toContain("MEAL_CARD");
  });

  it("finds Turkish names typed without Turkish letters", () => {
    expect(searchPerks("is kiyafeti").map((p) => p.key)).toContain("WORK_CLOTHES");
    expect(searchPerks("ozel saglik").map((p) => p.key)).toContain("PRIVATE_HEALTH_INSURANCE");
  });

  it("leaves out perks already picked", () => {
    expect(searchPerks("yem", ["MEAL_CARD"]).map((p) => p.key)).not.toContain("MEAL_CARD");
  });

  it("drops unknown keys and keeps catalogue order", () => {
    expect(normalizePerks(["GYM", "NOT_A_PERK", "MEAL_CARD"])).toEqual(["MEAL_CARD", "GYM"]);
  });
});
