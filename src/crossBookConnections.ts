import { query } from "./db.js";
import { callJsonLLM } from "./llm.js";
import { consumeUsage, releaseUsage, reserveUsage } from "./usage.js";

export const CROSS_BOOK_CONNECTIONS_SCHEMA_VERSION = 1;
export type Language = "vi" | "en";
export type ConnectionSource = { sourceType:string; sourceId:string; bookId:string; bookTitle:string; occurredAt:string; content:string };
type SourceRef = Pick<ConnectionSource,"sourceType"|"sourceId"|"bookId"|"bookTitle"|"occurredAt">;
export type CrossBookConnection = { title:string; synthesis:string; sourceRefs:SourceRef[] };
export type CrossBookArtifact = { id:string; schemaVersion:number; outputLanguage:Language; opening:string; connections:CrossBookConnection[]; carryForward:string[]; sourceBookCount:number; sourceSessionCount:number; generatedAt:string };
const clean=(value:unknown,max:number)=>typeof value==="string"?value.replace(/\s+/g," ").trim().slice(0,max):"";
const vietnamese=(value:string)=>/[ăâđêôơưáàảãạĂÂĐÊÔƠƯÁÀẢÃẠ]/.test(value);
export function resolveCrossBookLanguage(sources:ConnectionSource[]):Language{return vietnamese(sources.map(s=>s.content).join(" "))?"vi":"en";}
export function hasConnectionSource(sources:ConnectionSource[]){return new Set(sources.map(s=>s.bookId)).size>=2;}
export async function getCrossBookSource(ownerId:string):Promise<ConnectionSource[]>{
 const rows=(await query<any>(`WITH source_rows AS (
 SELECT 'log' source_type, rl.id::text source_id, b.id book_id, b.title book_title, rl.date::text occurred_at, concat_ws(E'\n',rl.summary,array_to_string(rl.key_insights,'; '),rl.notes,rl.quote) content
 FROM reading_log rl JOIN books b ON b.id=rl.book_id WHERE b.owner_id=$1
 UNION ALL SELECT 'lens',r.id::text,b.id,b.title,r.generated_at::text,concat_ws(E'\n',r.analyst_summary,r.analysis::text)
 FROM reading_lens_analyses r JOIN books b ON b.id=r.book_id WHERE b.owner_id=$1
 UNION ALL SELECT 'wiki',w.book_id::text,b.id,b.title,w.generated_at::text,concat_ws(E'\n',w.overview,w.book_so_far,w.carry_forward_insights::text,w.connections::text)
 FROM book_wiki w JOIN books b ON b.id=w.book_id WHERE b.owner_id=$1
 UNION ALL SELECT 'chunk',c.id::text,b.id,b.title,c.processed_at::text,c.chunk_analysis::text
 FROM ai_reader_chunks c JOIN books b ON b.id=c.book_id WHERE b.owner_id=$1
 ) SELECT * FROM source_rows WHERE COALESCE(content,'')<>'' ORDER BY occurred_at DESC LIMIT 60`,[ownerId])).rows;
 return rows.map((r:any)=>({sourceType:r.source_type,sourceId:r.source_id,bookId:r.book_id,bookTitle:r.book_title,occurredAt:r.occurred_at,content:clean(r.content,1800)})).filter((s:ConnectionSource)=>s.content);
}
export function buildCrossBookConnectionsPrompt(input:{language:Language;sources:ConnectionSource[]}){
 const material=input.sources.map(s=>`[${s.sourceType}:${s.sourceId}] BOOK=${s.bookTitle} DATE=${s.occurredAt}\n${s.content}`).join("\n\n").slice(0,50000);
 return `Create 1 to 3 meaningful cross-book connections from the reader's saved evidence. Write entirely in ${input.language==="vi"?"Vietnamese":"English"}. Use only supplied evidence; do not invent books, claims, quotes, or citations. Each connection must cite evidence from at least two distinct books. Return ONLY strict JSON: {"opening":"...","connections":[{"title":"...","synthesis":"...","sourceRefs":[{"sourceType":"...","sourceId":"..."}]}],"carryForward":["..."]}. Keep opening <= 900 chars, synthesis <= 1200 chars, 2-6 refs per connection, carryForward <= 5.`+`\n\nEVIDENCE\n${material}`;
}
export function parseCrossBookConnections(raw:string,language:Language,sources:ConnectionSource[]){
 let value:any;try{value=JSON.parse(raw)}catch{throw new Error("cross-book connections returned invalid JSON")}
 const allowed=new Map(sources.map(s=>[`${s.sourceType}:${s.sourceId}`,s]));
 const opening=clean(value.opening,900); if(!opening)throw new Error("cross-book connections missing opening");
 const connections=(Array.isArray(value.connections)?value.connections:[]).slice(0,3).map((item:any)=>{
   const refs=(Array.isArray(item?.sourceRefs)?item.sourceRefs:[]).slice(0,6).map((r:any)=>allowed.get(`${clean(r?.sourceType,30)}:${clean(r?.sourceId,100)}`)).filter(Boolean) as ConnectionSource[];
   const unique=Array.from(new Map(refs.map(s=>[`${s.sourceType}:${s.sourceId}`,s])).values());
   if(new Set(unique.map(s=>s.bookId)).size<2)return null;
   return {title:clean(item?.title,180),synthesis:clean(item?.synthesis,1200),sourceRefs:unique.map(s=>({sourceType:s.sourceType,sourceId:s.sourceId,bookId:s.bookId,bookTitle:s.bookTitle,occurredAt:s.occurredAt}))};
 }).filter((c:any)=>c&&c.title&&c.synthesis) as CrossBookConnection[];
 if(!connections.length)throw new Error("cross-book connections returned no valid multi-book evidence");
 const carryForward=(Array.isArray(value.carryForward)?value.carryForward:[]).slice(0,5).map((x:any)=>clean(x,400)).filter(Boolean);
 return {outputLanguage:language,opening,connections,carryForward};
}
export async function getCrossBookConnections(ownerId:string):Promise<(CrossBookArtifact&{requestKey:string})|null>{const row=(await query<any>("SELECT id,request_key,schema_version,payload,source_book_count,source_session_count,generated_at FROM cross_book_connections WHERE owner_id=$1",[ownerId])).rows[0];return row?{...row.payload,id:row.id,requestKey:row.request_key,schemaVersion:row.schema_version,sourceBookCount:Number(row.source_book_count),sourceSessionCount:Number(row.source_session_count),generatedAt:new Date(row.generated_at).toISOString()}:null;}
export async function generateCrossBookConnections(ownerId:string,requestKey?:unknown){const key=clean(requestKey,160)||`cross-book:${crypto.randomUUID()}`;const existing=await getCrossBookConnections(ownerId);if(existing?.requestKey===key)return {status:"existing" as const,connection:existing};const source=await getCrossBookSource(ownerId);if(!hasConnectionSource(source))return {status:"no_source" as const,connection:null};const reservation=await reserveUsage({userId:ownerId,feature:"cross_book_connections",requestKey:key,resource:{type:"cross_book_connections",id:"current"}});try{const language=resolveCrossBookLanguage(source);const parsed=parseCrossBookConnections(await callJsonLLM("You are a careful reading companion. Return strict JSON only.",buildCrossBookConnectionsPrompt({language,sources:source}),0.2),language,source);const bookCount=new Set(source.map(s=>s.bookId)).size;const sessionCount=source.filter(s=>s.sourceType==="log").length;const saved=(await query<any>(`INSERT INTO cross_book_connections(owner_id,request_key,schema_version,output_language,payload,source_book_count,source_session_count) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id) DO UPDATE SET request_key=EXCLUDED.request_key,schema_version=EXCLUDED.schema_version,output_language=EXCLUDED.output_language,payload=EXCLUDED.payload,source_book_count=EXCLUDED.source_book_count,source_session_count=EXCLUDED.source_session_count,generated_at=now(),updated_at=now() RETURNING id,generated_at`,[ownerId,key,CROSS_BOOK_CONNECTIONS_SCHEMA_VERSION,language,JSON.stringify(parsed),bookCount,sessionCount])).rows[0];await consumeUsage(reservation.id);return {status:"generated" as const,connection:{...parsed,id:saved.id,requestKey:key,schemaVersion:CROSS_BOOK_CONNECTIONS_SCHEMA_VERSION,sourceBookCount:bookCount,sourceSessionCount:sessionCount,generatedAt:new Date(saved.generated_at).toISOString()}};}catch(error){await releaseUsage(reservation.id,error instanceof Error?error.message:"generation failed");throw error;}}
