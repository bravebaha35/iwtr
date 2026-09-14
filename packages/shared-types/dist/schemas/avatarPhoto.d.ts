import { z } from "zod";
export declare const AVATAR_RECOMMENDED_DIMENSION_PX = 800;
export declare const AVATAR_MIN_DIMENSION_PX = 400;
export declare const AVATAR_MAX_SOURCE_FILE_SIZE_BYTES: number;
export declare const AVATAR_MAX_UPLOAD_FILE_SIZE_BYTES: number;
export interface AvatarFileMeta {
    mimeType: string;
    sizeBytes: number;
    width: number;
    height: number;
}
export declare function validateSourceImageForAvatarCrop(meta: AvatarFileMeta): {
    valid: true;
} | {
    valid: false;
    error: string;
};
export declare function validateAvatarPhotoFile(meta: AvatarFileMeta): {
    valid: true;
} | {
    valid: false;
    error: string;
};
export declare const avatarPhotoUploadResultSchema: z.ZodObject<{
    url: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    url: string;
}, {
    url: string;
}>;
export type AvatarPhotoUploadResult = z.infer<typeof avatarPhotoUploadResultSchema>;
