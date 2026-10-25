-- A company whose published reviews were all removed kept a score row of
-- zeros, shown as "0.0 Unsatisfactory". Such a row means "no score" and is
-- now deleted by ReviewsService.recomputeAggregate; this removes the old ones.
DELETE FROM "public"."CompanyAggregateScore" WHERE "reviewCount" = 0;
