/** Visual rollout guard only; authentication remains unchanged. */
export function isNousaPreview({hostname, pathname, search, localDevelopment = false}: {hostname: string; pathname: string; search: string; localDevelopment?: boolean}): boolean {
  const allowed = hostname === 'chapter-dev.srv.io.vn' || (localDevelopment && ['localhost', '127.0.0.1', '[::1]'].includes(hostname));
  return allowed && pathname === '/' && new URLSearchParams(search).get('uiPreview') === 'nousa';
}
export function originalLibraryUrl(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('uiPreview');
  return `/${params.size ? `?${params}` : ''}`;
}
