import { hash, type TelegramRepository } from './repository.js';
export class BotError extends Error {
 constructor(public code: string,public outcome: 'rejected'|'retry'|'unknown',public retryAfter=0) { super(code); }
}
/** Same bot shares durable reservations across environments and all outbound modules. */
export class BotClient {
 public key: string;
 constructor(private token: string,private repo: TelegramRepository,private transport: typeof fetch=fetch,private origin='https://api.telegram.org') { this.key=hash(token); }
 async reserve(chat: string, group: boolean) {
  for(;;){
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
   await new Promise(r=>setTimeout(r,wait+1));
   // Recheck shared cooldown on wake: another process may have received 429 meanwhile.
  }
 }
 async cooldown(chat: string,seconds: number) { await this.repo.pool.query("UPDATE chapter.telegram_rate_limits SET next_at=greatest(next_at,now()+$3*interval '1 second'),updated_at=now() WHERE bot_key=$1 AND scope=ANY($2)",[this.key,['bot',`chat:${chat}`],seconds]); }
 async call(method: string,payload: any, options: {outbound?: boolean; group?: boolean; beforeDispatch?: ()=>Promise<boolean>}={}) {
  if(options.outbound)await this.reserve(String(payload.chat_id ?? payload.get?.('chat_id')),!!options.group);
  if(options.beforeDispatch && !await options.beforeDispatch())throw new BotError('STALE_OR_REVOKED','rejected');
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),10000);
  try {
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
  }catch(e){if(e instanceof BotError)throw e; throw new BotError('TRANSPORT_UNCERTAIN','unknown');}finally{clearTimeout(timer);}
 }
}
