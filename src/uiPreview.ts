/** Visual rollout guard only; authentication remains unchanged. */
export function isPreviewRoute(pathname: string): boolean {
  return /^(?:\/|\/(?:today|review|playbooks|insights|calendar|momentum|streaks|achievements|quotes|profile|account|pricing|help|feedback)|\/(?:books|playbooks)\/[^/]+)$/.test(pathname);
}
export function isNousaPreview({hostname, pathname, search, localDevelopment = false}: {hostname: string; pathname: string; search: string; localDevelopment?: boolean}): boolean {
  const allowed = hostname === 'chapter-dev.srv.io.vn' || (localDevelopment && ['localhost', '127.0.0.1', '[::1]'].includes(hostname));
  return allowed && isPreviewRoute(pathname) && new URLSearchParams(search).getAll('uiPreview').length === 1 && new URLSearchParams(search).get('uiPreview') === 'nousa';
}
export function originalUrl(pathname: string, search = '', hash = ''): string {
  const params = new URLSearchParams(search);
  params.delete('uiPreview');
  return `${pathname}${params.size ? `?${params}` : ''}${hash}`;
}
export function originalLibraryUrl(search: string): string { return originalUrl('/', search); }
export function internalPreviewDestination<T extends { pathname?: string; search?: string; hash?: string }>(destination: T, active: boolean): T {
  if (!destination.pathname || !isPreviewRoute(destination.pathname)) return destination;
  const params = new URLSearchParams(destination.search);
  params.delete('uiPreview');
  if (active) params.set('uiPreview', 'nousa');
  return { ...destination, search: params.size ? `?${params}` : '' };
}
