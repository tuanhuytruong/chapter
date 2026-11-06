import { Component, createRef, type ReactNode } from 'react';
import type { RoutePresentation } from './PreviewRouteReadiness';

/**
 * Preview-only presentation layer. The current route stays live; an outgoing
 * inert DOM clone may remain for a bounded exit, never a second React tree.
 */
export default class PreviewRouteTransition extends Component<{
  active: boolean;
  pathname: string;
  presentation: RoutePresentation;
  children: ReactNode;
}> {
  private live = createRef<HTMLDivElement>();
  private exit = createRef<HTMLDivElement>();
  private animations: Animation[] = [];
  private media: MediaQueryList | undefined;

  private cancel = () => {
    this.animations.forEach(animation => animation.cancel());
    this.animations = [];
    this.exit.current?.replaceChildren();
  };

  componentDidMount() {
    this.media = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.media.addEventListener('change', this.cancel);
  }

  componentWillUnmount() {
    this.cancel();
    this.media?.removeEventListener('change', this.cancel);
  }

  getSnapshotBeforeUpdate(previous: Readonly<typeof this.props>): HTMLElement | null {
    if (!previous.active || !this.props.active || previous.pathname === this.props.pathname || this.media?.matches || !this.live.current) return null;
    const clone = this.live.current.cloneNode(true) as HTMLElement;
    clone.inert = true;
    clone.setAttribute('aria-hidden', 'true');
    clone.dataset.routeSnapshot = 'exiting';
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    clone.querySelectorAll('audio,video,iframe,script,canvas').forEach(node => node.remove());
    clone.querySelectorAll('input,textarea,select,button,a').forEach(node => {
      node.setAttribute('tabindex', '-1');
      node.removeAttribute('autofocus');
    });
    return clone;
  }

  private enter() {
    if (!this.live.current || this.media?.matches) return;
    this.animations.push(this.live.current.animate(
      [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' },
    ));
  }

  componentDidUpdate(previous: Readonly<typeof this.props>, _state: unknown, snapshot: HTMLElement | null) {
    if (!this.props.active) { this.cancel(); return; }
    const routeChanged = previous.pathname !== this.props.pathname;
    if (routeChanged) {
      this.cancel();
      if (this.media?.matches) return;
      if (snapshot && this.exit.current) {
        this.exit.current.append(snapshot);
        const animation = snapshot.animate(
          [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(6px) scale(.992)' }],
          { duration: 140, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' },
        );
        this.animations.push(animation);
        void animation.finished.then(() => snapshot.remove(), () => snapshot.remove());
      }
      if (this.props.presentation === 'ready') this.enter();
      return;
    }
    if (previous.presentation === 'pending' && this.props.presentation !== 'pending') this.enter();
  }

  render() {
    return <div className="preview-route-boundary" data-route-presentation={this.props.presentation}>
      <div ref={this.live} data-route-live>{this.props.children}</div>
      <div ref={this.exit} className="preview-route-exit" aria-hidden="true" inert />
    </div>;
  }
}
