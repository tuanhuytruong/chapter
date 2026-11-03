import assert from 'node:assert/strict';
import {labJSON,validateLabScenario,reactLab,debriefLab} from '../src/bookLab.js';
// Isolated output-boundary tests, NOT provider-quality evidence. No DB imports.
const original=globalThis.fetch, url=process.env.NINE_ROUTER_URL;
process.env.NINE_ROUTER_URL='http://output-boundary.invalid';
let calls=0;let outputs:string[]=[];
globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:outputs.shift()||'{}'},finish_reason:'stop'}]}),{status:200});};
const validate=(v:any)=>{if(typeof v.response!=='string')throw Error('bad schema');return v.response;};
try{
 outputs=['{"response":,}','{"response":"repaired"}'];calls=0;
 assert.equal(await labJSON('Return {response:string}',{},validate),'repaired');assert.equal(calls,2);
 outputs=['{"response":[]}','{"response":[]}'];calls=0;
 await assert.rejects(()=>labJSON('Return {response:string}',{},validate),/after one repair/);assert.equal(calls,2);
 const source='Describe observable facts without judging the other person. Ask an open question and listen.';
 const input={eligible:true as const,userActor:'Alex, project lead',counterpartActor:'Sam, colleague',facts:[{id:'F1',owner:'USER',statement:'Alex has a layout ready.'},{id:'F2',owner:'COUNTERPART',statement:'Sam is waiting for instructions.'},{id:'F3',owner:'SHARED',statement:'The layout needs typography finalized.'}],goal:'Complete layout',principle:'Listen first',quote:'Describe observable facts without judging the other person.'};
 const s=validateLabScenario(input,source);if(!s.eligible)throw Error('fixture');
 assert.throws(()=>validateLabScenario({...input,constraints:['x']},source));
 assert.throws(()=>validateLabScenario({...input,extra:'hidden'},source));
 assert.throws(()=>validateLabScenario({...input,goal:'x'.repeat(1001)},source));
 assert.throws(()=>validateLabScenario({...input,quote:'Unsupported quotation exceeding twenty characters'},source));
 outputs=['{"response":"ok","hidden":"leak"}','{"response":"ok","hidden":"leak"}'];calls=0;
 await assert.rejects(()=>reactLab(s,[],'A valid answer','en'));assert.equal(calls,2);
 let sent='';globalThis.fetch=async(_url,init)=>{sent=String(init?.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({factIds:['F1'],evidence:['What blocked progress?'],observations:['You asked a question.'],sourceConnection:'Ask before proposing.',alternative:'Ask a more specific question.',tradeoff:'It takes more time.'})},finish_reason:'stop'}]}),{status:200});};
 const debrief=await debriefLab(s,[{answer:'What blocked progress?',response:'COUNTERPART_SECRET_RESPONSE'}],'en');
 assert.ok(debrief.includes('What blocked progress?'));assert.ok(!sent.includes('COUNTERPART_SECRET_RESPONSE'));assert.ok(sent.includes('userDecisions'));
 outputs=[JSON.stringify({speaker:'USER',factIds:['F1'],transition:'clarify',response:'ok'}),JSON.stringify({speaker:'COUNTERPART',factIds:['F99'],transition:'clarify',response:'ok'})];globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:outputs.shift()},finish_reason:'stop'}]}),{status:200});
 await assert.rejects(()=>reactLab(s,[],'Free text','en'));
 console.log('BOOK_LAB_OUTPUT_BOUNDARY_OK: repair bounded to two dispatches; malformed JSON, wrong types, extra keys, length and citation rejected. Mock fetch only, not quality evidence.');
}finally{globalThis.fetch=original;if(url===undefined)delete process.env.NINE_ROUTER_URL;else process.env.NINE_ROUTER_URL=url;}
