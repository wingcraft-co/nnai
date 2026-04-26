import type { CityData } from "@/components/tarot/types";

export type DashboardPlan = {
  id: number;
  city_id: string | null;
  city: string;
  city_kr: string | null;
  country: string | null;
  country_id: string | null;
  city_payload: Partial<CityData>;
  user_profile: Record<string, unknown>;
  arrived_at: string | null;
  visa_type: string;
  visa_expires_at: string | null;
  coworking_space: {
    name?: string;
    address?: string;
    monthly_cost_usd?: number;
  };
  tax_profile: {
    monthly_income_usd?: number;
    home_country?: string;
  };
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type DashboardWidgetSettings = {
  enabled_widgets: string[];
  widget_order: string[];
  widget_settings: Record<string, unknown>;
  updated_at?: string | null;
};

export type DashboardWidgetCatalogItem = {
  id: string;
  title: string;
  description: string;
  locked: boolean;
};
