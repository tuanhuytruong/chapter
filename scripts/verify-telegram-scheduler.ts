import assert from 'node:assert/strict';
import {runAt,nextRun,localClock,schedulerTick} from '../src/telegram/scheduler.js';
import {fixture,OWNER,LOG} from './fixtures/telegram-v2.js';
assert.equal(runAt('2026-03-08','02:30','America/New_York').toISOString(),'2026-03-08T07:00:00.000Z');
assert.equal(runAt('2026-11-01','01:30','America/New_York').toISOString(),'2026-11-01T05:30:00.000Z');
assert.equal(runAt('2026-11-15','20:00','Asia/Bangkok').toISOString(),'2026-11-15T13:00:00.000Z');
assert.equal(nextRun(new Date('2026-11-01T06:15:00Z'),'01:30','America/New_York').toISOString(),'2026-11-02T06:30:00.000Z');
const f=await fixture();try{const {d}=await f.seed();let calls=0;
 const now=new Date();const enqueue=async(o:string,id:string,day:string)=>{calls++;return f.outbox.enqueue(o,id,day);};
 await Promise.all([schedulerTick(f.repo,enqueue,now),schedulerTick(f.repo,enqueue,now)]);assert.equal(calls,2);assert.equal((await f.pool.query('SELECT count(*) FROM chapter.telegram_deliveries')).rows[0].count,'1');
 await f.pool.query("INSERT INTO chapter.reading_log SELECT gen_random_uuid(),book_id,date,2,reading_round,page_start,page_end,summary,key_insights,quote,now() FROM chapter.reading_log WHERE id=$1",[LOG]);await schedulerTick(f.repo,enqueue,now);assert.equal((await f.pool.query('SELECT count(*) FROM chapter.telegram_deliveries')).rows[0].count,'2');
 await schedulerTick(f.repo,enqueue,new Date(+now+86400000));assert.equal((await f.pool.query("SELECT count(*) FROM chapter.telegram_deliveries WHERE state='expired'")).rows[0].count,'2');
 console.log('PASS exact DST gap/fold, Bangkok, concurrent scheduler dedup, late summary reconciliation, no prior-day backlog');
}finally{await f.close();}
