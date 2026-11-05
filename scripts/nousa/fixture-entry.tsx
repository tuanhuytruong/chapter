import useOverlayFocus from '../../src/hooks/useOverlayFocus';
import usePreviewScroll from '../../src/hooks/usePreviewScroll';
import ReferenceCardUseSheet from '../../src/components/playbooks/ReferenceCardUseSheet';
import ReferenceCardDraftModal from '../../src/components/playbooks/ReferenceCardDraftModal';
import VietQrCheckoutSheet from '../../src/components/VietQrCheckoutSheet';
import PodcastPanel from '../../src/components/PodcastPanel';
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useLocation} from 'react-router-dom';
import PreviewSurfacePresence from '../../src/components/PreviewSurfacePresence';
import PreviewRouteTransition from '../../src/components/PreviewRouteTransition';
import {Link,usePreviewActive} from '../../src/components/PreviewNavigation';
import SortMenu from '../../src/components/SortMenu';
import ChapterDropdown from '../../src/components/ChapterDropdown';
import JourneyDrawer from '../../src/components/JourneyDrawer';
import AddBookModal from '../../src/components/AddBookModal';
import ReadingLensCard from '../../src/components/ReadingLensCard';
import PricingFaq from '../../src/components/PricingFaq';
import {originalUrl} from '../../src/uiPreview';
import {Link as OriginalLink} from 'react-router-dom';
import {OnboardingProvider} from '../../src/onboarding';
import '../../src/index.css';import '../../src/styles/nousa-preview.css';
function Fixture(){const loc=useLocation(),active=usePreviewActive();usePreviewScroll(active);const[sort,setSort]=useState<any>('recent'),[choice,setChoice]=useState('one'),[modal,setModal]=useState(false),[drawer,setDrawer]=useState(false),[nested,setNested]=useState(false),[surface,setSurface]=useState('');
return <div data-ui-preview={active?'nousa':undefined} className="min-h-screen bg-natural-bg text-natural-dark font-sans p-4"><nav className="flex gap-4"><Link to="/">Library</Link><Link to="/today">Today</Link><Link to="/review">Returns</Link><OriginalLink to={originalUrl(loc.pathname,loc.search,loc.hash)}>Original</OriginalLink></nav><PreviewRouteTransition active={active} pathname={loc.pathname}><section className="p-4"><h1>{loc.pathname}</h1><div data-preview-book data-preview-entry="true" className="rounded-xl border border-natural-border bg-natural-cream p-4">Fixture card</div><button data-preview-action onClick={()=>setModal(true)} className="min-h-11 rounded-xl bg-natural-sage text-white p-3">Open modal</button><button onClick={()=>setDrawer(true)}>Open journey</button><SortMenu value={sort} onChange={setSort}/><ChapterDropdown value={choice} onChange={setChoice} searchable label="Fixture choice" options={[{value:'one',label:'One'},{value:'two',label:'Two'}]}/><div className="flex gap-3">{["draft","use-card","checkout","podcast"].map(x=><button key={x} onClick={()=>setSurface(x)}>Open {x}</button>)}</div><button onClick={()=>setNested(true)}>Open nested</button><PricingFaq/><ReadingLensCard lens={{log_id:'fixture',analyst_summary:'Fixture reading summary',analysis:{durableInsights:[],argumentMap:[],assumptionsAndLimits:['Fixture assumption'],keyConcepts:[],questionsToCarryForward:[],confidenceNotes:[]}} as any} canEdit={false} onRetry={async()=>{}}/></section></PreviewRouteTransition><PreviewSurfacePresence active={active} open={modal} family="modal" portalSelector='[data-preview-portal="add-book"]'>{modal&&<AddBookModal onClose={()=>setModal(false)} onAdded={()=>{throw Error('forbidden fixture mutation')}} onToast={()=>{}}/>}</PreviewSurfacePresence><PreviewSurfacePresence active={active} open={Boolean(surface)} family="modal" portalSelector={`[data-preview-portal="${surface}"]`}>{surface==='draft'&&<ReferenceCardDraftModal bookId="fixture" logId="fixture" onClose={()=>setSurface('')} onSaved={()=>{}}/>}{surface==='use-card'&&<ReferenceCardUseSheet card={{cardType:'recipe'} as any} onClose={()=>setSurface('')} onSave={async()=>{throw Error('forbidden')}}/>}{surface==='checkout'&&<VietQrCheckoutSheet sku="fixture" onClose={()=>setSurface('')}/>}</PreviewSurfacePresence>{surface==='podcast'&&<PodcastPanel bookId="fixture" canEdit canGenerate isEpub onClose={()=>setSurface('')}/>}{nested&&<Nested close={()=>setNested(false)}/>}<JourneyDrawer open={drawer} onClose={()=>setDrawer(false)}/></div>}
function Nested({close}:{close:()=>void}){const[inner,setInner]=useState(false);useOverlayFocus(true,'[data-test-outer]',close);return <div data-test-outer role="dialog" tabIndex={-1} className="fixed inset-0 bg-natural-cream p-4"><button onClick={()=>setInner(true)}>Inner</button><button onClick={close}>Outer close</button>{inner&&<Inner close={()=>setInner(false)}/>}</div>}
function Inner({close}:{close:()=>void}){useOverlayFocus(true,'[data-test-inner]',close);return <div data-test-inner role="dialog" tabIndex={-1} className="fixed inset-10 bg-natural-bg p-4"><button onClick={close}>Inner close</button></div>}
createRoot(document.getElementById('root')!).render(<BrowserRouter><OnboardingProvider><Fixture/></OnboardingProvider></BrowserRouter>);
