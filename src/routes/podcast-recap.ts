import { Router, type Request, type Response } from "express";
import fs from "fs/promises";
import { userFrom } from "../auth.js";
import { effectiveEntitlement, quotaFor } from "../entitlements.js";
import { query } from "../db.js";
import { usageSummary } from "../usage.js";
import { FeatureUnavailableError, QuotaExceededError } from "../entitlements.js";
import { generatePodcastRecap, getPodcastRecap, getPodcastRecapSources, hasPodcastRecapSource, podcastRecapAudio } from "../podcastRecap.js";

export const podcastRecapRouter = Router();
async function state(ownerId:string){
 const subscription=(await query<any>("SELECT tier,status,current_period_end,granted_by FROM subscriptions WHERE user_id=$1",[ownerId])).rows[0];
 const entitlement=effectiveEntitlement(subscription); const limit=quotaFor(entitlement.tier,"podcast_recap_generation");
 const usage=(await usageSummary(ownerId))["podcast_recap_generation"]||{used:0,reserved:0};
 const sources=await getPodcastRecapSources(ownerId);
 return {recap:await getPodcastRecap(ownerId),available:entitlement.active&&limit!=="unavailable",hasSource:hasPodcastRecapSource(sources),sourceBookCount:new Set(sources.map(s=>s.bookId)).size,sourceSessionCount:sources.filter(s=>s.sourceType==="log").length,usage:{...usage,limit}};
}
podcastRecapRouter.get("/current",async(req:Request,res:Response)=>{try{res.json(await state(userFrom(req).id));}catch(e:any){res.status(500).json({error:"Podcast recap unavailable"});}});
podcastRecapRouter.post("/generate",async(req:Request,res:Response)=>{try{const key=typeof req.body?.requestKey==="string"?req.body.requestKey:"";const ownerId=userFrom(req).id; const subscription=(await query<any>("SELECT tier,status,current_period_end,granted_by FROM subscriptions WHERE user_id=$1",[ownerId])).rows[0]; const entitlement=effectiveEntitlement(subscription); if(!entitlement.active||quotaFor(entitlement.tier,"podcast_recap_generation")==="unavailable") return res.status(403).json({error:"This feature is not available on the current plan."}); const result=await generatePodcastRecap(ownerId,key);res.json(result);}catch(e:any){if(e instanceof FeatureUnavailableError)return res.status(403).json({error:e.message});if(e instanceof QuotaExceededError)return res.status(429).json({error:e.message});res.status(502).json({error:"Podcast recap could not be prepared"});}});
podcastRecapRouter.get("/audio",async(req:Request,res:Response)=>{try{const file=await podcastRecapAudio(userFrom(req).id);if(!file)return res.status(404).end();const data=await fs.readFile(file);res.setHeader("Content-Type","audio/mpeg");res.setHeader("Cache-Control","private, no-store");res.setHeader("Content-Length",data.length);res.end(data);}catch{res.status(503).json({error:"Podcast recap audio is temporarily unavailable"});}});
       