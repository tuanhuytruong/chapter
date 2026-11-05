import { useContext } from 'react';
import { UNSAFE_RouteContext, resolvePath, Link as RouterLink, NavLink as RouterNavLink, useLocation, useNavigate, useResolvedPath, type LinkProps, type NavLinkProps, type NavigateOptions, type To } from 'react-router-dom';
import { internalPreviewDestination, isNousaPreview } from '../uiPreview';

export function usePreviewActive() {
  const location = useLocation();
  return isNousaPreview({ hostname: window.location.hostname, pathname: location.pathname, search: location.search, localDevelopment: import.meta.env.DEV });
}
function usePreviewTo(to: To, relative?: LinkProps['relative']): To {
  const resolved = useResolvedPath(to, { relative });
  const active = usePreviewActive();
  // Keep hash-only links and external URLs untouched, and let Router resolve relatives.
  if (typeof to === 'string' && (/^(?:[a-z]+:|\/\/|#)/i.test(to))) return to;
  return active ? internalPreviewDestination(resolved, true) : to;
}
export function Link({ to, ...props }: LinkProps) { const decorated = usePreviewTo(to, props.relative); return <RouterLink {...props} to={props.download ? to : decorated} />; }
export function NavLink({ to, ...props }: NavLinkProps) { return <RouterNavLink {...props} to={usePreviewTo(to, props.relative)} />; }
export function usePreviewNavigate() {
  const navigate = useNavigate();
  const active = usePreviewActive();
  const location = useLocation();
  const { matches } = useContext(UNSAFE_RouteContext);
  return (to: To | number, options?: NavigateOptions) => {
    if (typeof to === 'number') return navigate(to);
    if (!active) return navigate(to, options);
    if (typeof to === 'string' && /^(?:[a-z]+:|\/\/|#)/i.test(to)) return navigate(to, options);
    const input = typeof to === 'string' ? resolvePath(to, '/') : to;
    let path = typeof to === 'string' ? to.split(/[?#]/)[0] : to.pathname;
    let routeIndex = matches.length - 1;
    if (options?.relative !== 'path' && path?.startsWith('..')) {
      const segments = path.split('/');
      while (segments[0] === '..') { segments.shift(); routeIndex--; }
      path = segments.join('/') || '.';
    }
    const base = options?.relative === 'path' ? location.pathname : matches[Math.max(0, routeIndex)]?.pathnameBase || '/';
    const resolved = resolvePath({ ...input, pathname: path || location.pathname }, base);
    const decorated = internalPreviewDestination(resolved, true);
    // Retain native route/path-relative semantics and caller state/replace.
    return navigate(typeof to === 'string' ? {pathname: to.split(/[?#]/)[0] || undefined, search:decorated.search,hash:decorated.hash} : {...to,search:decorated.search}, options);
  };
}
