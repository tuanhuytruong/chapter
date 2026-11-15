import type {TelegramRepository} from './repository.js';
export async function consumeRateLimit(repo:TelegramRepository,c:any,key:string,intervalMs:number){
 const r=await c.query(`INSERT INTO chapter.telegram_rate_limits(bot_key,scope,next_at) VALUES($1,$2,now()+$3*interval '1 millisecond') ON CONFLICT(bot_key,scope) DO UPDATE SET next_at=now()+$3*interval '1 millisecond',updated_at=now() WHERE telegram_rate_limits.next_at<=now() RETURNING scope`,[`request:${repo.environment}`,key,intervalMs]);
 return !!r.rowCount;
}
