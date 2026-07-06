import type { Feather } from "@expo/vector-icons";

// Task #490: trade starter packs. Picking a trade during onboarding
// instantly creates a handful of pre-built services (with prices and a
// day-one checklist) instead of leaving a new provider staring at a blank
// service list. Intentionally scoped to a small, high-signal set of trades —
// not meant to cover every category in SERVICE_CATEGORIES.
export interface StarterPackService {
  name: string;
  description: string;
  pricingType: "fixed" | "quote";
  /** Dollar amount as a string (matches the custom-services API's basePrice field). Omitted for quote-based services. */
  basePrice?: string;
  duration: number;
  checklist: string[];
}

export interface StarterPack {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  /** Matches a SERVICE_CATEGORIES id so downstream category-driven UI (booking preview, etc.) shows the right label/icon. */
  category: string;
  tagline: string;
  services: StarterPackService[];
}

export const STARTER_PACKS: StarterPack[] = [
  {
    id: "lawn_care",
    label: "Lawn Care",
    icon: "sun",
    category: "landscaping",
    tagline: "Mowing, cleanup & trimming — ready to book today",
    services: [
      {
        name: "Lawn Mowing",
        description: "Mow, edge, and blow off walkways for a clean, tidy yard.",
        pricingType: "fixed",
        basePrice: "45",
        duration: 30,
        checklist: [
          "Mow front & back yard",
          "Edge walkways & driveway",
          "Trim around obstacles",
          "Blow off clippings from hard surfaces",
        ],
      },
      {
        name: "Leaf & Yard Cleanup",
        description: "Full yard cleanup — leaves, debris, and green waste bagged and hauled.",
        pricingType: "fixed",
        basePrice: "75",
        duration: 60,
        checklist: [
          "Rake or blow leaves from lawn & beds",
          "Bag or haul green waste",
          "Clear gutters at ground level if accessible",
          "Sweep walkways & driveway",
        ],
      },
      {
        name: "Hedge & Shrub Trimming",
        description: "Shape hedges and shrubs and clean up clippings.",
        pricingType: "fixed",
        basePrice: "60",
        duration: 45,
        checklist: [
          "Trim hedges to shape",
          "Trim shrubs away from house/walkways",
          "Collect & haul clippings",
          "Sweep surrounding area",
        ],
      },
    ],
  },
  {
    id: "house_cleaning",
    label: "House Cleaning",
    icon: "home",
    category: "cleaning",
    tagline: "Standard, deep & move-out cleans with a built-in checklist",
    services: [
      {
        name: "Standard Clean",
        description: "Routine clean covering kitchens, bathrooms, and living spaces.",
        pricingType: "fixed",
        basePrice: "120",
        duration: 120,
        checklist: [
          "Dust all surfaces & fixtures",
          "Vacuum carpets & rugs",
          "Mop hard floors",
          "Clean & disinfect bathrooms",
          "Wipe kitchen counters & appliances (exterior)",
          "Empty trash bins",
        ],
      },
      {
        name: "Deep Clean",
        description: "Detailed top-to-bottom clean including baseboards, appliances, and grout.",
        pricingType: "fixed",
        basePrice: "220",
        duration: 180,
        checklist: [
          "Everything in Standard Clean",
          "Scrub baseboards & door frames",
          "Clean inside oven & microwave",
          "Wipe down cabinet fronts",
          "Deep-clean grout & tile",
        ],
      },
      {
        name: "Move-Out Clean",
        description: "Full clean for tenants/owners leaving a property, including inside cabinets and closets.",
        pricingType: "fixed",
        basePrice: "280",
        duration: 240,
        checklist: [
          "Everything in Deep Clean",
          "Clean inside all cabinets & drawers",
          "Clean inside closets",
          "Wipe down all interior windows & sills",
          "Final walkthrough for touch-ups",
        ],
      },
    ],
  },
  {
    id: "handyman",
    label: "Handyman",
    icon: "tool",
    category: "handyman",
    tagline: "Assembly, mounting & small repairs — priced and checklisted",
    services: [
      {
        name: "Furniture Assembly",
        description: "Assemble flat-pack furniture and haul away packaging.",
        pricingType: "fixed",
        basePrice: "65",
        duration: 60,
        checklist: [
          "Confirm all parts & hardware present",
          "Protect flooring during assembly",
          "Assemble per manufacturer instructions",
          "Test stability & function",
          "Remove & dispose of packaging",
        ],
      },
      {
        name: "TV Mounting",
        description: "Mount a TV to the wall and route/hide cables.",
        pricingType: "fixed",
        basePrice: "90",
        duration: 45,
        checklist: [
          "Locate wall studs",
          "Mount bracket securely",
          "Attach & level TV",
          "Route or conceal cables",
          "Test viewing angle with customer",
        ],
      },
      {
        name: "General Repairs",
        description: "Small home repairs — quoted after a quick look at the job.",
        pricingType: "quote",
        duration: 60,
        checklist: [
          "Assess scope on arrival",
          "Confirm price with customer before starting",
          "Protect surrounding surfaces",
          "Test the repair",
          "Clean up work area",
        ],
      },
    ],
  },
];
