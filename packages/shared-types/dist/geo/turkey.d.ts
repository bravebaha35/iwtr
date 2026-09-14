export interface TurkeyProvince {
    plate: string;
    name: string;
    lat: number;
    lng: number;
    districts: string[];
}
export declare const TURKEY_PROVINCES: TurkeyProvince[];
export declare function normalizeCityName(value: string): string;
export declare function findProvinceByCityName(cityName: string | null | undefined): TurkeyProvince | null;
export declare function findDistrictInProvince(province: TurkeyProvince, districtName: string): string | null;
