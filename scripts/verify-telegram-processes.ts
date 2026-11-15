import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fixture,OWNER} from './fixtures/telegram-v2.js';
const f=await fixture();try{const {d}=await f.seed();await f.outbox.enqueue(OWNER,d.id);
 const run=()=>new Promise<any>((resolve,reject)=>{const p=spawn(process.execPath,['--import','tsx','scripts/telegram-v2/claim.ts'],{env:process.env});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('exit',code=>code?reject(new Error(err)):resolve(JSON.parse(out)));});
 const results=await Promise.all([run(),run()]);assert.equal(results.filter(r=>r.claimed).length,1);console.log('PASS two independent Node processes: exactly one PostgreSQL claim winner');
}finally{await f.close();}
