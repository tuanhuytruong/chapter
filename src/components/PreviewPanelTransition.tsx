import { Component, createRef, type ReactNode } from 'react';
/** Dense panel adaptation: snapshot only, never remount a live audio/player. */
export default class PreviewPanelTransition extends Component<{active:boolean; identity:string; children:ReactNode}> {
  private root=createRef<HTMLDivElement>();
  private animations:Animation[]=[];
  private clone?:HTMLElement;
  private media?:MediaQueryList;
  private cancel=()=>{this.animations.forEach(a=>a.cancel());this.animations=[];this.clone?.remove();};
  componentDidMount(){this.media=matchMedia('(prefers-reduced-motion: reduce)');this.media.addEventListener('change',this.cancel);}
  componentWillUnmount(){this.cancel();this.media?.removeEventListener('change',this.cancel);}
  getSnapshotBeforeUpdate(prev:Readonly<typeof this.props>){if(!prev.active||!this.props.active||prev.identity===this.props.identity||this.media?.matches)return null;const node=this.root.current?.cloneNode(true) as HTMLElement;node.inert=true;node.setAttribute('aria-hidden','true');node.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));node.querySelectorAll('audio,video,iframe,script').forEach(n=>n.remove());const box=this.root.current!.getBoundingClientRect();Object.assign(node.style,{position:'fixed',left:`${box.left}px`,top:`${box.top}px`,width:`${box.width}px`,pointerEvents:'none',zIndex:'30'});return node;}
  componentDidUpdate(prev:Readonly<typeof this.props>,_state:unknown,snapshot:HTMLElement|null){if(!this.props.active){this.cancel();return;}if(prev.identity===this.props.identity)return;this.cancel();if(this.media?.matches)return;if(snapshot){this.clone=snapshot;document.body.append(snapshot);const exit=snapshot.animate([{opacity:1},{opacity:0}],{duration:180});this.animations.push(exit);void exit.finished.then(()=>snapshot.remove(),()=>snapshot.remove());}if(this.root.current)this.animations.push(this.root.current.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.22,1,.36,1)'}));}
  render(){return <div ref={this.root} style={this.props.active ? undefined : {display:"contents"}}>{this.props.children}</div>;}
}
