import { jobsFirstPageSize, jobsPageCount, jobsPageRange } from "../companyBrowse";

describe("Jobs page paging (4 across, 5 rows)", () => {
  it("page 1 gives up one row of 4 for every started row of featured ads", () => {
    expect(jobsFirstPageSize(0)).toBe(20);
    expect(jobsFirstPageSize(1)).toBe(16);
    expect(jobsFirstPageSize(4)).toBe(16);
    expect(jobsFirstPageSize(5)).toBe(12);
    expect(jobsFirstPageSize(8)).toBe(12);
  });

  it("later pages hold 20 and start where the one before ended", () => {
    expect(jobsPageRange(1, 8)).toEqual({ start: 0, size: 12 });
    expect(jobsPageRange(2, 8)).toEqual({ start: 12, size: 20 });
    expect(jobsPageRange(3, 8)).toEqual({ start: 32, size: 20 });
    expect(jobsPageRange(2, 0)).toEqual({ start: 20, size: 20 });
  });

  it("counts pages with the shorter first page", () => {
    expect(jobsPageCount(0, 8)).toBe(1);
    expect(jobsPageCount(12, 8)).toBe(1);
    expect(jobsPageCount(13, 8)).toBe(2);
    expect(jobsPageCount(32, 8)).toBe(2);
    expect(jobsPageCount(33, 8)).toBe(3);
    expect(jobsPageCount(40, 0)).toBe(2);
  });
});
