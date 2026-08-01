import {hasConnectionSource,parseCrossBookConnections,resolveCrossBookLanguage,type ConnectionSource} from "../src/crossBookConnections.js";
const sources:ConnectionSource[]=[
 {sourceType:"log",sourceId:"one",bookId:"book-1",bookTitle:"One",occurredAt:"2026-08-01",content:"A repeated idea"},
 {sourceType:"log",sourceId:"two",bookId:"book-2",bookTitle:"Two",occurredAt:"2026-08-02",content:"The same idea returns"},
];
if(!hasConnectionSource(sources))throw new Error("two-book source should qualify");
if(hasConnectionSource(sources.slice(0,1)))throw new Error("one-book source must not qualify");
const parsed=parseCrossBookConnections(JSON.stringify({opening:"A grounded connection",connections:[{title:"Shared thread",synthesis:"Both books revisit the idea.",sourceRefs:[{sourceType:"log",sourceId:"one"},{sourceType:"log",sourceId:"two"}]}],carryForward:["Keep noticing it"]}),resolveCrossBookLanguage(sources),sources);
if(parsed.connections[0].sourceRefs.length!==2)throw new Error("reference validation failed");
let rejected=false;try{parseCrossBookConnections(JSON.stringify({opening:"x",connections:[{title:"x",synthesis:"x",sourceRefs:[{sourceType:"log",sourceId:"one"}]}]}),"en",sources)}catch{rejected=true}if(!rejected)throw new Error("single-book citation must reject");
console.log("CROSS_BOOK_CONNECTIONS_FIXTURES_OK");
