import { z } from "zod";
import { type TurkeyProvince } from "./turkey";
export declare const TURKEY_REGIONS: readonly [{
    readonly key: "MARMARA";
    readonly label: "Marmara";
    readonly provinces: readonly ["İstanbul", "Bursa", "Kocaeli", "Balıkesir", "Çanakkale", "Tekirdağ", "Edirne", "Kırklareli", "Sakarya", "Yalova", "Bilecik"];
}, {
    readonly key: "EGE";
    readonly label: "Ege";
    readonly provinces: readonly ["İzmir", "Manisa", "Aydın", "Denizli", "Muğla", "Afyonkarahisar", "Kütahya", "Uşak"];
}, {
    readonly key: "AKDENIZ";
    readonly label: "Akdeniz";
    readonly provinces: readonly ["Antalya", "Adana", "Mersin", "Hatay", "Isparta", "Burdur", "Kahramanmaraş", "Osmaniye"];
}, {
    readonly key: "IC_ANADOLU";
    readonly label: "İç Anadolu";
    readonly provinces: readonly ["Ankara", "Konya", "Kayseri", "Sivas", "Eskişehir", "Yozgat", "Kırıkkale", "Aksaray", "Karaman", "Kırşehir", "Nevşehir", "Niğde", "Çankırı"];
}, {
    readonly key: "KARADENIZ";
    readonly label: "Karadeniz";
    readonly provinces: readonly ["Samsun", "Trabzon", "Ordu", "Giresun", "Rize", "Artvin", "Zonguldak", "Kastamonu", "Sinop", "Amasya", "Çorum", "Tokat", "Bolu", "Düzce", "Bartın", "Karabük", "Gümüşhane", "Bayburt"];
}, {
    readonly key: "DOGU_ANADOLU";
    readonly label: "Doğu Anadolu";
    readonly provinces: readonly ["Erzurum", "Van", "Malatya", "Elazığ", "Ağrı", "Kars", "Ardahan", "Iğdır", "Erzincan", "Bingöl", "Bitlis", "Hakkari", "Muş", "Tunceli"];
}, {
    readonly key: "GUNEYDOGU_ANADOLU";
    readonly label: "Güneydoğu Anadolu";
    readonly provinces: readonly ["Gaziantep", "Şanlıurfa", "Diyarbakır", "Mardin", "Batman", "Siirt", "Şırnak", "Kilis", "Adıyaman"];
}];
export type TurkeyRegionKey = (typeof TURKEY_REGIONS)[number]["key"];
export declare const turkeyRegionKeySchema: z.ZodEnum<["MARMARA", "EGE", "AKDENIZ", "IC_ANADOLU", "KARADENIZ", "DOGU_ANADOLU", "GUNEYDOGU_ANADOLU"]>;
export declare function regionLabel(key: TurkeyRegionKey): string;
export declare function provincesInRegion(key: TurkeyRegionKey): TurkeyProvince[];
export declare function findRegionByProvinceName(provinceName: string | null | undefined): TurkeyRegionKey | null;
