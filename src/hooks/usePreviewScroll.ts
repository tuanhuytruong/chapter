import {useLayoutEffect,useRef} from 'react';
import {useLocation,useNavigationType} from 'react-router-dom';
const positions=new Map<string,number>();
/** In-memory per-history-entry scroll. Query changes retain current position;
 * saved-session/round anchors continue to be owned by Book Detail. */
export default function usePreviewScroll(active:boolean){
 const location=useLocation(),type=useNavigationType(),previous=useRef(location.pathname);
 useLayoutEffect(()=>{if(!active)return;const prior=history.scrollRestoration;history.scrollRestoration='manual';return()=>{history.scrollRestoration=prior;};},[active]);
 useLayoutEffect(()=>{if(!active)return;let frame=0;let attempts=0;const changed=previous.current!==location.pathname;previous.current=location.pathname;
 const sourceAnchor=new URLSearchParams(location.search).has('returnLog')||new URLSearchParams(location.search).has('log');
 if(type==='POP'&&positions.has(location.key))window.scrollTo(0,positions.get(location.key)!);
 else if(location.hash){const reveal=()=>{const node=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(node)node.scrollIntoView({block:'start'});else if(attempts++<30)frame=requestAnimationFrame(reveal);};frame=requestAnimationFrame(reveal);}
 else if(changed&&!sourceAnchor)window.scrollTo(0,0);
 const save=()=>positions.set(location.key,window.scrollY);window.addEventListener('scroll',save,{passive:true});
 return()=>{save();cancelAnimationFrame(frame);window.removeEventListener('scroll',save);};
 },[active,location.key,location.pathname,location.hash,type]);
}
