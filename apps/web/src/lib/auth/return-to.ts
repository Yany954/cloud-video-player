// Where to go after signing in, when a signed-out visitor opened a page such as an invite
// link. Kept in the tab's session storage, not in the URL, so an invite secret never ends up
// in the address bar of the login page or in the browser history twice.

const KEY = 'cvp.return-to';

/** Only paths inside this app: never another site, whatever was stored. */
export function isSafePath(path: string): boolean {
  return /^\/(?![/\\])/.test(path) && !path.startsWith('/login');
}

export function rememberReturnTo(path: string): void {
  if (!isSafePath(path)) return;
  try {
    window.sessionStorage.setItem(KEY, path);
  } catch {
    // Storage can be unavailable (private mode): the visitor simply lands on the home page.
  }
}

/** Returns the remembered path once, then forgets it. Falls back to the home page. */
export function takeReturnTo(): string {
  try {
    const path = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return path !== null && isSafePath(path) ? path : '/';
  } catch {
    return '/';
  }
}
