import { config } from '../config.js';
import { getPool } from '../db.js';
import { TelegramRepository } from './repository.js';
import { BotClient } from './client.js';
import { Outbox } from './outbox.js';
import { Worker } from './worker.js';
import { schedulerTick } from './scheduler.js';
import { cleanup } from './cleanup.js';
let instance: Outbox|null=null;
export function telegramService() {
 if(!config.telegramEnvironment||config.telegramEnvironment!==config.appEnv||!config.telegramBotToken)return null;
 if(!instance){const repo=new TelegramRepository(getPool(),config.telegramEnvironment);instance=new Outbox(repo,new BotClient(config.telegramBotToken,repo),config.telegramChapterOrigin,config.telegramSenderEnabled);}
 return instance;
}
export async function startTelegram() {
 return startTelegramRuntime(telegramService(),config.telegramSchedulerEnabled);
}
/** Explicit service boundary also permits isolated startup fault fixtures. */
export async function startTelegramRuntime(service: Outbox|null,schedulerEnabled: boolean) {
 if(!service||!service.enabled&&!schedulerEnabled)return ()=>{};
 let ready=false;
 try{ready=service.origin.startsWith('https://')&&await service.repo.ready();}catch{/* Unavailable DB/schema must not take down application health. */}
 if(!ready){console.info('[telegram] V2 unavailable: migration/configuration required');return ()=>{};}
 const worker=new Worker(service);let running=false,stopped=false;
 const tick=async()=>{if(running||stopped)return;running=true;try{await cleanup(service.repo);if(schedulerEnabled&&service.enabled)await schedulerTick(service.repo,(owner,id,day)=>service.enqueue(owner,id,day));if(service.enabled)await worker.runOnce();}catch{console.warn('[telegram] background tick failed');}finally{running=false;}};
 const timer=setInterval(tick,30000);void tick();
 return ()=>{stopped=true;worker.stopped=true;clearInterval(timer);};
}
