import { z } from "zod";
export declare const BANNER_SOURCE_MAX_FILE_SIZE_BYTES: number;
export declare const BANNER_SOURCE_MIN_DIMENSION_PX = 400;
export declare const BANNER_SOURCE_MAX_DIMENSION_PX = 8000;
export interface BannerSourceFileMeta {
    mimeType: string;
    sizeBytes: number;
    width: number;
    height: number;
}
export declare function validateBannerSourceFile(meta: BannerSourceFileMeta): {
    valid: true;
} | {
    valid: false;
    error: string;
};
export declare const bannerUploadResultSchema: z.ZodObject<{
    url: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    url: string;
}, {
    url: string;
}>;
export type BannerUploadResult = z.infer<typeof bannerUploadResultSchema>;
