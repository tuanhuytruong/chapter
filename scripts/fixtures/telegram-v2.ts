import {Pool} from 'pg';
import fs from 'node:fs/promises';
import {TelegramRepository} from '../../src/telegram/repository.js';
import {BotClient} from '../../src/telegram/client.js';
import {Outbox} from '../../src/telegram/outbox.js';
export const OWNER='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222',BOOK='33333333-3333-4333-8333-333333333333',LOG='44444444-4444-4444-8444-444444444444';
export async function fixture(){
 const connection=process.env.TELEGRAM_TEST_DATABASE_URL;
 if(!connection)throw new Error('Explicit TELEGRAM_TEST_DATABASE_URL required');
 const url=new URL(connection);if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/telegram_v2_fixture'||url.port!=='55439')throw new Error('Refusing non-disposable DB');
 const pool=new Pool({connectionString:connection,max:12});
 await pool.query('DROP SCHEMA IF EXISTS chapter CASCADE;CREATE SCHEMA chapter;CREATE TABLE chapter.users(id uuid PRIMARY KEY,environment text);CREATE TABLE chapter.books(id uuid PRIMARY KEY,owner_id uuid,title text,author text,status text,current_reading_round integer);CREATE TABLE chapter.reading_log(id uuid PRIMARY KEY,book_id uuid,date date,session integer,reading_round integer,page_start integer,page_end integer,summary text,key_insights text[],quote text,created_at timestamptz DEFAULT now());');
 await pool.query(await fs.readFile(new URL('../../migrations/2026-11-15-telegram-delivery-v2.sql',import.meta.url),'utf8'));
 await pool.query('INSERT INTO chapter.users VALUES($1,\'dev\'),($2,\'dev\')',[OWNER,OTHER]);
 await pool.query("INSERT INTO chapter.books VALUES($1,$2,'Synthetic book','QA','active',1)",[BOOK,OWNER]);
 const repo=new TelegramRepository(pool,'dev');let sends:any[]=[],fault:string|null=null,hook:(()=>Promise<void>)|null=null;
 const fake:typeof fetch=async(url:any,init:any)=>{
  const method=String(url).split('/').pop();const payload=JSON.parse(init.body);let result:any={};
  if(method==='getMe')result={id:900,username:'FixtureBot'};
  else if(method==='getChat')result={id:payload.chat_id,type:String(payload.chat_id).startsWith('-100')?'channel':String(payload.chat_id).startsWith('-')?'supergroup':'private',is_forum:true,title:'Synthetic destination'};
  else if(method==='getChatMember')result={status:fault==='permission'?'left':'administrator',can_post_messages:true};
  else if(method==='sendMessage'){
   if(fault==='timeout')throw new Error('synthetic transport');
   if(fault==='429')return new Response(JSON.stringify({ok:false,error_code:429,parameters:{retry_after:1}}),{status:429});
   if(fault==='parse'&&payload.parse_mode){return new Response(JSON.stringify({ok:false,error_code:400,description:'Bad Request: can\'t parse entities'}),{status:400});}
   sends.push(payload);if(hook)await hook();result={message_id:sends.length};
  }
  return new Response(JSON.stringify({ok:true,result}),{status:200});
 };
 const bot=new BotClient('synthetic-token',repo,fake),outbox=new Outbox(repo,bot,'https://chapter.example',true);
 return {pool,repo,bot,outbox,sends,setFault:(f:string|null)=>{fault=f;},setHook:(h:(()=>Promise<void>)|null)=>{hook=h;},async seed(){
  const identity=(await pool.query("INSERT INTO chapter.telegram_identities(environment,user_id,telegram_user_id,private_chat_id) VALUES('dev',$1,'123','123') RETURNING *",[OWNER])).rows[0];
  const d=(await pool.query("INSERT INTO chapter.telegram_destinations(environment,manager_user_id,identity_id,chat_id,type,label,state,activated_at) VALUES('dev',$1,$2,'123','private','Synthetic','active',now()-interval '1 day') RETURNING *",[OWNER,identity.id])).rows[0];
  await pool.query("INSERT INTO chapter.telegram_book_grants(environment,destination_id,book_id,granted_by) VALUES('dev',$1,$2,$3)",[d.id,BOOK,OWNER]);
  await pool.query("INSERT INTO chapter.telegram_subscriptions(environment,destination_id,local_time,timezone,enabled,next_run_at) VALUES('dev',$1,'00:00','Asia/Bangkok',true,now())",[d.id]);
  await pool.query("INSERT INTO chapter.reading_log VALUES($1,$2,(now() AT TIME ZONE 'Asia/Bangkok')::date,1,1,1,5,$3,ARRAY['Insight'],NULL,now())",[LOG,BOOK,'Synthetic summary '.repeat(500)]);
  return {identity,d};
 },async close(){await pool.end();}};
}
