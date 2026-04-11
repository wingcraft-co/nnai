export type AdTone = "korean-air" | "airbnb" | "starbucks" | "apple" | "hostelworld";

export type PartnerAd = {
  id: string;
  brand: string;
  tagline: string;
  href: string;
  tone: AdTone;
  logoColor: string;
  logoPattern: string[];
};

export const partnerAds: PartnerAd[] = [
  {
    id: "korean-air",
    brand: "Korean Air",
    tagline: "Fly Smart Across Neon Skies",
    href: "https://www.google.com",
    tone: "korean-air",
    logoColor: "#4f83ff",
    logoPattern: ["10010", "10100", "11000", "10100", "10010"],
  },
  {
    id: "airbnb",
    brand: "Airbnb",
    tagline: "Stay Human In Mega Cities",
    href: "https://www.google.com",
    tone: "airbnb",
    logoColor: "#ff5a5f",
    logoPattern: ["01110", "10001", "11111", "10001", "10001"],
  },
  {
    id: "starbucks",
    brand: "Starbucks",
    tagline: "Recharge For The Next Jump",
    href: "https://www.google.com",
    tone: "starbucks",
    logoColor: "#00704a",
    logoPattern: ["01111", "10000", "01110", "00001", "11110"],
  },
  {
    id: "apple",
    brand: "Apple",
    tagline: "Think Future, Build Anywhere",
    href: "https://www.google.com",
    tone: "apple",
    logoColor: "#a2aaad",
    logoPattern: ["01110", "10001", "11111", "10001", "10001"],
  },
  {
    id: "hostelworld",
    brand: "Hostelworld",
    tagline: "Find Your Base Camp Tonight",
    href: "https://www.google.com",
    tone: "hostelworld",
    logoColor: "#ff7a00",
    logoPattern: ["10001", "10001", "11111", "10001", "10001"],
  },
];
