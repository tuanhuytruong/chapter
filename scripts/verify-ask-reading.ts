import {normalizeQuestion,parseAskReading,resolveOutputLanguage} from "../src/askMyReading.js";
const s=[{sourceType:"log",sourceId:"a",bookId:"b",bookTitle:"Book",occurredAt:"2026-08-01",content:"A saved insight"}];
if(normalizeQuestion(" What stayed with me? ")!=="What stayed with me?")throw new Error("question fixture failed");
const x=parseAskReading(JSON.stringify({answer:"Grounded answer",sourceRefs:[{sourceType:"log",sourceId:"a"}]}),resolveOutputLanguage("question",s),s);if(x.sourceRefs.length!==1)throw new Error("source fixture failed");console.log("ASK_READING_FIXTURES_OK");
