import type { WorkplaceType } from "@iwtr/shared-types";

// Fixed sector taxonomy for the "Sector" filter dropdown (WorkplaceBrowser).
// Each sector is tagged with the workplace type(s) it realistically belongs
// under (max 2, mirroring the "a company can carry up to 2 workplaceTypes"
// rule used everywhere else) — e.g. Healthcare sits under both Office (admin
// staff) and Service (patient-facing staff), the way a hospital company
// itself would be tagged OFFICE + SERVICE. "Other" is tagged with every type
// so it always stays available as a catch-all regardless of which
// workplace type(s) are selected. When no workplace type is selected, the
// dropdown shows the full list; picking one or more narrows it down to the
// matching sectors (see sectorsForWorkplaceTypes in WorkplaceBrowser.tsx).
export const SECTORS: { value: string; label: string; workplaceTypes: WorkplaceType[] }[] = [
  { value: "Advertising & Marketing", label: "Advertising & Marketing", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Agriculture", label: "Agriculture", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Archive Management & Storage", label: "Archive Management & Storage", workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] },
  { value: "Automotive", label: "Automotive", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Aviation", label: "Aviation", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Building & Property Management", label: "Building & Property Management", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Chemicals", label: "Chemicals", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Communications Consulting", label: "Communications Consulting", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Communities", label: "Communities", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Construction", label: "Construction", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Consulting", label: "Consulting", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Dental", label: "Dental", workplaceTypes: ["SERVICE"] },
  { value: "Drilling", label: "Drilling", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Durable Consumer Goods", label: "Durable Consumer Goods", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Education", label: "Education", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Electrical & Electronics", label: "Electrical & Electronics", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Energy", label: "Energy", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Entertainment - Culture - Art", label: "Entertainment - Culture - Art", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Environment", label: "Environment", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Event Organization", label: "Event Organization", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Fast-Moving Consumer Goods (FMCG)", label: "Fast-Moving Consumer Goods (FMCG)", workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] },
  { value: "Finance & Economy", label: "Finance & Economy", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Food & Beverage", label: "Food & Beverage", workplaceTypes: ["SERVICE", "MANUAL_LABOUR"] },
  { value: "Forest Products", label: "Forest Products", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Furniture & Accessories", label: "Furniture & Accessories", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Healthcare", label: "Healthcare", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Highway, Tunnel & Bridge Operations", label: "Highway, Tunnel & Bridge Operations", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Household Goods", label: "Household Goods", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Industry", label: "Industry", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Information Technology", label: "Information Technology", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Insurance", label: "Insurance", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "IT", label: "IT", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Livestock & Animal Husbandry", label: "Livestock & Animal Husbandry", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Logistics", label: "Logistics", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Manufacturing / Industrial Products", label: "Manufacturing / Industrial Products", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Marine Supply Industry", label: "Marine Supply Industry", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Maritime", label: "Maritime", workplaceTypes: ["MANUAL_LABOUR", "SERVICE"] },
  { value: "Media", label: "Media", workplaceTypes: ["OFFICE", "HYBRID_REMOTE"] },
  { value: "Mining & Metals", label: "Mining & Metals", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Office Supplies", label: "Office Supplies", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Printing & Publishing", label: "Printing & Publishing", workplaceTypes: ["MANUAL_LABOUR", "OFFICE"] },
  { value: "Retail", label: "Retail", workplaceTypes: ["SERVICE"] },
  { value: "Security", label: "Security", workplaceTypes: ["SERVICE", "MANUAL_LABOUR"] },
  { value: "Services", label: "Services", workplaceTypes: ["SERVICE", "OFFICE"] },
  { value: "Telecommunications", label: "Telecommunications", workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] },
  { value: "Textile", label: "Textile", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Tourism", label: "Tourism", workplaceTypes: ["SERVICE"] },
  { value: "Trade / Commerce", label: "Trade / Commerce", workplaceTypes: ["OFFICE", "SERVICE"] },
  { value: "Waste Management & Recycling", label: "Waste Management & Recycling", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Welding & Cutting Equipment", label: "Welding & Cutting Equipment", workplaceTypes: ["MANUAL_LABOUR"] },
  { value: "Other", label: "Other", workplaceTypes: ["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"] },
];
