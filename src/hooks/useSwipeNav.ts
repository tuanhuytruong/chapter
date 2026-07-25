import { useCallback, useRef } from 'react';
import type { RefObject } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ROUTES = ['/today', '/', '/review'];
const MIN_SWIPE = 50;

export default function useSwipeNav(containerRef: RefObject<HTMLElement | null>) {
  const navigate = useNavigate();
  const location = useLocation();
  const startX = useRef(0);
  const startY = useRef(0);
  const ignoreGesture = useRef(false);

  const onPointerDown = useCallback((e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    // Native select/file pickers can end their pointer gesture at a different
    // screen coordinate. Never interpret interactions inside controls or an
    // explicitly excluded overlay as a route-changing swipe.
    ignoreGesture.current = Boolean(target?.closest(
      'input, select, textarea, button, a, [data-swipe-nav-ignore]'
    ));
    if (ignoreGesture.current) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
  }, []);

  const onPointerUp = useCallback((e: PointerEvent) => {
    if (ignoreGesture.current) {
      ignoreGesture.current = false;
      return;
    }
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (Math.abs(dx) < MIN_SWIPE || Math.abs(dx) < Math.abs(dy)) return;

    const idx = ROUTES.indexOf(location.pathname);
    if (idx === -1) return;

    if (dx < 0 && idx < ROUTES.length - 1) {
      // swipe left → next route
      navigate(ROUTES[idx + 1]);
    } else if (dx > 0 && idx > 0) {
      // swipe right → previous route
      navigate(ROUTES[idx - 1]);
    }
  }, [navigate, location.pathname]);

  // Attach/cleanup pointer events
  const attach = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
  }, [containerRef, onPointerDown, onPointerUp]);

  const detach = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointerup', onPointerUp);
  }, [containerRef, onPointerDown, onPointerUp]);

  return { attach, detach };
}
