import assert from 'node:assert/strict';
import {planLab,labJSON,LabValidationError,validateLabScenario,validateLabContinuity} from '../src/bookLab.js';
const source='Before accepting another task, list the work already promised and estimate the available time. Explain the capacity limit without blaming the requester.';
const world={userActor:'Alex',counterpartActor:'Jordan',facts:[{id:'F1',owner:'USER',statement:'Alex has 3 hours committed to a report.'},{id:'F2',owner:'COUNTERPART',statement:'Jordan requests 2 hours for a spreadsheet.'},{id:'F3',owner:'USER',statement:'Alex has 30 minutes of unallocated time.'}],goal:'Complete spreadsheet'};
const lesson={eligible:true,domain:'capacity',principle:'State limits and negotiate scope',quote:'Explain the capacity limit without blaming the requester.'};
const scenario=validateLabScenario({eligible:true,...world,principle:lesson.principle,quote:lesson.quote},source);if(!scenario.eligible)throw Error('fixture');
assert.throws(()=>validateLabContinuity('You have only 30 minutes left.',scenario,''),/NUMERIC_QUALIFIER/);
validateLabContinuity('You have 30 minutes of unallocated time.',scenario,'');
assert.throws(()=>validateLabContinuity('I know you are stressed.',scenario,''),/UNSUPPORTED_EMOTION/);
validateLabContinuity('You said you are stressed.',scenario,'I am stressed');
assert.throws(()=>validateLabScenario({eligible:true,...world,goal:'Avoid overcommitment',principle:lesson.principle,quote:lesson.quote},source),/VISIBLE_INSTRUCTION/);
const original=globalThis.fetch,url=process.env.NINE_ROUTER_URL;process.env.NINE_ROUTER_URL='http://boundary.invalid';
let count=0;const bodies:string[]=[];
try {
 globalThis.fetch=async(_url,init)=>{bodies.push(String(init?.body));return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(count++===0?lesson:world)},finish_reason:'stop'}]}));};
 const result=await planLab(source,'English');assert.equal(result.eligible,true);assert.equal(count,2);
 assert.ok(!bodies[1].includes(source));assert.ok(!bodies[1].includes(lesson.principle));assert.ok(!bodies[1].includes(lesson.quote));
 count=0;globalThis.fetch=async()=>{count++;return new Response(JSON.stringify({choices:[{message:{content:'{"private":"DO_NOT_LOG_PRIVATE"}'},finish_reason:'stop'}]}));};
 await assert.rejects(()=>labJSON('test',{},()=>{throw Error('DO_NOT_LOG_PRIVATE');},'world'),(e:any)=>e instanceof LabValidationError&&e.stage==='world'&&e.attempts===2&&e.codes.every((c:string)=>c==='VALIDATION')&&!e.message.includes('DO_NOT_LOG_PRIVATE'));
 assert.equal(count,2);
 delete process.env.NINE_ROUTER_URL;
 await assert.rejects(()=>labJSON('test',{},v=>v,'lesson'),(e:any)=>e instanceof LabValidationError&&e.codes[0]==='PROVIDER_NOT_CONFIGURED'&&e.attempts===1);
 console.log('BOOK_LAB_V8_OK: world/private input separation; numeric qualifiers; emotions; visible goal; sanitized stage errors; two-dispatch cap. Mock-only boundary tests.');
}finally{globalThis.fetch=original;if(url===undefined)delete process.env.NINE_ROUTER_URL;else process.env.NINE_ROUTER_URL=url;}
