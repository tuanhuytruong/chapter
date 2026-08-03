import { callJsonLLM } from "./llm.js";
import { query } from "./db.js";
import { consumeUsage, releaseUsage, reserveUsage } from "./usage.js";
import { periodKeyInAppTz } from "./entitlements.js";

export const MONTHLY_REVIEW_SCHEMA_VERSION = 1;
type Language = "vi" | "en";
export type MonthlyReview = { id:string; periodKey:string; schemaVersion:number; outputLanguage:Language; title:string; opening:string; themes:Array<{title:string;detail:string;evidence:string[]}>; books:Array<{bookId:string;title:string;sessions:number;contribution:string}>; carryForward:string[]; gentleNextStep:string; sourceSessionCount:number; generatedAt:string };
export type ReviewSource = { logId:string; bookId:string; bookTitle:string; date:string; session:number; summary:string; insights:string[]; notes:string|null; quote:string|null; lens:string|null };

const text=(v:unknown,max=1200)=>typeof v==='string'?v.trim().slice(0,max):'';
const arr=(v:unknown,max:number)=>Array.isArray(v)?v.slice(0,max).map(x=>text(x,500)).filter(Boolean):[];
export function periodBoundsInAppTz(period:string):{start:string;end:string}{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('invalid review period');
 const [y,m]=period.split('-').map(Number); const end=new Date(Date.UTC(y,m,1));
 return {start:`${period}-01`,end:`${end.getUTCFullYear()}-${String(end.getUTCMonth()+1).padStart(2,'0')}-01`};
}
export function hasReviewableMonthlySource(source:ReviewSource[]):boolean{return source.some(x=>x.summary||x.insights.length||x.notes||x.quote);}
export function buildMonthlyReviewPrompt(input:{periodKey:string;language:Language;source:ReviewSource[]}):string{
 const material=input.source.map(s=>`[${s.date} session ${s.session}] ${s.bookTitle}\nSummary: ${s.summary||'—'}\nInsights: ${s.insights.join('; ')||'—'}\nNotes: ${s.notes||'—'}\nQuote: ${s.quote||'—'}\nLens: ${s.lens||'—'}`).join('\n\n').slice(0,50000);
 return `Create a warm, grounded monthly reading review for ${input.periodKey}. Write entirely in ${input.language==='vi'?'Vietnamese':'English'}. Use only the saved source below; do not invent books, habits, emotions, or conclusions. Return ONLY valid JSON matching exactly: {"title":"...","opening":"...","themes":[{"title":"...","detail":"...","evidence":["..."]}],"books":[{"bookId":"...","title":"...","sessions":1,"contribution":"..."}],"carryForward":["..."],"gentleNextStep":"..."}. Keep it reflective, direct, and non-gamified. Evidence must quote or closely paraphrase supplied material.\n\nSOURCE\n${material}`;
}
export function parseMonthlyReview(raw:string,expectedLanguage:Language):Omit<MonthlyReview,'id'|'periodKey'|'schemaVersion'|'sourceSessionCount'|'generatedAt'> {
 let value:Record<string,unknown>; try { value=JSON.parse(raw); } catch { throw new Error('monthly review returned invalid JSON'); }
 const title=text(value.title,180), opening=text(value.opening,1800), next=text(value.gentleNextStep,600);
 if(!title||!opening||!next) throw new Error('monthly review missing required fields');
 const themes=Array.isArray(value.themes)?value.themes.slice(0,6).map((x:any)=>({title:text(x?.title,160),detail:text(x?.detail,900),evidence:arr(x?.evidence,4)})).filter(x=>x.title&&x.detail):[];
 const books=Array.isArray(value.books)?value.books.slice(0,20).map((x:any)=>({bookId:text(x?.bookId,100),title:text(x?.title,180),sessions:Math.max(0,Math.floor(Number(x?.sessions)||0)),contribution:text(x?.contribution,700)})).filter(x=>x.title&&x.contribution):[];
 return {outputLanguage:expectedLanguage,title,opening,themes,books,carryForward:arr(value.carryForward,8),gentleNextStep:next};
}
export async function getMonthlyReview(ownerId:string,periodKey=periodKeyInAppTz()):Promise<MonthlyReview|null>{
 const row=(await query<any>('SELECT id,period_key,schema_version,payload,source_session_count,generated_at FROM monthly_reviews WHERE owner_id=$1 AND period_key=$2',[ownerId,periodKey])).rows[0];
 if(!row)return null; return {...row.payload,id:row.id,periodKey:row.period_key,schemaVersion:row.schema_version,sourceSessionCount:Number(row.source_session_count),generatedAt:new Date(row.generated_at).toISOString()};
}
export async function getMonthlyReviewSource(ownerId:string,periodKey=periodKeyInAppTz()):Promise<ReviewSource[]>{
 const {start,end}=periodBoundsInAppTz(periodKey);
 const rows=(await query<any>(`SELECT rl.id log_id,rl.book_id, b.title book_title,rl.date::text date,rl.session,COALESCE(rl.summary,'') summary,rl.key_insights insights,rl.notes,rl.quote,rla.analyst_summary lens FROM reading_log rl JOIN books b ON b.id=rl.book_id LEFT JOIN reading_lens_analyses rla ON rla.log_id=rl.id AND rla.schema_version=1 WHERE b.owner_id=$1 AND rl.date >= $2::date AND rl.date < $3::date ORDER BY rl.date,rl.session LIMIT 200`,[ownerId,start,end])).rows;
 return rows.map((r:any)=>({logId:r.log_id,bookId:r.book_id,bookTitle:r.book_title,date:r.date,session:Number(r.session),summary:text(r.summary),insights:Array.isArray(r.insights)?r.insights.map((x:string)=>text(x,500)).filter(Boolean):[],notes:r.notes?text(r.notes):null,quote:r.quote?text(r.quote):null,lens:r.lens?text(r.lens):null}));
}
export async function generateMonthlyReview(ownerId:string,periodKey=periodKeyInAppTz(),requestKey=`monthly-review:${periodKey}`){
 // The monthly quota is one durable artifact. Returning an existing review makes
 // double-clicks/retries idempotent and prevents a consumed request key from
 // silently triggering extra provider work.
 const existing=await getMonthlyReview(ownerId,periodKey);
 if(existing) return {status:'existing' as const,review:existing};
 const source=await getMonthlyReviewSource(ownerId,periodKey); if(!hasReviewableMonthlySource(source)) return {status:'no_source' as const,review:null};
 const language=source.some(x=>/[ăâđêôơưáàảãạ]/i.test(`${x.summary} ${x.notes||''}`))?'vi':'en';
 const reservation=await reserveUsage({userId:ownerId,feature:'monthly_review_generation',requestKey,resource:{type:'monthly_review',id:periodKey}});
 try { const parsed=parseMonthlyReview(await callJsonLLM('You are a thoughtful reading companion. Return strict JSON only.',buildMonthlyReviewPrompt({periodKey,language,source}),0.25),language); const saved=(await query<any>(`INSERT INTO monthly_reviews (owner_id,period_key,schema_version,output_language,payload,source_session_count) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (owner_id,period_key) DO UPDATE SET schema_version=EXCLUDED.schema_version,output_language=EXCLUDED.output_language,payload=EXCLUDED.payload,source_session_count=EXCLUDED.source_session_count,generated_at=now(),updated_at=now() RETURNING id,generated_at`,[ownerId,periodKey,MONTHLY_REVIEW_SCHEMA_VERSION,language,JSON.stringify(parsed),source.length])).rows[0]; await consumeUsage(reservation.id); return {status:'generated' as const,review:{...parsed,id:saved.id,periodKey,schemaVersion:MONTHLY_REVIEW_SCHEMA_VERSION,sourceSessionCount:source.length,generatedAt:new Date(saved.generated_at).toISOString()}}; }
 catch(error){await releaseUsage(reservation.id,error instanceof Error?error.message:'generation failed'); throw error;}
}
