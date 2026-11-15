import { hash, type TelegramRepository } from './repository.js';
export class BotError extends Error {
 constructor(public code: string,public outcome: 'rejected'|'retry'|'unknown',public retryAfter=0) { super(code); }
}
/** Same bot shares durable reservations across environments and all outbound modules. */
export class BotClient {
 public key: string;
 constructor(private token: string,private repo: TelegramRepository,private transport: typeof fetch=fetch,private origin='https://api.telegram.org') { this.key=hash(token); }
 async reserve(chat: string, group: boolean,guard?:()=>Promise<boolean>,alive:()=>boolean=()=>true) {
  for(;;){
   if(!alive() || guard && !await guard())throw new BotError('STALE_OR_REVOKED','rejected');
   const wait=await this.repo.transaction(async c=>{
    const scopes: [string,number][]=[['bot',51],[`chat:${chat}`,group?3100:1050]];
    for(const [scope] of scopes)await c.query('INSERT INTO chapter.telegram_rate_limits(bot_key,scope,next_at) VALUES($1,$2,now()) ON CONFLICT DO NOTHING',[this.key,scope]);
    const r=await c.query('SELECT scope,next_at,clock_timestamp() AS db_now FROM chapter.telegram_rate_limits WHERE bot_key=$1 AND scope=ANY($2) ORDER BY scope FOR UPDATE',[this.key,scopes.map(x=>x[0])]);
    const now=+new Date(r.rows[0].db_now),at=Math.max(now,...r.rows.map(x=>+new Date(x.next_at)));
    if(at>now)return at-now;
    for(const [scope,ms] of scopes)await c.query('UPDATE chapter.telegram_rate_limits SET next_at=$3,updated_at=now() WHERE bot_key=$1 AND scope=$2',[this.key,scope,new Date(now+ms)]);
    return 0;
   });
   if(!wait)return;
   await new Promise(r=>setTimeout(r,Math.min(wait+1,250)));
   // Recheck shared cooldown on wake: another process may have received 429 meanwhile.
  }
 }
 async cooldown(chat: string,seconds: number) { await this.repo.pool.query("INSERT INTO chapter.telegram_rate_limits(bot_key,scope,next_at) SELECT $1,scope,clock_timestamp()+$3*interval '1 second' FROM unnest($2::text[]) scope ON CONFLICT(bot_key,scope) DO UPDATE SET next_at=greatest(telegram_rate_limits.next_at,EXCLUDED.next_at),updated_at=now()",[this.key,['bot',`chat:${chat}`],seconds]); }
 async call(method: string,payload: any, options: {outbound?: boolean; group?: boolean; beforeDispatch?: ()=>Promise<boolean>; canDispatch?:()=>boolean}={}) {
  const chat=String(payload.chat_id ?? payload.get?.('chat_id'));
  const alive=options.canDispatch||(()=>true);
  // A session advisory lock (not a transaction) serializes the actual dispatch
  // boundary across processes/environments. Hold through response + pacing update;
  // late guards cannot accumulate reserved slots and burst. Crash releases the lock.
  let lock:import('pg').PoolClient|null=null;
  let locked=false;
  const ac=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try {
   if(options.outbound){
    for(;;){
     if(!alive())throw new BotError('STALE_OR_REVOKED','rejected');
     lock=await this.repo.pool.connect();
     const r=await lock.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',[`telegram-dispatch:${this.key}`]);
     if(r.rows[0].locked){locked=true;break;}
     lock.release();lock=null;
     await new Promise(r=>setTimeout(r,50));
    }
    await this.reserve(chat,!!options.group,options.beforeDispatch,alive);
   }else if(options.beforeDispatch&&!await options.beforeDispatch())throw new BotError('STALE_OR_REVOKED','rejected');
   if(!alive())throw new BotError('STALE_OR_REVOKED','rejected');
   timer=setTimeout(()=>ac.abort(),10000);
   const form=payload instanceof FormData;
   const response=await this.transport(`${this.origin}/bot${this.token}/${method}`,{method:'POST',headers:form?undefined:{'Content-Type':'application/json'},body:form?payload:JSON.stringify(payload),signal:ac.signal});
   const body:any=await response.json();
   if(!response.ok||!body.ok) {
    const code=Number(body.error_code||response.status);
    if(code===429){ const seconds=Math.max(1,Number(body.parameters?.retry_after)||1); await this.cooldown(String(payload.chat_id??payload.get?.('chat_id')),seconds); throw new BotError('RATE_LIMITED','retry',seconds); }
    if(code>=500)throw new BotError('UPSTREAM_UNCERTAIN','unknown');
    const error=String(body.description||'').toLowerCase();
    throw new BotError(error.includes('parse entities')?'PARSE_REJECTED':code===403?'PERMISSION_REJECTED':'API_REJECTED','rejected');
   }
   return body.result;
  }catch(e){if(e instanceof BotError)throw e; throw new BotError('TRANSPORT_UNCERTAIN','unknown');}finally{
   clearTimeout(timer);
   if(lock){try{
    if(locked){
     // Measure spacing conservatively from completion, never reservation time.
     await lock.query("UPDATE chapter.telegram_rate_limits SET next_at=greatest(next_at,clock_timestamp()+CASE WHEN scope='bot' THEN 51 ELSE $3 END*interval '1 millisecond') WHERE bot_key=$1 AND scope=ANY($2)",[this.key,['bot',`chat:${chat}`],options.group?3100:1050]);
     await lock.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[`telegram-dispatch:${this.key}`]);
    }
    lock.release();
   }catch{lock.release(true);}}
  }
 }
}
