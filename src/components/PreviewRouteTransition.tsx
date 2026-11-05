import { Component, createRef, type ReactNode } from 'react';

/** Chapter adaptation of Nousa kit xl: only inert DOM presentation is retained.
 * Never retains a React route tree, timers, network effects or audio instances.
 */
export default class PreviewRouteTransition extends Component<{ active: boolean; pathname: string; children: ReactNode }> {
  private live = createRef<HTMLDivElement>();
  private exit = createRef<HTMLDivElement>();
  private animations: Animation[] = [];
  private media: MediaQueryList | undefined;
  private cancel = () => {
    this.animations.forEach(animation => animation.cancel());
    this.animations = [];
    this.exit.current?.replaceChildren();
  };
  private cards() {
    if (!this.props.active || this.media?.matches) return;
    const cards = Array.from(this.live.current?.querySelectorAll<HTMLElement>('[data-preview-card]') || []).filter(n => n.getBoundingClientRect().top < innerHeight).slice(0, 8);
    cards.forEach((card, index) => this.animations.push(card.animate([{opacity:0,transform:'translateY(12px) scale(.985)'},{opacity:1,transform:'none'}], {duration:550,delay:index*40,easing:'cubic-bezier(.22,1,.36,1)'})));
  }
  componentDidMount() {
    this.media = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.media.addEventListener('change', this.cancel);
    this.cards();
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
    // IDs, playback and embedded browsing contexts must not be duplicated.
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    clone.querySelectorAll('audio,video,iframe,script,canvas').forEach(node => node.remove());
    clone.querySelectorAll('input,textarea,select,button,a').forEach(node => { node.setAttribute('tabindex', '-1'); node.removeAttribute('autofocus'); });
    return clone;
  }
  componentDidUpdate(previous: Readonly<typeof this.props>, _state: unknown, snapshot: HTMLElement | null) {
    if (!this.props.active) { this.cancel(); return; }
    if (previous.pathname === this.props.pathname) return;
    this.cancel();
    if (this.media?.matches) return;
    this.cards();
    const order = ['/today', '/', '/review', '/playbooks'];
    const from = order.indexOf(previous.pathname), to = order.indexOf(this.props.pathname);
    const direction = from >= 0 && to >= 0 ? Math.sign(to - from) : 0;
    if (snapshot && this.exit.current) {
      this.exit.current.append(snapshot);
      const animation = snapshot.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translate(${direction * -16}px,8px) scale(.985)` }], { duration: 180, easing: 'cubic-bezier(.55,0,1,.45)', fill: 'forwards' });
      this.animations.push(animation);
      void animation.finished.then(() => snapshot.remove(), () => snapshot.remove());
    }
    if (this.live.current) {
      const animation = this.live.current.animate([{ opacity: 0, transform: `translateX(${direction * 26}px)` }, { opacity: 1, transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)' });
      this.animations.push(animation);
    }
  }
  render() {
    return <div className="preview-route-boundary"><div ref={this.live} data-route-live>{this.props.children}</div><div ref={this.exit} className="preview-route-exit" aria-hidden="true" inert /></div>;
  }
}
