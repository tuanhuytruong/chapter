import { Component, createRef, type ReactNode } from 'react';
import { uiMotion, type SurfaceFamily } from '../uiMotion';

/** Retain only inert presentation on close; child effects stop immediately.
 * Portal callers supply a unique selector for their existing portal root.
 */
export default class PreviewSurfacePresence extends Component<{ active: boolean; open: boolean; family: SurfaceFamily; children: ReactNode; portalSelector?: string }> {
  private root = createRef<HTMLDivElement>();
  private generation = 0;
  private animation?: Animation;
  private scrim?: Animation;
  private timer?: ReturnType<typeof setTimeout>;
  private snapshot?: HTMLElement;
  private media?: MediaQueryList;
  private cancel = () => { this.generation++; this.animation?.cancel(); this.scrim?.cancel(); clearTimeout(this.timer); this.snapshot?.remove(); this.snapshot = undefined; const target = this.target(); if (target) target.dataset.previewPhase = "entered"; };
  private target = () => this.props.portalSelector ? Array.from(document.querySelectorAll<HTMLElement>(this.props.portalSelector)).find(n => !n.inert) : this.root.current?.firstElementChild as HTMLElement | null;
  componentDidMount() { this.media = matchMedia('(prefers-reduced-motion: reduce)'); this.media.addEventListener('change', this.cancel); if (this.props.open) this.enter(); }
  componentWillUnmount() { this.cancel(); this.media?.removeEventListener('change', this.cancel); }
  getSnapshotBeforeUpdate(previous: Readonly<typeof this.props>) {
    if (!previous.active || !this.props.active || !previous.open || this.props.open || this.media?.matches) return null;
    const source = previous.portalSelector ? Array.from(document.querySelectorAll<HTMLElement>(previous.portalSelector)).find(n => !n.inert) : this.target();
    if (!source) return null;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.inert = true; clone.setAttribute('aria-hidden', 'true'); clone.dataset.previewPhase = 'exiting';
    clone.removeAttribute('id'); clone.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    clone.querySelectorAll('audio,video,iframe,script').forEach(n => n.remove());
    clone.style.pointerEvents = 'none';
    if (this.props.family === 'disclosure') { const rect = source.getBoundingClientRect(); Object.assign(clone.style, {position:'fixed', left:`${rect.left}px`, top:`${rect.top}px`, width:`${rect.width}px`, height:`${rect.height}px`, zIndex:'40'}); }
    return clone;
  }
  componentDidUpdate(previous: Readonly<typeof this.props>, _state: unknown, snapshot: HTMLElement | null) {
    if (!this.props.active) { this.cancel(); const target = this.target(); if (target) { delete target.dataset.uiPreview; delete target.dataset.previewFamily; delete target.dataset.previewPhase; } return; }
    if (previous.open === this.props.open) return;
    this.cancel();
    if (this.media?.matches) return;
    if (this.props.open) this.enter();
    else if (snapshot) {
      this.snapshot = snapshot;
      if (this.props.portalSelector) document.body.append(snapshot); else this.root.current?.append(snapshot);
      this.animate(snapshot, false);
    }
  }
  private enter() { const target = this.target(); if (target && this.props.active && !this.media?.matches) this.animate(target, true); }
  private animate(target: HTMLElement, entering: boolean) {
    const family = this.props.family;
    target.dataset.uiPreview = 'nousa'; target.dataset.previewFamily = family;
    target.dataset.previewPhase = entering ? 'entering' : 'exiting';
    const panel = family === 'menu' || family === 'disclosure' ? target : target.querySelector<HTMLElement>('[role="dialog"],.journey-panel,section,form') || target;
    const mobile = matchMedia('(max-width: 639px)').matches;
    const from = family === 'drawer' ? 'translateX(-104%)' : family === 'menu' ? 'translateY(-6px) scale(.92)' : family === 'disclosure' ? 'translateY(4px)' : mobile ? 'translateY(100%)' : 'scale(.86)';
    const to = family === 'drawer' ? 'translateX(-104%)' : family === 'menu' ? 'scale(.96)' : family === 'disclosure' ? 'translateY(4px)' : mobile ? 'translateY(100%)' : 'scale(.94)';
    this.animation = panel.animate(entering ? [{opacity:0,transform:from},{opacity:1,transform:'none'}] : [{opacity:1,transform:'none'},{opacity:0,transform:to}], {duration: uiMotion[family][entering ? 'enter' : 'exit'], easing: entering ? uiMotion.ease : uiMotion.exitEase});
    const generation = this.generation;
    const settle = () => { if (generation !== this.generation) return; clearTimeout(this.timer); if (entering) target.dataset.previewPhase = 'entered'; else target.remove(); };
    this.timer = setTimeout(settle, uiMotion[family][entering ? 'enter' : 'exit'] + 80);
    void this.animation.finished.then(settle, () => {});
    if (family === 'modal' || family === 'drawer') this.scrim = target.animate(entering ? [{opacity:0},{opacity:1}] : [{opacity:1},{opacity:0}], {duration: entering ? 300 : family === 'drawer' ? 250 : 220});
  }
  render() { return <div ref={this.root} style={{display:'contents'}}>{this.props.children}</div>; }
}
