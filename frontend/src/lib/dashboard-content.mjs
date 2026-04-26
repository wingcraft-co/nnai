export const LOCKED_WIDGET_IDS = ['weather', 'exchange', 'stay', 'visa'];

export const DEFAULT_DASHBOARD_WIDGETS = [
  'weather',
  'exchange',
  'stay',
  'visa',
  'action_plan',
  'coworking',
  'tax',
  'disaster',
  'budget',
  'housing',
  'insurance',
  'local_events',
];

export const COUNTRY_CURRENCIES = {
  AE: 'AED',
  AR: 'ARS',
  AT: 'EUR',
  AU: 'AUD',
  BE: 'EUR',
  BG: 'BGN',
  BR: 'BRL',
  CA: 'CAD',
  CH: 'CHF',
  CL: 'CLP',
  CO: 'COP',
  CR: 'CRC',
  CY: 'EUR',
  CZ: 'CZK',
  DE: 'EUR',
  DK: 'DKK',
  EE: 'EUR',
  ES: 'EUR',
  FI: 'EUR',
  FR: 'EUR',
  GB: 'GBP',
  GE: 'GEL',
  GR: 'EUR',
  HR: 'EUR',
  HU: 'HUF',
  ID: 'IDR',
  IE: 'EUR',
  IT: 'EUR',
  JP: 'JPY',
  KR: 'KRW',
  MA: 'MAD',
  MT: 'EUR',
  MX: 'MXN',
  MY: 'MYR',
  NL: 'EUR',
  NO: 'NOK',
  NZ: 'NZD',
  PA: 'PAB',
  PE: 'PEN',
  PH: 'PHP',
  PL: 'PLN',
  PT: 'EUR',
  RO: 'RON',
  RS: 'RSD',
  SE: 'SEK',
  SG: 'SGD',
  SI: 'EUR',
  TH: 'THB',
  TR: 'TRY',
  TW: 'TWD',
  US: 'USD',
  UY: 'UYU',
  VN: 'VND',
  ZA: 'ZAR',
};

export function coerceDashboardWidgets(widgets) {
  const input = widgets && typeof widgets === 'object' ? widgets : {};
  const enabled = Array.isArray(input.enabled_widgets)
    ? input.enabled_widgets.filter((id) => DEFAULT_DASHBOARD_WIDGETS.includes(id))
    : [...DEFAULT_DASHBOARD_WIDGETS];
  const order = Array.isArray(input.widget_order)
    ? input.widget_order.filter((id) => DEFAULT_DASHBOARD_WIDGETS.includes(id))
    : [...DEFAULT_DASHBOARD_WIDGETS];

  for (let i = LOCKED_WIDGET_IDS.length - 1; i >= 0; i -= 1) {
    const widgetId = LOCKED_WIDGET_IDS[i];
    if (!enabled.includes(widgetId)) enabled.unshift(widgetId);
    if (!order.includes(widgetId)) order.unshift(widgetId);
  }

  const dedupedEnabled = [...new Set(enabled)];
  const dedupedOrder = [...new Set([...order, ...dedupedEnabled])]
    .filter((id) => dedupedEnabled.includes(id));

  return {
    enabled_widgets: dedupedEnabled,
    widget_order: dedupedOrder,
    widget_settings:
      input.widget_settings && typeof input.widget_settings === 'object'
        ? input.widget_settings
        : {},
  };
}

export function computeStayDay(arrivedAt, now = new Date()) {
  if (!arrivedAt) return 1;
  const start = new Date(`${arrivedAt}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 1;
  const current = new Date(now);
  start.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((current.getTime() - start.getTime()) / dayMs) + 1);
}

export function resolveCurrencyCode(countryId) {
  return COUNTRY_CURRENCIES[String(countryId || '').toUpperCase()] || 'USD';
}

export function formatCurrencyAmount(amount, currencyCode, locale = 'ko-KR') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: currencyCode === 'KRW' || currencyCode === 'JPY' ? 0 : 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
