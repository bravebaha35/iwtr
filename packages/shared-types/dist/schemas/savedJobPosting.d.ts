import { z } from "zod";
export declare const savedJobPostingToggleResultSchema: z.ZodObject<{
    jobPostingId: z.ZodString;
    saved: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    jobPostingId: string;
    saved: boolean;
}, {
    jobPostingId: string;
    saved: boolean;
}>;
export type SavedJobPostingToggleResult = z.infer<typeof savedJobPostingToggleResultSchema>;
export declare const savedJobPostingSchema: z.ZodObject<{
    id: z.ZodString;
    companyId: z.ZodString;
    jobTitle: z.ZodString;
    description: z.ZodString;
    expired: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    companyId: string;
    jobTitle: string;
    description: string;
    expired: boolean;
}, {
    id: string;
    companyId: string;
    jobTitle: string;
    description: string;
    expired: boolean;
}>;
export type SavedJobPosting = z.infer<typeof savedJobPostingSchema>;
