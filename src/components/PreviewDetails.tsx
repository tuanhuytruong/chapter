import { useEffect, useRef, type ComponentProps } from 'react';
import {usePreviewActive} from './PreviewNavigation';
/** Native details retains its spoiler and keyboard semantics. Only presentation
 * is cloned for close, with no domain effects or interactive retained nodes. */
export default function PreviewDetails(props: ComponentProps<'details'>) {
 const active=usePreviewActive();const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{if(!active||!ref.current)return;const root=ref.current;const animations:Animation[]=[];const clones:HTMLElement[]=[];const media=matchMedia('(prefers-reduced-motion: reduce)');
 const cancel=()=>{animations.splice(0).forEach(a=>a.cancel());clones.splice(0).forEach(n=>n.remove());};
 const animate=(node:HTMLElement,enter:boolean)=>{const animation=node.animate(enter?[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'none'}]:[{opacity:1},{opacity:0}],{duration:180,easing:'cubic-bezier(.22,1,.36,1)'});animations.push(animation);if(!enter)void animation.finished.then(()=>node.remove(),()=>node.remove());};
 const click=(event:MouseEvent)=>{if(!root.open||media.matches||!(event.target as Element).closest('summary'))return;cancel();for(const child of Array.from(root.children)){if(child.tagName==='SUMMARY')continue;const node=child.cloneNode(true) as HTMLElement,rect=child.getBoundingClientRect();node.inert=true;node.setAttribute('aria-hidden','true');node.removeAttribute('id');node.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));Object.assign(node.style,{position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,pointerEvents:'none',zIndex:'30'});document.body.append(node);clones.push(node);animate(node,false);}};
 const toggle=()=>{if(!root.open||media.matches)return;cancel();Array.from(root.children).filter(n=>n.tagName!=='SUMMARY').forEach(n=>animate(n as HTMLElement,true));};
 root.addEventListener('click',click);root.addEventListener('toggle',toggle);media.addEventListener('change',cancel);return()=>{cancel();root.removeEventListener('click',click);root.removeEventListener('toggle',toggle);media.removeEventListener('change',cancel);};},[active]);
 return <details {...props} ref={ref}/>;
}
