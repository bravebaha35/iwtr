export interface RegionalSentiment {
  companyCount: number;
  totalReviews: number;
  // null rather than 0 when there's no review data to average — a real
  // "no data" signal an investor-facing API must not silently mask as a
  // score of zero.
  avgOverallRating: number | null;
}

/**
 * Review-count-weighted average across every company matching an
 * investor's province/district/work-type filter — a company with 50
 * reviews should move the regional number far more than one with 1, so
 * this is a weighted mean, not a flat average of each company's own
 * average. Only ever consumes CompanyAggregateScore-shaped rows (already
 * aggregate, never individual reviews or comments).
 */
export function aggregateRegionalSentiment(companies: { overallAvg: number; reviewCount: number }[]): RegionalSentiment {
  const totalReviews = companies.reduce((sum, c) => sum + c.reviewCount, 0);
  const weightedSum = companies.reduce((sum, c) => sum + c.overallAvg * c.reviewCount, 0);

  return {
    companyCount: companies.length,
    totalReviews,
    avgOverallRating: totalReviews === 0 ? null : weightedSum / totalReviews,
  };
}
