import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type RoutePresentation = 'pending' | 'ready' | 'error';

type RouteReadinessContextValue = {
  presentation: RoutePresentation;
  settle: (presentation?: Exclude<RoutePresentation, 'pending'>) => void;
};

const RouteReadinessContext = createContext<RouteReadinessContextValue | null>(null);

export function PreviewRouteReadinessProvider({ pathname, children }: { pathname: string; children: ReactNode }) {
  const [state, setState] = useState<{ pathname: string; presentation: RoutePresentation }>({ pathname, presentation: 'pending' });
  // A new pathname reads as pending during its first render, before effects can
  // settle it. This prevents the former fade of the skeleton followed by a fade
  // of data, while allowing a route that is already committed to reveal once.
  const presentation = state.pathname === pathname ? state.presentation : 'pending';
  const value = useMemo<RouteReadinessContextValue>(() => ({
    presentation,
    settle: (next = 'ready') => setState(current => {
      if (current.pathname !== pathname) return { pathname, presentation: next };
      return current.presentation === 'pending' ? { ...current, presentation: next } : current;
    }),
  }), [pathname, presentation]);
  return <RouteReadinessContext.Provider value={value}>{children}</RouteReadinessContext.Provider>;
}

export function usePreviewRouteReadiness() { return useContext(RouteReadinessContext); }

/** Report terminal core-data state only; optional background work must not delay it. */
export function usePreviewRouteSettled(loading: boolean) {
  const readiness = usePreviewRouteReadiness();
  useEffect(() => { if (!loading) readiness?.settle(); }, [loading, readiness]);
}
