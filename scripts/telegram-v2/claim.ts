import {Pool} from 'pg';
import {TelegramRepository} from '../../src/telegram/repository.js';
import {BotClient} from '../../src/telegram/client.js';
import {Outbox} from '../../src/telegram/outbox.js';
import {Worker} from '../../src/telegram/worker.js';
const connection=process.env.TELEGRAM_TEST_DATABASE_URL;
if(!connection)throw new Error('Explicit fixture URL required');const url=new URL(connection);if(url.hostname!=='127.0.0.1'||url.port!=='55439'||url.pathname!=='/telegram_v2_fixture')throw new Error('Disposable fixture only');
const pool=new Pool({connectionString:connection});try{const repo=new TelegramRepository(pool,'dev'),bot=new BotClient('synthetic',repo),worker=new Worker(new Outbox(repo,bot,'https://chapter.example',true));const job=await worker.claim();console.log(JSON.stringify({claimed:!!job,token:job?.lease_token||null}));}finally{await pool.end();}
