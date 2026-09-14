import { type TurkeyProvince } from "./turkey";
export declare const TURKEY_AREA_CODES_BY_PLATE: Record<string, string[]>;
export declare const ALL_TURKEY_AREA_CODES: readonly string[];
export declare function provinceForAreaCode(areaCode: string): TurkeyProvince | null;
export declare function areaCodesForProvince(provinceName: string | null | undefined): string[] | null;
