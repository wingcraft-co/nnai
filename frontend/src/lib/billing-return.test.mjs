import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldHandleBillingReturn,
  resolveBillingReturnNotice,
  stripCheckoutReturnParam,
} from './billing-return.mjs';

test('handles checkout return query flag', () => {
  assert.equal(shouldHandleBillingReturn(new URLSearchParams('checkout=return')), true);
  assert.equal(shouldHandleBillingReturn(new URLSearchParams('checkout=other')), false);
});

test('builds success notice for restored pro entitlement', () => {
  const notice = resolveBillingReturnNotice({
    locale: 'ko',
    restored: true,
    entitlement: { plan_tier: 'pro', status: 'active' },
  });

  assert.equal(notice.tone, 'success');
  assert.match(notice.title, /Pro/);
});

test('builds pending notice when entitlement is still free', () => {
  const notice = resolveBillingReturnNotice({
    locale: 'en',
    restored: false,
    entitlement: { plan_tier: 'free', status: 'active' },
  });

  assert.equal(notice.tone, 'pending');
  assert.match(notice.body, /syncing/i);
});

test('removes checkout query without touching other params', () => {
  const next = stripCheckoutReturnParam('https://nnai.app/ko/pricing?checkout=return&foo=bar');

  assert.equal(next, 'https://nnai.app/ko/pricing?foo=bar');
});
