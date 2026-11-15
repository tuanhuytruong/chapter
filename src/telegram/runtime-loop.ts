import type { Outbox } from './outbox.js';
import { Worker } from './worker.js';
import { schedulerTick } from './scheduler.js';
import { cleanup } from './cleanup.js';
/** Explicit service boundary also permits isolated startup fault fixtures. */
export async function startTelegramRuntime(service: Outbox|null,schedulerEnabled: boolean) {
 if(!service||!service.enabled&&!schedulerEnabled)return ()=>{};
 let ready=false;
 try{ready=service.origin.startsWith('https://')&&await service.repo.ready();}catch{/* Unavailable DB/schema must not take down application health. */}
 if(!ready){console.info('[telegram] V2 unavailable: migration/configuration required');return ()=>{};}
 const worker=new Worker(service);let running=false,stopped=false,inflight:Promise<void>|null=null;
 const tick=async()=>{if(running||stopped)return;running=true;try{await cleanup(service.repo);if(schedulerEnabled&&service.enabled)await schedulerTick(service.repo,(owner,id,day)=>service.enqueue(owner,id,day));if(service.enabled)await worker.runOnce();}catch{console.warn('[telegram] background tick failed');}finally{running=false;}};
 const launch=()=>{if(!running&&!stopped)inflight=tick();};
 const timer=setInterval(launch,30000);launch();
 return async()=>{stopped=true;worker.stopped=true;clearInterval(timer);
  let deadline:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([inflight,new Promise<void>(r=>{deadline=setTimeout(r,12000);})]);}finally{clearTimeout(deadline);}
 };
}
