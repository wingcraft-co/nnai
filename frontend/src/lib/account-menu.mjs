export function resolveAccountMenuDisplay(auth, labels) {
  if (!auth?.logged_in) {
    return {
      isLoggedIn: false,
      displayName: labels.login,
      picture: null,
    };
  }

  return {
    isLoggedIn: true,
    displayName: auth.name || labels.fallbackName,
    picture: auth.picture || null,
  };
}
