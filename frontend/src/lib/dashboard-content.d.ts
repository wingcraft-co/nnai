export const LOCKED_WIDGET_IDS: string[];
export const DEFAULT_DASHBOARD_WIDGETS: string[];
export function coerceDashboardWidgets(widgets: unknown): {
  enabled_widgets: string[];
  widget_order: string[];
  widget_settings: Record<string, unknown>;
};
export function computeStayDay(arrivedAt: string | null | undefined, now?: Date): number;
export function resolveCurrencyCode(countryId: string | null | undefined): string;
export function formatCurrencyAmount(amount: number, currencyCode: string, locale?: string): string;
