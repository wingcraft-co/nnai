function isProEntitlement(entitlement) {
  return entitlement?.plan_tier === 'pro' && ['active', 'grace'].includes(entitlement?.status);
}

export function shouldHandleBillingReturn(searchParams) {
  return searchParams?.get?.('checkout') === 'return';
}

export function resolveBillingReturnNotice({ locale, restored, entitlement, error }) {
  const isEn = locale === 'en';

  if (error) {
    return {
      tone: 'error',
      title: isEn ? 'Checkout verification needs attention' : '결제 확인이 더 필요합니다',
      body: isEn
        ? 'We could not verify your billing state automatically. Please refresh in a moment or contact support.'
        : '결제 상태를 자동으로 확인하지 못했습니다. 잠시 후 새로고침하거나 문의해 주세요.',
    };
  }

  if (restored || isProEntitlement(entitlement)) {
    return {
      tone: 'success',
      title: isEn ? 'Pro access is ready' : 'Pro 권한이 활성화되었습니다',
      body: isEn
        ? 'Your billing state has been restored. You can continue with Pro planning right away.'
        : '결제 상태를 복구했고, 이제 Pro 기능을 바로 사용할 수 있습니다.',
    };
  }

  return {
    tone: 'pending',
    title: isEn ? 'Payment is still syncing' : '결제 반영을 확인하는 중입니다',
    body: isEn
      ? 'Your checkout returned successfully, but the entitlement is still syncing. Please refresh shortly if access does not update.'
      : '결제 페이지에서는 정상 복귀했지만 권한 반영이 아직 동기화 중일 수 있습니다. 잠시 후 새로고침해 주세요.',
  };
}

export function stripCheckoutReturnParam(url) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.delete('checkout');
  return nextUrl.toString();
}
