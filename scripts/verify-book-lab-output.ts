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
 const s={eligible:true as const,opening:'A teammate misses a deadline.',role:'Project lead',goal:'Agree on delivery',constraints:'One day left',principle:'Listen first',quote:'Describe observable facts without judging the other person.'};
 assert.throws(()=>validateLabScenario({...s,constraints:['x']},source));
 assert.throws(()=>validateLabScenario({...s,extra:'hidden'},source));
 assert.throws(()=>validateLabScenario({...s,opening:'x'.repeat(1001)},source));
 assert.throws(()=>validateLabScenario({...s,quote:'Unsupported quotation exceeding twenty characters'},source));
 outputs=['{"response":"ok","hidden":"leak"}','{"response":"ok","hidden":"leak"}'];calls=0;
 await assert.rejects(()=>reactLab(s,[],'A valid answer','en'));assert.equal(calls,2);
 let sent='';globalThis.fetch=async(_url,init)=>{sent=String(init?.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({observations:['You asked a question.'],sourceConnection:'Ask before proposing.',alternative:'Ask a more specific question.',tradeoff:'It takes more time.'})},finish_reason:'stop'}]}),{status:200});};
 const debrief=await debriefLab(s,[{answer:'What blocked progress?',response:'COUNTERPART_SECRET_RESPONSE'}],'en');
 assert.ok(debrief.includes('What blocked progress?'));assert.ok(!sent.includes('COUNTERPART_SECRET_RESPONSE'));assert.ok(sent.includes('userDecisions'));
 console.log('BOOK_LAB_OUTPUT_BOUNDARY_OK: repair bounded to two dispatches; malformed JSON, wrong types, extra keys, length and citation rejected. Mock fetch only, not quality evidence.');
}finally{globalThis.fetch=original;if(url===undefined)delete process.env.NINE_ROUTER_URL;else process.env.NINE_ROUTER_URL=url;}
