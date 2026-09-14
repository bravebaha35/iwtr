import { z } from "zod";
export declare const LOGO_RECOMMENDED_DIMENSION_PX = 400;
export declare const LOGO_MIN_DIMENSION_PX = 268;
export declare const LOGO_MAX_FILE_SIZE_BYTES: number;
export interface LogoFileMeta {
    mimeType: string;
    sizeBytes: number;
    width: number;
    height: number;
}
export declare function validateLogoFile(meta: LogoFileMeta): {
    valid: true;
} | {
    valid: false;
    error: string;
};
export declare function validateSourceImageForCrop(meta: LogoFileMeta): {
    valid: true;
} | {
    valid: false;
    error: string;
};
export declare const logoUploadResultSchema: z.ZodObject<{
    url: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    url: string;
}, {
    url: string;
}>;
export type LogoUploadResult = z.infer<typeof logoUploadResultSchema>;
