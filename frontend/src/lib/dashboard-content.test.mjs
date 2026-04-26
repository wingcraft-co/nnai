import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coerceDashboardWidgets,
  computeStayDay,
  resolveCurrencyCode,
} from './dashboard-content.mjs';

test('keeps locked dashboard widgets enabled and first in order', () => {
  const result = coerceDashboardWidgets({
    enabled_widgets: ['tax', 'budget'],
    widget_order: ['budget', 'tax'],
    widget_settings: {},
  });

  assert.deepEqual(result.widget_order.slice(0, 4), ['weather', 'exchange', 'stay', 'visa']);
  assert.equal(result.enabled_widgets.includes('weather'), true);
  assert.equal(result.enabled_widgets.includes('visa'), true);
  assert.equal(result.enabled_widgets.includes('budget'), true);
});

test('computes one-based stay day from arrival date', () => {
  assert.equal(computeStayDay('2026-04-10', new Date('2026-04-26T12:00:00+09:00')), 17);
  assert.equal(computeStayDay(null, new Date('2026-04-26T12:00:00+09:00')), 1);
});

test('resolves local currency from country id with USD fallback', () => {
  assert.equal(resolveCurrencyCode('TH'), 'THB');
  assert.equal(resolveCurrencyCode('PT'), 'EUR');
  assert.equal(resolveCurrencyCode('ZZ'), 'USD');
});
