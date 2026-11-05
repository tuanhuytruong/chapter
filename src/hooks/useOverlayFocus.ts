import { useLayoutEffect, useRef } from 'react';
const stack: HTMLElement[] = [];
const locks = new Map<HTMLElement, { count: number; inert: boolean }>();
let bodyLocks = 0;
let overflow = '';
const focusable = 'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]';
/** Modal-only focus/lock lifecycle. Animation snapshots never own locks. */
export default function useOverlayFocus(active: boolean, selector: string, close: () => void) {
  const closeRef = useRef(close); closeRef.current = close;
  useLayoutEffect(() => {
    if (!active) return;
    const root = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(n => !n.inert); if (!root) return;
    const trigger = document.activeElement as HTMLElement | null;
    const affected: HTMLElement[] = [];
    let node = root;
    while (node.parentElement && node !== document.body) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          const lock = locks.get(sibling) || { count: 0, inert: sibling.inert };
          lock.count++; locks.set(sibling, lock); sibling.inert = true; affected.push(sibling);
        }
      }
      node = node.parentElement;
    }
    if (bodyLocks++ === 0) { overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    stack.push(root);
    const items = () => Array.from(root.querySelectorAll<HTMLElement>(focusable)).filter(n => !n.closest('[inert]') && n.getClientRects().length);
    (items()[0] || root).focus();
    const key = (event: KeyboardEvent) => {
      if (stack.at(-1) !== root) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const list = items(); const index = list.indexOf(document.activeElement as HTMLElement);
        if (!list.length) { event.preventDefault(); root.focus(); }
        else if (event.shiftKey ? index <= 0 : index < 0 || index === list.length - 1) { event.preventDefault(); list[event.shiftKey ? list.length - 1 : 0].focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      const ownedFocus = root.contains(document.activeElement) || document.activeElement === document.body;
      const index = stack.indexOf(root); if (index >= 0) stack.splice(index, 1);
      for (const sibling of affected) { const lock = locks.get(sibling)!; if (--lock.count === 0) { sibling.inert = lock.inert; locks.delete(sibling); } }
      if (--bodyLocks === 0) document.body.style.overflow = overflow;
      if (ownedFocus && trigger?.isConnected && !trigger.closest('[inert]')) trigger.focus();
    };
  }, [active, selector]);
}
