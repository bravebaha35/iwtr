import { aggregateRegionalSentiment } from "../regional-sentiment.util";

describe("aggregateRegionalSentiment", () => {
  it("weights the average by each company's review count, not a flat per-company average", () => {
    const companies = [
      { overallAvg: 5, reviewCount: 1 },
      { overallAvg: 1, reviewCount: 9 },
    ];

    const result = aggregateRegionalSentiment(companies);

    // Flat average would be 3.0; weighted by review count should be much
    // closer to the 9-review company's 1.0.
    expect(result.avgOverallRating).toBeCloseTo(1.4, 5);
    expect(result.companyCount).toBe(2);
    expect(result.totalReviews).toBe(10);
  });

  it("excludes companies with zero reviews from the weighted average entirely", () => {
    const companies = [
      { overallAvg: 0, reviewCount: 0 },
      { overallAvg: 4, reviewCount: 10 },
    ];

    const result = aggregateRegionalSentiment(companies);

    expect(result.avgOverallRating).toBe(4);
    // Still counted as a company that exists in the region, just not
    // contributing to the rating average.
    expect(result.companyCount).toBe(2);
  });

  it("returns null rating and zero counts for an empty region, never NaN", () => {
    const result = aggregateRegionalSentiment([]);

    expect(result.avgOverallRating).toBeNull();
    expect(result.companyCount).toBe(0);
    expect(result.totalReviews).toBe(0);
  });

  it("returns null rating when every matching company has zero reviews", () => {
    const result = aggregateRegionalSentiment([
      { overallAvg: 0, reviewCount: 0 },
      { overallAvg: 0, reviewCount: 0 },
    ]);

    expect(result.avgOverallRating).toBeNull();
    expect(result.companyCount).toBe(2);
    expect(result.totalReviews).toBe(0);
  });
});
