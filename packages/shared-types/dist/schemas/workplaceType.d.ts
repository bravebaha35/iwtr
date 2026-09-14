import { z } from "zod";
export declare const workplaceTypeSchema: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
export type WorkplaceType = z.infer<typeof workplaceTypeSchema>;
export declare const companyWorkplaceTypesSchema: z.ZodArray<z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>, "many">;
export declare function primaryWorkplaceType(company: {
    workplaceTypes: WorkplaceType[];
}): WorkplaceType;
export declare function secondaryWorkplaceType(company: {
    workplaceTypes: WorkplaceType[];
}): WorkplaceType | null;
export declare const DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE: Record<WorkplaceType, string>;
export declare function defaultBannerUrlForWorkplaceType(primary: WorkplaceType): string;
