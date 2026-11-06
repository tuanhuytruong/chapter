import React,{Suspense,lazy,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,useLocation} from 'react-router-dom';
import {Link,usePreviewNavigate,usePreviewActive} from '../../src/components/PreviewNavigation';
import PreviewRouteTransition from '../../src/components/PreviewRouteTransition';
import { PreviewRouteReadinessProvider, usePreviewRouteReadiness, usePreviewRouteSettled } from '../../src/components/PreviewRouteReadiness';
import PreviewPanelTransition from '../../src/components/PreviewPanelTransition';
import usePreviewScroll from '../../src/hooks/usePreviewScroll';
import {captureAnalyticsEvent} from '../../src/analytics';
import '../../src/index.css';import '../../src/styles/nousa-preview.css';
import posthog from 'posthog-js';
(window as any).fixturePosthog=posthog;
const paths=['/','/today','/review','/books/fixture','/playbooks','/playbooks/fixture','/insights','/calendar','/momentum','/streaks','/achievements','/quotes','/profile','/account','/pricing','/help','/feedback'];
const Lazy=lazy(()=>new Promise<{default:React.ComponentType}>(resolve=>setTimeout(()=>resolve({default:()=> <p data-lazy>Ready</p>}),600)));
function Page(){const loc=useLocation(),navigate=usePreviewNavigate();useEffect(()=>{fetch('/api/fixture');},[loc.pathname]);return <section style={{height:2200}}><h1 data-path>{loc.pathname}</h1><Link to=".." relative="path" data-relative>Parent</Link><button onClick={()=>navigate('..',{relative:'path',state:{fixture:true}})}>Route parent navigate</button><div id="anchor" style={{marginTop:700}}>Anchor</div></section>}
function AppContent(){const {presentation}=usePreviewRouteReadiness()!;usePreviewRouteSettled(false);const loc=useLocation(),active=usePreviewActive(),navigate=usePreviewNavigate();const [panel,setPanel]=useState('a');usePreviewScroll(active);useEffect(()=>{captureAnalyticsEvent('route_perf_sample',{route:loc.pathname});},[loc.pathname]);return <div data-ui-preview={active?'nousa':undefined} className="bg-natural-bg text-natural-dark font-sans"><nav>{paths.map((p,i)=><Link key={p} to={p+'?fixture=1#top'} data-nav={i}>{i} </Link>)}</nav><Link to=".." relative="path" data-relative>Parent</Link><button onClick={()=>navigate('..',{relative:'path',state:{fixture:true}})}>Parent navigate</button><button onClick={()=>navigate('/help?fixture=2#anchor',{replace:true,state:{fixture:true}})}>Replace</button><button onClick={()=>navigate(-1)}>Back</button><button onClick={()=>navigate('/feedback?slow=1')}>Slow</button><button onClick={()=>setPanel(panel==='a'?'b':'a')}>Panel</button><PreviewPanelTransition active={active} identity={panel}><audio data-audio preload="none"/><p>{panel}</p></PreviewPanelTransition><div data-status className="bg-natural-cream border border-natural-border text-natural-sage">Status</div><button data-focus className="focus:ring-2 focus:ring-natural-sage">Focus</button><PreviewRouteTransition active={active} pathname={loc.pathname} presentation={presentation}><Suspense fallback={<p data-loading>Loading</p>}><Routes><Route path="/feedback" element={<Lazy/>}/><Route path="*" element={<Page/>}/></Routes></Suspense></PreviewRouteTransition></div>}
function AppRoot(){const location=useLocation();return <PreviewRouteReadinessProvider pathname={location.pathname}><AppContent/></PreviewRouteReadinessProvider>}
createRoot(document.getElementById('root')!).render(<BrowserRouter><AppRoot/></BrowserRouter>);
