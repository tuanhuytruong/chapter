import type { TelegramRepository } from './repository.js';
export function localClock(date: Date,timezone: string) {
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return {day:`${v.year}-${v.month}-${v.day}`,time:`${v.hour}:${v.minute}`};
}
/** Search UTC minutes: first occurrence wins on folds; first valid later wall minute wins on gaps. */
export function runAt(day: string,time: string,timezone: string) {
 if(!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time))throw new Error('INVALID_TIME');
 const start=Date.parse(`${day}T00:00:00Z`)-15*3600000;
 for(let n=0;n<54*60;n++){ const d=new Date(start+n*60000),l=localClock(d,timezone); if(l.day===day&&l.time>=time)return d; }
 throw new Error('INVALID_LOCAL_DAY');
}
export function nextRun(now: Date,time: string,timezone: string) {
 const day=localClock(now,timezone).day, today=runAt(day,time,timezone);
 if(+today>+now)return today;
 const tomorrow=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);return runAt(tomorrow,time,timezone);
}
export async function schedulerTick(repo: TelegramRepository,enqueue: (owner:string,id:string,day:string)=>Promise<unknown>,now=new Date()) {
 const r=await repo.pool.query(`SELECT s.*,d.manager_user_id FROM chapter.telegram_subscriptions s JOIN chapter.telegram_destinations d ON d.environment=s.environment AND d.id=s.destination_id WHERE s.environment=$1 AND s.enabled AND d.state='active'`,[repo.environment]);
 for(const s of r.rows){
  const day=localClock(now,s.timezone).day;
  if(+now>=+runAt(day,s.local_time,s.timezone))await enqueue(s.manager_user_id,s.destination_id,day);
  await repo.pool.query('UPDATE chapter.telegram_subscriptions SET next_run_at=$3,updated_at=now() WHERE environment=$1 AND destination_id=$2 AND enabled',[repo.environment,s.destination_id,nextRun(now,s.local_time,s.timezone)]);
 }
 // No prior-day backlog. Reconcile every tick after due time, including late-ready summaries.
 await repo.pool.query(`UPDATE chapter.telegram_deliveries d SET state='expired',updated_at=now() FROM chapter.telegram_subscriptions s WHERE d.environment=$1 AND s.environment=d.environment AND s.destination_id=d.destination_id AND d.local_date < ($2::timestamptz AT TIME ZONE s.timezone)::date AND d.state IN ('pending','retry_wait','leased')`,[repo.environment,now]);
}
