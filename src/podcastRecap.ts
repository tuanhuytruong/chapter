import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { query } from "./db.js";
import { callJsonLLM } from "./llm.js";
import { consumeUsage, releaseUsage, reserveUsage } from "./usage.js";
import { synthesizePodcast } from "./podcast/tts.js";
import { config } from "./config.js";

export type RecapLanguage = "vi" | "en";
export type RecapSource = { sourceType:string; sourceId:string; bookId:string; bookTitle:string; occurredAt:string; content:string };
export type PodcastRecap = { id:string; requestKey:string; status:string; outputLanguage:RecapLanguage; voiceModel:string; payload:any; sourceBookCount:number; sourceSessionCount:number; scriptText:string|null; durationS:number|null; hasAudio:boolean; generatedAt:string };
const clean=(v:unknown,max:number)=>typeof v === "string" ? v.replace(/\s+/g," ").trim().slice(0,max) : "";
const vi=(s:string)=>/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởợúùủũụứừửữựýỳỷỹỵ]/i.test(s);
const voices={vi:{female:"edge-tts/vi-VN-HoaiMyNeural",male:"edge-tts/vi-VN-NamMinhNeural"},en:{female:"edge-tts/en-US-JennyNeural",male:"edge-tts/en-US-ChristopherNeural"}} as const;

export async function getPodcastRecapSources(ownerId:string):Promise<RecapSource[]> {
  const rows=(await query<any>(`WITH sources AS (
    SELECT 'log' source_type, rl.id::text source_id, b.id::text book_id, b.title book_title, rl.date::text occurred_at,
      concat_ws(E'\\n', NULLIF(rl.summary,''), array_to_string(rl.key_insights,'; '), NULLIF(rl.notes,''), NULLIF(rl.quote,'')) content
    FROM reading_log rl JOIN books b ON b.id=rl.book_id WHERE b.owner_id=$1
    UNION ALL
    SELECT 'lens', r.log_id::text, b.id::text, b.title, r.generated_at::text, r.analyst_summary
    FROM reading_lens_analyses r JOIN books b ON b.id=r.book_id WHERE b.owner_id=$1
    UNION ALL
    SELECT 'wiki', w.book_id::text, b.id::text, b.title, w.generated_at::text,
      concat_ws(E'\\n', NULLIF(w.overview,''), NULLIF(w.book_so_far,''), NULLIF(w.next_session_context,''))
    FROM book_wiki w JOIN books b ON b.id=w.book_id WHERE b.owner_id=$1
  ) SELECT * FROM sources WHERE COALESCE(content,'')<>'' ORDER BY occurred_at DESC LIMIT 40`,[ownerId])).rows;
  return rows.map(r=>({sourceType:r.source_type,sourceId:r.source_id,bookId:r.book_id,bookTitle:r.book_title,occurredAt:r.occurred_at,content:clean(r.content,1400)})).filter(r=>r.content);
}
export function hasPodcastRecapSource(s:RecapSource[]){return s.filter(x=>x.sourceType==='log').length>=1 && new Set(s.map(x=>x.bookId)).size>=1;}
export function resolvePodcastRecapLanguage(s:RecapSource[]):RecapLanguage{return vi(s.map(x=>x.content).join(" "))?"vi":"en";}
export function buildPodcastRecapPrompt(language:RecapLanguage,sources:RecapSource[]){
 const evidence=sources.map(s=>`[${s.sourceType}:${s.sourceId}] ${s.bookTitle} (${s.occurredAt})\n${s.content}`).join("\n\n").slice(0,42000);
 return `Create a short, warm next-reading podcast recap from ONLY the saved companion evidence below. Write entirely in ${language==='vi'?'Vietnamese':'English'}. Do not invent books, facts, quotes, emotions, or future plot. Do not mention raw text, hidden systems, or unsupported citations. Return strict JSON only: {"title":"","opening":"","recap":"","nextDirection":"","sourceRefs":[{"sourceType":"","sourceId":""}]}. title <=120 chars; opening <=500; recap <=1800; nextDirection <=700; cite 1-6 supplied sources.\n\nEVIDENCE\n${evidence}`;
}
export function parsePodcastRecap(raw:string,language:RecapLanguage,sources:RecapSource[]){
 let v:any; try{v=JSON.parse(raw)}catch{throw new Error("podcast recap returned invalid JSON")}
 const allowed=new Map(sources.map(s=>[`${s.sourceType}:${s.sourceId}`,s]));
 const refs=(Array.isArray(v.sourceRefs)?v.sourceRefs:[]).slice(0,6).map((r:any)=>allowed.get(`${clean(r?.sourceType,30)}:${clean(r?.sourceId,100)}`)).filter(Boolean) as RecapSource[];
 if(!refs.length)throw new Error("podcast recap has no valid citations");
 const title=clean(v.title,120),opening=clean(v.opening,500),recap=clean(v.recap,1800),nextDirection=clean(v.nextDirection,700);
 if(!title||!opening||!recap||!nextDirection)throw new Error("podcast recap missing required fields");
 return {title,opening,recap,nextDirection,sourceRefs:refs.map(s=>({sourceType:s.sourceType,sourceId:s.sourceId,bookId:s.bookId,bookTitle:s.bookTitle,occurredAt:s.occurredAt})),outputLanguage:language};
}
function publicRow(r:any):PodcastRecap{return {id:r.id,requestKey:r.request_key,status:r.status,outputLanguage:r.output_language,voiceModel:r.voice_model,payload:r.payload,sourceBookCount:Number(r.source_book_count||0),sourceSessionCount:Number(r.source_session_count||0),scriptText:r.script_text||null,durationS:r.duration_s==null?null:Number(r.duration_s),hasAudio:Boolean(r.local_cache_path),generatedAt:new Date(r.updated_at||r.created_at).toISOString()};}
export async function getPodcastRecap(ownerId:string,requestKey?:string){const where=requestKey?"owner_id=$1 AND request_key=$2":"owner_id=$1";const args=requestKey?[ownerId,requestKey]:[ownerId];const row=(await query<any>(`SELECT * FROM podcast_recaps WHERE ${where} ORDER BY updated_at DESC LIMIT 1`,args)).rows[0];return row?publicRow(row):null;}
export async function generatePodcastRecap(ownerId:string,requestKey?:string){
 const key=clean(requestKey,160)||`podcast-recap:${crypto.randomUUID()}`;
 const same=await getPodcastRecap(ownerId,key); if(same)return {status:"existing" as const,recap:same};
 const sources=await getPodcastRecapSources(ownerId); if(!hasPodcastRecapSource(sources))return {status:"no_source" as const,recap:null};
 const user=(await query<any>("SELECT podcast_voice_gender FROM users WHERE id=$1",[ownerId])).rows[0]; const gender=user?.podcast_voice_gender as "female"|"male"|null;
 if(!gender)return {status:"voice_required" as const,recap:null};
 const language=resolvePodcastRecapLanguage(sources), voice=voices[language][gender];
 const reservation=await reserveUsage({userId:ownerId,feature:"podcast_recap_generation",requestKey:key,resource:{type:"podcast_recap",id:"current"}});
 let audioPath:string|undefined;
 try{
  const payload=parsePodcastRecap(await callJsonLLM("You are a careful personal reading narrator. Return strict JSON only.",buildPodcastRecapPrompt(language,sources),0.2),language,sources);
  const script=[payload.opening,payload.recap,payload.nextDirection].join("\n\n");
  const audio=await synthesizePodcast(script,voice);audioPath=audio.filePath;
  await fs.mkdir(config.podcastCacheDir,{recursive:true});
  const cachePath=path.join(config.podcastCacheDir,`recap-${ownerId}.mp3`);await fs.rename(audio.filePath,cachePath);audioPath=undefined;
  const saved=(await query<any>(`INSERT INTO podcast_recaps(owner_id,request_key,schema_version,status,output_language,voice_model,payload,source_book_count,source_session_count,script_text,word_count,duration_s,local_cache_path,local_cache_until) VALUES($1,$2,1,'ready',$3,$4,$5,$6,$7,$8,$9,$10,$11,now()+interval '7 days') ON CONFLICT(owner_id) DO UPDATE SET request_key=EXCLUDED.request_key,schema_version=1,status='ready',output_language=EXCLUDED.output_language,voice_model=EXCLUDED.voice_model,payload=EXCLUDED.payload,source_book_count=EXCLUDED.source_book_count,source_session_count=EXCLUDED.source_session_count,script_text=EXCLUDED.script_text,word_count=EXCLUDED.word_count,duration_s=EXCLUDED.duration_s,local_cache_path=EXCLUDED.local_cache_path,local_cache_until=EXCLUDED.local_cache_until,error_message=NULL,updated_at=now() RETURNING *`,[ownerId,key,language,voice,JSON.stringify(payload),new Set(sources.map(s=>s.bookId)).size,sources.filter(s=>s.sourceType==='log').length,script,script.split(/\s+/).length,audio.durationS,cachePath])).rows[0];
  await consumeUsage(reservation.id);return {status:"generated" as const,recap:publicRow(saved)};
 }catch(e){await releaseUsage(reservation.id,e instanceof Error?e.message:"generation failed");throw e;}finally{if(audioPath)await fs.unlink(audioPath).catch(()=>undefined);}
}
export async function podcastRecapAudio(ownerId:string){const r=(await query<any>("SELECT local_cache_path FROM podcast_recaps WHERE owner_id=$1 AND local_cache_path IS NOT NULL AND local_cache_until>now()",[ownerId])).rows[0];return r?.local_cache_path||null;}
export async function deletePodcastRecapFile(ownerId:string){const p=await podcastRecapAudio(ownerId);if(p)await fs.unlink(p).catch(()=>undefined);}
export function podcastRecapFixtureCheck(){const s:RecapSource[]=[{sourceType:"log",sourceId:"l1",bookId:"b1",bookTitle:"Book",occurredAt:"2026-08-01",content:"Một ý tưởng"}];const p=parsePodcastRecap(JSON.stringify({title:"T",opening:"O",recap:"R",nextDirection:"N",sourceRefs:[{sourceType:"log",sourceId:"l1"}]}),"vi",s);if(p.outputLanguage!=="vi"||p.sourceRefs.length!==1)throw new Error("recap parser fixture failed");}
if (process.env.RUN_PODCAST_RECAP_FIXTURE === "1") { podcastRecapFixtureCheck(); console.log("PODCAST_RECAP_FIXTURES_OK"); }
        