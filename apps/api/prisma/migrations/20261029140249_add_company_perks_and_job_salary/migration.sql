-- CreateEnum
CREATE TYPE "public"."SalaryCurrency" AS ENUM ('TRY', 'USD', 'EUR');

-- AlterTable
ALTER TABLE "public"."Company" ADD COLUMN     "perks" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "public"."JobPosting" ADD COLUMN     "salaryAmount" INTEGER,
ADD COLUMN     "salaryAtInterview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salaryCurrency" "public"."SalaryCurrency";

