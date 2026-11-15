import posthog from 'posthog-js/dist/module.slim.js';
(window as any).fixtureEnable=()=>posthog.set_config({opt_out_useragent_filter:true,request_batching:false});
import {identifyAnalyticsUser,captureAnalyticsEvent,resetAnalyticsUser} from '../../src/analytics';
Object.assign(window,{fixtureIdentify:()=>identifyAnalyticsUser('synthetic-id','synthetic-handle'),fixtureCapture:()=>captureAnalyticsEvent('feedback_submitted',{fixture:true}),fixtureReset:resetAnalyticsUser});
