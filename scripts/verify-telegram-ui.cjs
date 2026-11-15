const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const {build}=await import('vite');await build({configFile:false,plugins:[(await import('@tailwindcss/vite')).default()],build:{outDir:'.telegram-fixture-dist',rollupOptions:{input:'scripts/telegram-v2/fixture.html'}}});
 const {chromium}=require('/usr/lib/node_modules/playwright');const browser=await chromium.launch({headless:true,executablePath:'/home/huytt/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'});fs.mkdirSync('telegram-evidence',{recursive:true});const evidence=[];
 for(const width of [1440,390,360])for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];let linked=false,active=0,max=0,fail=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const u=new URL(route.request().url()),req=route.request();if(u.pathname.startsWith('/api/')){
   let data={};if(u.pathname.endsWith('/status')){active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,40));active--;if(fail)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'MIGRATION_REQUIRED'})});data={available:true,connected:linked,senderEnabled:false,destinations:linked?[{id:'synthetic-id',label:'Synthetic QA destination',type:'supergroup',thread_id:3,state:'paused'}]:[]};}
   else if(u.pathname.endsWith('/link'))data={url:'https://t.me/FixtureBot?start=chapter_synthetic',expires_in_seconds:5};
   else if(u.pathname.endsWith('/config'))data={grants:[],subscription:null};
   else if(u.pathname.endsWith('/history'))data=[{id:'delivery',local_date:'2026-11-15',state:'unknown',parts:[{index:0,state:'sent'},{index:1,state:'unknown'}]}];
   else if(u.pathname==='/api/books')data=[{id:'book',title:'Synthetic book'}];
   else if(req.method()==='DELETE')linked=false;
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  }
  if(u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
  let file=path.join(process.cwd(),'.telegram-fixture-dist',u.pathname==='/'?'scripts/telegram-v2/fixture.html':u.pathname);if(!fs.existsSync(file))return route.abort();return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});
  });
  await page.goto('https://chapter-fixture.example/');await page.evaluate(t=>document.documentElement.classList.toggle('dark',t==='dark'),theme);
  await page.getByRole('button',{name:'Connect / Retry'}).click();await page.getByRole('link',{name:'Open bot'}).waitFor();linked=true;await page.getByRole('button',{name:'Disconnect',exact:true}).waitFor({timeout:8000});
  await page.getByText('Configure books and daily schedule').click();await page.getByText('Synthetic book',{exact:true}).waitFor();assert.equal(await page.getByRole('checkbox',{name:/Enable subscription/}).isChecked(),false);await page.getByRole('checkbox',{name:'Synthetic book',exact:true}).check();await page.keyboard.press('Tab');
  await page.getByText('Delivery history · per part').click();await page.getByText('May already have been sent.',{exact:false}).waitFor();assert(await page.getByRole('button',{name:'Send test (no book content)'}).isDisabled());
  const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert(size.scroll<=size.client,JSON.stringify(size));assert(max<=1);assert.deepEqual(errors,[]);await page.screenshot({path:`telegram-evidence/ui-${width}-${theme}.png`,fullPage:true});evidence.push({width,theme,size,maxConcurrentPoll:max,pageerrors:errors});await page.close();
 }
 // Owner switch must discard both existing authority state and late async results.
 const page=await browser.newPage();let pending=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());
  if(u.pathname.startsWith('/api/')){
   if(u.pathname.endsWith('/destination-link')||u.pathname.endsWith('/channels/verify')){pending.push(route);return;}
   const data=u.pathname.endsWith('/status')?{connected:true,senderEnabled:false,destinations:[]}:[];
   return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  }
  if(u.hostname==='fonts.googleapis.com')return route.fulfill({contentType:'text/css',body:''});
  const file=path.join(process.cwd(),'.telegram-fixture-dist',u.pathname==='/'?'scripts/telegram-v2/fixture.html':u.pathname);
  if(!fs.existsSync(file))return route.abort();return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});
 });
 await page.goto('https://chapter-fixture.example/');await page.getByRole('button',{name:'Create group / topic bind code'}).click();
 await page.getByRole('textbox',{name:'Channel @username or ID'}).fill('@synthetic');await page.getByRole('button',{name:'Verify channel permissions'}).click();
 await page.waitForTimeout(100);assert.equal(pending.length,2);
 await page.getByRole('button',{name:'Switch fixture owner'}).click();await page.getByRole('button',{name:'Create group / topic bind code'}).waitFor();
 for(const route of pending)await route.fulfill({contentType:'application/json',body:JSON.stringify({command:'synthetic-secret-command',candidate:'synthetic-candidate',label:'synthetic-old-candidate'})});
 await page.waitForTimeout(200);assert.equal(await page.getByText('synthetic-old-candidate',{exact:false}).count(),0);assert.equal(await page.getByText('synthetic-secret-command',{exact:false}).count(),0);
 assert.equal(await page.getByRole('textbox',{name:'Channel @username or ID'}).inputValue(),'');assert.equal(await page.getByRole('button',{name:'Confirm verified channel'}).count(),0);assert.deepEqual(errors,[]);
 await page.close();console.log('PASS owner-switch late bind/channel response isolation');
 await browser.close();fs.writeFileSync('telegram-evidence/ui.json',JSON.stringify(evidence,null,2));console.log('PASS real browser 6 fixture cases: connect polling, default OFF, consent editor, unknown history, disabled sends, keyboard, overflow, no pageerrors');
})().catch(e=>{console.error(e);process.exitCode=1;});
